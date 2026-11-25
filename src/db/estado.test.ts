// Integração banco ↔ motor com IndexedDB falso (fake-indexeddb).
import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { tetoDoDia } from '../engine';
import { criarCiclo, excluirMovimento, fecharDia, lancarGasto, pagarConta, registrarChecklist } from './acoes';
import { exportarBackup, importarBackup } from './backup';
import { ativo, db } from './db';
import { lancamentosAte, montarEstado, provisaoRealDia, type DadosCiclo } from './estado';

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

const cicloB = {
  dataInicio: '2026-03-02', dataFim: '2026-03-11', bufferDias: 0, diasAtivos: [1, 2, 3, 4, 5], recessos: [],
  saldoInicial: r(500),
  contas: [{ descricao: 'Internet', valor: r(35) }],
  gastos: [{ descricao: 'Mototáxi', valorUnitario: r(7), qtdPadraoDia: 2 }],
};

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('banco + motor', () => {
  it('ciclo criado pelo app reproduz o CT01', async () => {
    await criarCiclo(cicloB);
    const d = await carregar();
    expect(tetoDoDia(montarEstado(d), '2026-03-02').resultado.teto).toBe(r(35.3));
  });

  it('pagar conta é neutro e excluir o pagamento volta a conta para pendente', async () => {
    await criarCiclo(cicloB);
    let d = await carregar();
    await pagarConta(d.contas[0]!.id, '2026-03-02');
    d = await carregar();
    expect(d.contas[0]!.pagaEm).toBe('2026-03-02');
    expect(tetoDoDia(montarEstado(d), '2026-03-02').resultado.teto).toBe(r(35.3));
    await excluirMovimento(d.movimentos[0]!.id);
    d = await carregar();
    expect(d.contas[0]!.pagaEm).toBeUndefined();
    expect(d.movimentos).toHaveLength(0);
  });

  it('checklist e gasto variável alimentam a categorização do fechamento (CT19)', async () => {
    await criarCiclo(cicloB);
    let d = await carregar();
    await registrarChecklist(d.ciclo.id, d.gastosFixos[0]!, '2026-03-02', 1);
    await lancarGasto(d.ciclo.id, '2026-03-02', r(20), 'Alimentação');
    d = await carregar();
    expect(provisaoRealDia(d, '2026-03-02')).toBe(r(7));
    expect(lancamentosAte(d, '2026-03-02')).toEqual({ provisaoReal: r(7), gastosVariaveis: r(20) });
    const f = await fecharDia(d, '2026-03-02', r(467));
    expect(f.gastoReal).toBe(r(33));
    expect(f.naoCategorizado).toBe(r(6));
    d = await carregar();
    expect(montarEstado(d).ultimoFechamento).toEqual({ data: '2026-03-02', saldo: r(467) });
  });

  it('novo ciclo leva contas pendentes como atrasadas e reaproveita os modelos', async () => {
    await criarCiclo(cicloB);
    const modelos = await db.contasFixas.toArray();
    await criarCiclo({ ...cicloB, dataInicio: '2026-03-12', dataFim: '2026-04-10',
      contas: [{ id: modelos[0]!.id, descricao: 'Internet', valor: r(35) }] });
    const d = await carregar();
    expect(d.contas.map((c) => c.atrasada).sort()).toEqual([false, true]);
    expect(await db.contasFixas.count()).toBe(1);
    expect(await db.ciclos.where('status').equals('CONCLUIDO').count()).toBe(1);
  });

  it('backup ida e volta', async () => {
    await criarCiclo(cicloB);
    const blob = await exportarBackup();
    const texto = await blob.text();
    await db.ciclos.clear();
    await importarBackup(texto);
    expect(await db.ciclos.count()).toBe(1);
    await expect(importarBackup('{"app":"outro"}')).rejects.toThrow('não é um backup');
  });
});
