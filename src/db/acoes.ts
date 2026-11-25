// Todas as escritas no banco passam por aqui.
import { fecharPeriodo, type Centavos, type Data, type Recesso } from '../engine';
import { ativo, carimboAgora, db, novo, type CicloRow, type ContaFixaRow, type GastoFixoRow } from './db';
import { lancamentosAte, montarEstado, type DadosCiclo } from './estado';

export interface RascunhoCiclo {
  dataInicio: Data;
  dataFim: Data;
  bufferDias: number;
  diasAtivos: number[];
  recessos: Recesso[];
  saldoInicial: Centavos;
  contas: { id?: string; descricao: string; valor: Centavos }[];
  gastos: { id?: string; descricao: string; valorUnitario: Centavos; qtdPadraoDia: number }[];
}

/** Cria um ciclo novo; encerra o ativo e leva as contas pendentes como atrasadas (§3.11). */
export async function criarCiclo(r: RascunhoCiclo) {
  await db.transaction('rw', [db.ciclos, db.contasFixas, db.gastosFixos, db.contasCiclo], async () => {
    const anterior = await db.ciclos.where('status').equals('ATIVO').first();
    let atrasadas: { descricao: string; valor: Centavos; contaFixaId?: string }[] = [];
    if (anterior) {
      const contas = (await db.contasCiclo.where('cicloId').equals(anterior.id).toArray()).filter(ativo);
      atrasadas = contas.filter((c) => !c.pagaEm);
      await db.ciclos.update(anterior.id, { status: 'CONCLUIDO', ...carimboAgora() });
    }

    const ciclo: CicloRow = novo({
      titulo: `Ciclo ${r.dataInicio.split('-').reverse().slice(0, 2).join('/')}`,
      dataInicio: r.dataInicio,
      dataFim: r.dataFim,
      bufferDias: r.bufferDias,
      diasAtivos: r.diasAtivos,
      recessos: r.recessos,
      saldoInicial: r.saldoInicial,
      status: 'ATIVO' as const,
    });
    await db.ciclos.add(ciclo);

    // Modelos de contas: atualiza os mantidos, desativa os removidos, cria os novos.
    const modelos = (await db.contasFixas.toArray()).filter(ativo);
    const mantidas = new Set(r.contas.map((c) => c.id).filter(Boolean));
    for (const m of modelos)
      if (!mantidas.has(m.id)) await db.contasFixas.update(m.id, { ativa: false, ...carimboAgora() });
    for (const c of r.contas) {
      let id = c.id;
      if (id) await db.contasFixas.update(id, { descricao: c.descricao, valor: c.valor, ativa: true, ...carimboAgora() });
      else {
        const m: ContaFixaRow = novo({ descricao: c.descricao, valor: c.valor, ativa: true });
        await db.contasFixas.add(m);
        id = m.id;
      }
      await db.contasCiclo.add(novo({ cicloId: ciclo.id, contaFixaId: id, descricao: c.descricao, valor: c.valor, atrasada: false }));
    }
    for (const a of atrasadas)
      await db.contasCiclo.add(novo({ cicloId: ciclo.id, contaFixaId: a.contaFixaId, descricao: a.descricao, valor: a.valor, atrasada: true }));

    // Gastos fixos diários: mesma lógica.
    const gastos = (await db.gastosFixos.toArray()).filter(ativo);
    const mantidos = new Set(r.gastos.map((g) => g.id).filter(Boolean));
    for (const g of gastos)
      if (!mantidos.has(g.id)) await db.gastosFixos.update(g.id, { ativo: false, ...carimboAgora() });
    for (const g of r.gastos) {
      const dados = { descricao: g.descricao, valorUnitario: g.valorUnitario, qtdPadraoDia: g.qtdPadraoDia, ativo: true };
      if (g.id) await db.gastosFixos.update(g.id, { ...dados, ...carimboAgora() });
      else await db.gastosFixos.add(novo(dados) as GastoFixoRow);
    }
  });
}

export async function lancarGasto(cicloId: string, data: Data, valor: Centavos, categoria: string) {
  await db.movimentos.add(novo({ cicloId, data, tipo: 'GASTO_VARIAVEL' as const, valor, categoria }));
}

export async function registrarEntrada(cicloId: string, data: Data, valor: Centavos, descricao: string) {
  await db.movimentos.add(novo({ cicloId, data, tipo: 'ENTRADA_RENDA' as const, valor, descricao }));
}

export async function pagarConta(contaId: string, data: Data) {
  await db.transaction('rw', [db.contasCiclo, db.movimentos], async () => {
    const c = await db.contasCiclo.get(contaId);
    if (!c || c.pagaEm) return;
    await db.contasCiclo.update(contaId, { pagaEm: data, ...carimboAgora() });
    await db.movimentos.add(novo({
      cicloId: c.cicloId, data, tipo: 'PAGAMENTO_CONTA' as const, valor: c.valor,
      descricao: c.descricao, contaCicloId: c.id,
    }));
  });
}

/** Exclusão lógica (RF17). Excluir um pagamento volta a conta para pendente. */
export async function excluirMovimento(id: string) {
  await db.transaction('rw', [db.contasCiclo, db.movimentos], async () => {
    const m = await db.movimentos.get(id);
    if (!m) return;
    await db.movimentos.update(id, { excluidoEm: new Date().toISOString(), ...carimboAgora() });
    if (m.contaCicloId) await db.contasCiclo.update(m.contaCicloId, { pagaEm: undefined, ...carimboAgora() });
  });
}

export async function registrarChecklist(cicloId: string, gasto: GastoFixoRow, data: Data, qtd: number) {
  const existente = await db.registrosFixos.where({ gastoFixoId: gasto.id, data }).first();
  const valorTotal = gasto.valorUnitario * qtd;
  if (existente) await db.registrosFixos.update(existente.id, { qtd, valorTotal, ...carimboAgora() });
  else await db.registrosFixos.add(novo({ cicloId, gastoFixoId: gasto.id, data, qtd, valorTotal }));
}

export async function fecharDia(d: DadosCiclo, ate: Data, saldoAtual: Centavos) {
  const f = fecharPeriodo(montarEstado(d), ate, saldoAtual, lancamentosAte(d, ate));
  await db.fechamentos.add(novo({
    cicloId: d.ciclo.id,
    dataInicio: f.dataInicio,
    dataFim: f.dataFim,
    saldoInicial: f.saldoInicio,
    saldoFinal: saldoAtual,
    estruturais: f.estruturais,
    orcado: f.orcado,
    gastoReal: f.gastoReal,
    economia: f.economia,
    naoCategorizado: f.naoCategorizado,
    dentro: f.dentro,
  }));
  return f;
}

export async function desfazerFechamento(id: string) {
  await db.fechamentos.update(id, { excluidoEm: new Date().toISOString(), ...carimboAgora() });
}
