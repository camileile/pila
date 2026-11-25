import { ultimoDia } from './ciclo';
import { tetoDoDia } from './teto';
import type { Centavos, Data, EstadoCiclo, Reserva } from './tipos';

export type ValidacaoReserva =
  | { ok: true }
  | { ok: false; motivo: 'VALOR_INVALIDO' | 'FORA_DO_CICLO' }
  | { ok: false; motivo: 'NAO_CABE'; maximo: Centavos };

/** §3.6 — Modo Rolê. */
export function validarReserva(e: EstadoCiclo, hoje: Data, r: Reserva): ValidacaoReserva {
  if (!Number.isInteger(r.valor) || r.valor <= 0) return { ok: false, motivo: 'VALOR_INVALIDO' };
  if (r.data < hoje || r.data > ultimoDia(e.ciclo)) return { ok: false, motivo: 'FORA_DO_CICLO' };
  const livre = tetoDoDia(e, hoje).resultado.livre;
  if (r.valor > livre) return { ok: false, motivo: 'NAO_CABE', maximo: Math.max(0, livre) };
  return { ok: true };
}

/** Reservas cujo dia já foi fechado passam a ser concluídas. */
export const reservaConcluida = (r: Reserva, fechadoAte: Data): boolean => r.data <= fechadoAte;
