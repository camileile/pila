import { base, projetarAte } from './teto';
import type { Centavos, Data, EstadoCiclo } from './tipos';

export interface EntradaApuracao {
  saldoInicio: Centavos;
  saldoAtual: Centavos;
  /** Soma dos efeitos estruturais do período (renda líquida, contas, metas). */
  estruturais: Centavos;
  orcado: Centavos;
  /** Total do checklist de gastos fixos no período. */
  provisaoReal?: Centavos;
  /** Total dos gastos variáveis lançados no período. */
  gastosVariaveis?: Centavos;
}

export interface Apuracao {
  gastoReal: Centavos;
  economia: Centavos;
  dentro: boolean;
  naoCategorizado: Centavos;
  /** O saldo subiu sem renda registrada: perguntar "entrou dinheiro?". */
  entrouDinheiro: boolean;
  /** Os lançamentos somam mais que o gasto real. */
  lancamentosAcimaDoReal: boolean;
}

/** §3.3 — apuração de um fechamento. */
export function apurarFechamento(e: EntradaApuracao): Apuracao {
  const gastoReal = e.saldoInicio + e.estruturais - e.saldoAtual;
  const economia = e.orcado - gastoReal;
  const resto = gastoReal - (e.provisaoReal ?? 0) - (e.gastosVariaveis ?? 0);
  return {
    gastoReal,
    economia,
    dentro: economia >= 0,
    naoCategorizado: Math.max(0, resto),
    entrouDinheiro: gastoReal < 0,
    lancamentosAcimaDoReal: gastoReal >= 0 && resto < 0,
  };
}

export interface ResultadoFechamento extends Apuracao {
  dataInicio: Data;
  dataFim: Data;
  dias: Data[];
  saldoInicio: Centavos;
  orcado: Centavos;
  estruturais: Centavos;
}

/** §3.3 + §3.4 — fecha todos os dias em aberto até `ate` com um único saldo. */
export function fecharPeriodo(
  e: EstadoCiclo,
  ate: Data,
  saldoAtual: Centavos,
  lancamentos: { provisaoReal?: Centavos; gastosVariaveis?: Centavos } = {},
): ResultadoFechamento {
  const dias = projetarAte(e, ate);
  const saldoInicio = base(e).saldo;
  const orcado = dias.reduce((t, d) => t + d.orcado, 0);
  const estruturais = dias.reduce((t, d) => t + d.estruturais, 0);
  return {
    ...apurarFechamento({ saldoInicio, saldoAtual, estruturais, orcado, ...lancamentos }),
    dataInicio: dias[0]!.data,
    dataFim: ate,
    dias: dias.map((d) => d.data),
    saldoInicio,
    orcado,
    estruturais,
  };
}
