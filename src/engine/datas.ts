import type { Data } from './tipos';

// Toda a aritmética é feita em dias UTC a partir da string, sem depender do fuso da máquina.
const MS_DIA = 86_400_000;

function paraDias(d: Data): number {
  const [a, m, dia] = d.split('-').map(Number) as [number, number, number];
  return Date.UTC(a, m - 1, dia) / MS_DIA;
}

function deDias(n: number): Data {
  return new Date(n * MS_DIA).toISOString().slice(0, 10);
}

export const somarDias = (d: Data, n: number): Data => deDias(paraDias(d) + n);

/** Quantos dias de `a` até `b` (b − a). */
export const diferencaDias = (a: Data, b: Data): number => paraDias(b) - paraDias(a);

/** 0 = domingo … 6 = sábado. */
export const diaDaSemana = (d: Data): number => new Date(paraDias(d) * MS_DIA).getUTCDay();

/** Datas de `inicio` a `fim`, incluindo as duas. */
export function intervalo(inicio: Data, fim: Data): Data[] {
  const dias: Data[] = [];
  for (let n = paraDias(inicio), f = paraDias(fim); n <= f; n++) dias.push(deDias(n));
  return dias;
}

/** Segunda-feira da semana (seg–dom) que contém `d`. */
export const segundaDaSemana = (d: Data): Data => somarDias(d, -((diaDaSemana(d) + 6) % 7));

/** Primeiro sábado estritamente depois de `d`. */
export const proximoSabado = (d: Data): Data => somarDias(d, ((6 - diaDaSemana(d) + 6) % 7) + 1);

/** Soma meses mantendo o dia; se o mês não tiver esse dia, usa o último dia do mês. */
export function somarMeses(d: Data, meses: number): Data {
  const [a, m, dia] = d.split('-').map(Number) as [number, number, number];
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimo));
  return alvo.toISOString().slice(0, 10);
}

/** Meses inteiros completos de `de` até `ate`. */
export function mesesInteiros(de: Data, ate: Data): number {
  let m = 0;
  while (somarMeses(de, m + 1) <= ate) m++;
  return m;
}

/** "Hoje" no fuso de São Paulo (D12). */
export function hojeEmSaoPaulo(agora: Date = new Date()): Data {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
}
