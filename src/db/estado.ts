// Converte as linhas do banco no formato que o motor entende. Funções puras (testáveis).
import {
  base,
  ehDiaAtivo,
  intervalo,
  type Centavos,
  type Data,
  type EstadoCiclo,
} from '../engine';
import type {
  CicloRow, ContaCicloRow, FechamentoRow, GastoFixoRow, MovimentoRow, RegistroFixoRow, ReservaRow,
} from './db';

export interface DadosCiclo {
  ciclo: CicloRow;
  gastosFixos: GastoFixoRow[];
  contas: ContaCicloRow[];
  registros: RegistroFixoRow[];
  movimentos: MovimentoRow[];
  reservas: ReservaRow[];
  fechamentos: FechamentoRow[];
}

export const ultimoFechamento = (f: FechamentoRow[]): FechamentoRow | undefined =>
  [...f].sort((a, b) => a.dataFim.localeCompare(b.dataFim)).at(-1);

export function montarEstado(d: DadosCiclo): EstadoCiclo {
  const ult = ultimoFechamento(d.fechamentos);
  return {
    ciclo: d.ciclo,
    gastosFixos: d.gastosFixos.filter((g) => g.ativo),
    contas: d.contas.map((c) => ({ valor: c.valor, pagaEm: c.pagaEm })),
    reservas: d.reservas.map((r) => ({ data: r.data, valor: r.valor })),
    movimentos: d.movimentos.map((m) => ({ data: m.data, tipo: m.tipo, valor: m.valor, metaId: m.metaId })),
    ultimoFechamento: ult ? { data: ult.dataFim, saldo: ult.saldoFinal } : null,
  };
}

/** Custo real dos gastos fixos num dia: checklist se houver, senão o padrão. */
export function provisaoRealDia(d: DadosCiclo, data: Data): Centavos {
  if (!ehDiaAtivo(d.ciclo, data)) return 0;
  return d.gastosFixos
    .filter((g) => g.ativo)
    .reduce((t, g) => {
      const reg = d.registros.find((r) => r.gastoFixoId === g.id && r.data === data);
      return t + (reg ? reg.valorTotal : g.valorUnitario * g.qtdPadraoDia);
    }, 0);
}

export const gastosVariaveisEntre = (d: DadosCiclo, de: Data, ate: Data): Centavos =>
  d.movimentos
    .filter((m) => m.tipo === 'GASTO_VARIAVEL' && m.data >= de && m.data <= ate)
    .reduce((t, m) => t + m.valor, 0);

/** Lançamentos de categorização de todo o período em aberto até `ate`. */
export function lancamentosAte(d: DadosCiclo, ate: Data) {
  const de = base(montarEstado(d)).data;
  const dias = intervalo(de, ate).slice(1);
  return {
    provisaoReal: dias.reduce((t, x) => t + provisaoRealDia(d, x), 0),
    gastosVariaveis: dias.length ? gastosVariaveisEntre(d, dias[0]!, ate) : 0,
  };
}
