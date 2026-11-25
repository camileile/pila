// Fase 3: renda com carimbo, metas, Modo Rolê e sobra do ciclo, passando pelo banco.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { projetarAte, tetoDoDia } from '../engine';
import {
  agendarRole, aportarMeta, criarCiclo, criarMeta, fecharDia, garantirCofrinhoGeral, registrarRenda, removerRole,
  resgatarMeta, salvarFonte, type RascunhoCiclo,
} from './acoes';
import { ativo, db } from './db';
import { dataLancamento, montarEstado, type DadosCiclo } from './estado';
import { metasComSaldo } from './metas';

const r = (x: number) => Math.round(x * 100);

async function carregar(): Promise<DadosCiclo> {
  const ciclo = (await db.ciclos.where('status').equals('ATIVO').first())!;
  const doCiclo = async <T extends { cicloId: string; excluidoEm: string | null }>(t: { toArray(): Promise<T[]> }) =>
    (await t.toArray()).filter((x) => x.cicloId === ciclo.id && ativo(x));
  return {
    ciclo,
    gastosFixos: (await db.gastosFixos.toArray()).filter((g) => ativo(g) && g.ativo),
    contas: await doCiclo(db.contasCiclo),
    registros: await doCiclo(db.registrosFixos),
    movimentos: await doCiclo(db.movimentos),
    reservas: await doCiclo(db.reservas),
    fechamentos: await doCiclo(db.fechamentos),
  };
}

const saldos = async () => metasComSaldo(await db.metas.toArray(), await db.movimentos.toArray());

const cicloB: RascunhoCiclo = {
  dataInicio: '2026-03-02', dataFim: '2026-03-11', bufferDias: 0, diasAtivos: [1, 2, 3, 4, 5], recessos: [],
  saldoInicial: r(500),
  contas: [{ descricao: 'Internet', valor: r(35) }],
  gastos: [{ descricao: 'Mototáxi', valorUnitario: r(7), qtdPadraoDia: 2 }],
};

// 10 dias, sem contas nem gastos fixos, saldo 200 → teto 20 (cenário do UC05)
const cicloRole: RascunhoCiclo = { ...cicloB, saldoInicial: r(200), contas: [], gastos: [] };

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('Caiu, Guardou', () => {
  it('UC02: bolsa de 500 com 20% para a Viagem vira 400 livres', async () => {
    await criarCiclo(cicloB);
    const viagem = await criarMeta('Viagem', r(1000), '2026-06-02');
    let d = await carregar();
    const res = await registrarRenda(d.ciclo.id, '2026-03-02', r(500), {
      descricao: 'Bolsa NEABI', regra: { tipo: 'PERCENTUAL', valor: 20 }, metaId: viagem,
    });
    expect(res).toEqual({ carimbo: r(100), liquido: r(400) });
    d = await carregar();
    expect(projetarAte(montarEstado(d), '2026-03-02')[0]!.estruturais).toBe(r(400));
    // (900 − 35 − 112) / 10
    expect(tetoDoDia(montarEstado(d), '2026-03-02').resultado.teto).toBe(r(75.3));
    expect((await saldos()).find((m) => m.id === viagem)?.saldo).toBe(r(100));
  });

  it('sem meta de destino, o carimbo não é aplicado', async () => {
    await criarCiclo(cicloB);
    const d = await carregar();
    const res = await registrarRenda(d.ciclo.id, '2026-03-02', r(500), { descricao: 'Pix', regra: { tipo: 'PERCENTUAL', valor: 20 } });
    expect(res.carimbo).toBe(0);
  });

  it('fonte com regra inválida é recusada', async () => {
    await expect(salvarFonte({ nome: 'Bolsa', regraCarimbo: { tipo: 'PERCENTUAL', valor: 120 } })).rejects.toThrow(RangeError);
    await salvarFonte({ nome: 'Bolsa', valorPrevisto: r(500), regraCarimbo: { tipo: 'FIXO', valor: r(100) } });
    expect(await db.fontesRenda.count()).toBe(1);
  });
});

