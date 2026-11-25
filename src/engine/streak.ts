import { segundaDaSemana } from './datas';
import type { Data } from './tipos';

export interface DiaFechado {
  data: Data;
  dentro: boolean;
}

export interface PassoStreak {
  data: Data;
  streak: number;
  folgaUsada: boolean;
}

/**
 * §3.9 — dia dentro soma +1; dia fora usa a folga da semana (seg–dom) se houver,
 * senão zera. A folga não é gasta quando o Streak já está em 0.
 */
export function calcularStreak(
  dias: DiaFechado[],
  { folgaSemanal = true, inicial = 0 }: { folgaSemanal?: boolean; inicial?: number } = {},
): PassoStreak[] {
  const semanasComFolgaUsada = new Set<Data>();
  let streak = inicial;
  return [...dias]
    .sort((a, b) => a.data.localeCompare(b.data))
    .map(({ data, dentro }) => {
      let folgaUsada = false;
      if (dentro) streak++;
      else {
        const semana = segundaDaSemana(data);
        if (folgaSemanal && streak > 0 && !semanasComFolgaUsada.has(semana)) {
          semanasComFolgaUsada.add(semana);
          folgaUsada = true;
        } else streak = 0;
      }
      return { data, streak, folgaUsada };
    });
}
