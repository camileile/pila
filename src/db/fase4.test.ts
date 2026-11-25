// Fase 4: modo aperto com adiamento, fechamento semanal e Streak a partir do banco.
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { calcularStreak, tetoDoDia } from '../engine';
import { adiarConta, criarCiclo, definirFolgaSemanal, fecharDia, resolverSemana, type RascunhoCiclo } from './acoes';
import { ativo, db, type FechamentoRow } from './db';
import { diasDosFechamentos, montarEstado, semanaParaFechar, type DadosCiclo } from './estado';

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

// Cenário B (seg 02/03 a qua 11/03, mototáxi 2 × 7)
const cicloB: RascunhoCiclo = {
  dataInicio: '2026-03-02', dataFim: '2026-03-11', bufferDias: 0, diasAtivos: [1, 2, 3, 4, 5], recessos: [],
  saldoInicial: r(500),
  contas: [{ descricao: 'Internet', valor: r(35) }],
  gastos: [{ descricao: 'Mototáxi', valorUnitario: r(7), qtdPadraoDia: 2 }],
};

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('modo aperto (RF16)', () => {
  it('CT05 + adiar a internet: déficit cai de 47 para 12; a conta vai atrasada para o próximo ciclo', async () => {
    await criarCiclo({ ...cicloB, saldoInicial: r(100) });
    let d = await carregar();
    expect(tetoDoDia(montarEstado(d), '2026-03-02').resultado.deficit).toBe(r(47));
    await adiarConta(d.contas[0]!.id);
    d = await carregar();
    expect(tetoDoDia(montarEstado(d), '2026-03-02').resultado.deficit).toBe(r(12));
    await criarCiclo({ ...cicloB, dataInicio: '2026-03-12', dataFim: '2026-04-10', contas: [] });
    d = await carregar();
    expect(d.contas).toHaveLength(1);
    expect(d.contas[0]).toMatchObject({ descricao: 'Internet', atrasada: true });
    expect(d.contas[0]!.adiada).toBeUndefined();
  });
});

describe('fechamento semanal (§3.10)', () => {
  it('oferece a semana anterior com economia; some depois de resolvida', async () => {
    await criarCiclo({ ...cicloB, dataFim: '2026-03-20' });
    let d = await carregar();
    // Semana de 02 a 08/03 fechada de uma vez com economia
    // orçado da semana ≈ 70 de transporte + 7 × 13,42 de teto ≈ 163,94; gastou 100 → economia
    const f = await fecharDia(d, '2026-03-08', r(400));
    expect(f.economia).toBeGreaterThan(0);
    d = await carregar();
    expect(semanaParaFechar(d, '2026-03-09')).toEqual({ segunda: '2026-03-02', domingo: '2026-03-08', economia: f.economia });
    // No próprio domingo, já fechado, a semana é a atual
    expect(semanaParaFechar(d, '2026-03-08')?.segunda).toBe('2026-03-02');
    await resolverSemana('2026-03-02');
    const config = await db.config.get('config');
    expect(semanaParaFechar(d, '2026-03-09', config?.semanasResolvidas)).toBeNull();
  });

  it('semana sem economia não é oferecida', async () => {
    await criarCiclo(cicloB);
    let d = await carregar();
    await fecharDia(d, '2026-03-08', r(10));
    d = await carregar();
    expect(semanaParaFechar(d, '2026-03-09')).toBeNull();
  });
});

describe('Streak a partir dos fechamentos', () => {
  it('fechamento de vários dias conta cada dia; folga configurável', async () => {
    const f = (dataInicio: string, dataFim: string, dentro: boolean) => ({ dataInicio, dataFim, dentro }) as FechamentoRow;
    const dias = diasDosFechamentos([f('2026-03-02', '2026-03-03', true), f('2026-03-04', '2026-03-04', false), f('2026-03-05', '2026-03-05', true)]);
    expect(dias.map((x) => x.data)).toEqual(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05']);
    expect(calcularStreak(dias).at(-1)!.streak).toBe(3);
    expect(calcularStreak(dias, { folgaSemanal: false }).at(-1)!.streak).toBe(1);
    await definirFolgaSemanal(false);
    await resolverSemana('2026-03-02');
    expect(await db.config.get('config')).toMatchObject({ folgaSemanal: false, semanasResolvidas: ['2026-03-02'] });
  });
});