describe('metas e cofrinho', () => {
  it('aporte reduz o teto, resgate aumenta', async () => {
    await criarCiclo(cicloB);
    const geral = await garantirCofrinhoGeral();
    expect(await garantirCofrinhoGeral()).toBe(geral);
    let d = await carregar();
    await aportarMeta(d.ciclo.id, '2026-03-02', geral, r(50));
    d = await carregar();
    expect(tetoDoDia(montarEstado(d), '2026-03-02').resultado.teto).toBe(r(30.3));
    await resgatarMeta(d.ciclo.id, '2026-03-02', geral, r(20));
    d = await carregar();
    expect(tetoDoDia(montarEstado(d), '2026-03-02').resultado.teto).toBe(r(32.3));
    expect((await saldos())[0]).toMatchObject({ tipo: 'GERAL', saldo: r(30) });
  });

  it('saldo da meta soma ciclos diferentes', async () => {
    await criarCiclo(cicloB);
    const meta = await criarMeta('Notebook', r(2000), '2026-12-01');
    await aportarMeta((await carregar()).ciclo.id, '2026-03-02', meta, r(100));
    await criarCiclo({ ...cicloB, dataInicio: '2026-03-12', dataFim: '2026-04-10' });
    await aportarMeta((await carregar()).ciclo.id, '2026-03-12', meta, r(150));
    expect((await saldos()).find((m) => m.id === meta)?.saldo).toBe(r(250));
  });
});

describe('Modo Rolê', () => {
  it('UC05: reserva de 80 baixa o teto de 20 para 12; reserva grande é recusada', async () => {
    await criarCiclo(cicloRole);
    let d = await carregar();
    expect(await agendarRole(d, '2026-03-02', { data: '2026-03-06', valor: r(250), descricao: 'Show' }))
      .toEqual({ ok: false, motivo: 'NAO_CABE', maximo: r(200) });
    expect(await agendarRole(d, '2026-03-02', { data: '2026-03-06', valor: r(80), descricao: 'Jantar' })).toEqual({ ok: true });
    d = await carregar();
    expect(tetoDoDia(montarEstado(d), '2026-03-02').resultado.teto).toBe(r(12));
    await removerRole(d.reservas[0]!.id);
    d = await carregar();
    expect(tetoDoDia(montarEstado(d), '2026-03-02').resultado.teto).toBe(r(20));
  });
});

describe('data de lançamento', () => {
  it('depois de fechar o dia, lançamentos vão para o dia seguinte; ciclo todo fechado → null', async () => {
    await criarCiclo(cicloB);
    let d = await carregar();
    expect(dataLancamento(d, '2026-03-02')).toBe('2026-03-02');
    await fecharDia(d, '2026-03-02', r(450));
    d = await carregar();
    expect(dataLancamento(d, '2026-03-02')).toBe('2026-03-03');
    expect(dataLancamento(d, '2026-03-05')).toBe('2026-03-05');
    await fecharDia(d, '2026-03-11', r(100));
    d = await carregar();
    expect(dataLancamento(d, '2026-03-12')).toBeNull();
  });
});

describe('fim de ciclo', () => {
  it('a sobra enviada à meta fica registrada no ciclo anterior', async () => {
    await criarCiclo(cicloRole);
    const meta = await criarMeta('Viagem', r(1000), '2026-06-02');
    await criarCiclo({ ...cicloRole, dataInicio: '2026-03-12', dataFim: '2026-04-10', saldoInicial: r(30), aporteFinal: { metaId: meta, valor: r(30) } });
    const anterior = (await db.ciclos.where('status').equals('CONCLUIDO').first())!;
    const aporte = (await db.movimentos.toArray()).find((m) => m.metaId === meta)!;
    expect(aporte).toMatchObject({ cicloId: anterior.id, data: '2026-03-11', valor: r(30) });
    expect((await saldos()).find((m) => m.id === meta)?.saldo).toBe(r(30));
  });
});
