import { diaDaSemana, diferencaDias, intervalo, somarDias } from './datas';
import type { Centavos, Ciclo, Data, GastoFixoDiario } from './tipos';

/** Último dia do ciclo, já com o buffer "Ficar de Boa" (D9). */
export const ultimoDia = (c: Ciclo): Data => somarDias(c.dataFim, c.bufferDias);

export const dentroDoCiclo = (c: Ciclo, d: Data): boolean => c.dataInicio <= d && d <= ultimoDia(c);

export const emRecesso = (c: Ciclo, d: Data): boolean =>
  c.recessos.some((r) => r.dataInicio <= d && d <= r.dataFim);

/** Dia ativo = dia da semana marcado e fora de recesso. */
export const ehDiaAtivo = (c: Ciclo, d: Data): boolean =>
  c.diasAtivos.includes(diaDaSemana(d)) && !emRecesso(c, d);

/** Provisão padrão dos gastos fixos diários em `d` (0 em dia não ativo). */
export function provisaoPadraoDia(c: Ciclo, gastos: GastoFixoDiario[], d: Data): Centavos {
  if (!ehDiaAtivo(c, d)) return 0;
  return gastos.reduce((t, g) => t + g.valorUnitario * g.qtdPadraoDia, 0);
}

/** Soma da provisão padrão de `d` até o último dia do ciclo. */
export const provisaoRestante = (c: Ciclo, gastos: GastoFixoDiario[], d: Data): Centavos =>
  intervalo(d, ultimoDia(c)).reduce((t, x) => t + provisaoPadraoDia(c, gastos, x), 0);

/** Dias corridos de `d` até o último dia do ciclo, incluindo os dois (D8). */
export const diasRestantes = (c: Ciclo, d: Data): number => diferencaDias(d, ultimoDia(c)) + 1;
