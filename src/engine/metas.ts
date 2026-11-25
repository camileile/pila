import { ultimoDia } from './ciclo';
import { mesesInteiros, proximoSabado } from './datas';
import type { Centavos, Ciclo, ContaCiclo, Data, Movimento, Reserva } from './tipos';

/** §3.8 — saldo de uma meta = aportes − resgates. */
export function saldoMeta(movimentos: Movimento[], metaId: string): Centavos {
  return movimentos
    .filter((m) => m.metaId === metaId)
    .reduce((t, m) => t + (m.tipo === 'APORTE_META' ? m.valor : m.tipo === 'RESGATE_META' ? -m.valor : 0), 0);
}

/** Progresso em % (0–100), arredondado para baixo. */
export const progressoMeta = (saldo: Centavos, objetivo: Centavos): number =>
  objetivo > 0 ? Math.min(100, Math.floor((saldo * 100) / objetivo)) : 0;

/** Aporte mensal sugerido: ceil(falta / meses restantes), com no mínimo 1 mês. */
export function aporteSugerido(falta: Centavos, hoje: Data, dataAlvo: Data): Centavos {
  if (falta <= 0) return 0;
  return Math.ceil(falta / Math.max(1, mesesInteiros(hoje, dataAlvo)));
}

/** §3.10 — opções do fechamento semanal; null quando não houve economia. */
export function opcoesFechamentoSemanal(economiaSemana: Centavos, ciclo: Ciclo, hoje: Data) {
  if (economiaSemana <= 0) return null;
  const sabado = proximoSabado(hoje);
  const bonus: Reserva | null = sabado <= ultimoDia(ciclo) ? { data: sabado, valor: economiaSemana } : null;
  return { valor: economiaSemana, bonus };
}

/** §3.11 — encerramento do ciclo. */
export function encerrarCiclo(saldoFinal: Centavos, contas: ContaCiclo[], pctParaMeta = 0) {
  if (!(pctParaMeta >= 0 && pctParaMeta <= 100)) throw new RangeError('Percentual inválido.');
  const pendentes = contas.filter((c) => !c.pagaEm);
  const sobra = saldoFinal - pendentes.reduce((t, c) => t + c.valor, 0);
  const aporte = sobra > 0 ? Math.round((sobra * pctParaMeta) / 100) : 0;
  return {
    sobra,
    aporte,
    saldoInicialNovoCiclo: saldoFinal - aporte,
    contasAtrasadas: pendentes.map((c) => ({ ...c, atrasada: true as const })),
  };
}
