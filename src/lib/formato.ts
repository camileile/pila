import { hojeEmSaoPaulo, type Centavos, type Data } from '../engine';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 1234 → "R$ 12,34" */
export const reais = (c: Centavos): string => brl.format(c / 100).replace(/ /g, ' ');

/** Texto por extenso para leitores de tela: "12 reais e 34 centavos". */
export function reaisPorExtenso(c: Centavos): string {
  const sinal = c < 0 ? 'menos ' : '';
  const abs = Math.abs(c);
  const r = Math.floor(abs / 100), cent = abs % 100;
  const partes = [];
  if (r || !cent) partes.push(`${r} ${r === 1 ? 'real' : 'reais'}`);
  if (cent) partes.push(`${cent} ${cent === 1 ? 'centavo' : 'centavos'}`);
  return sinal + partes.join(' e ');
}

/** Mantém só os dígitos e interpreta como centavos ("1250" → 1250). */
export const centavosDeDigitos = (texto: string): Centavos => Number(texto.replace(/\D/g, '').slice(-9) || '0');

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "2026-03-02" → "Seg, 02 mar" */
export function dataCurta(d: Data): string {
  const [a, m, dia] = d.split('-').map(Number) as [number, number, number];
  const semana = new Date(Date.UTC(a, m - 1, dia)).getUTCDay();
  return `${DIAS[semana]}, ${String(dia).padStart(2, '0')} ${MESES[m - 1]}`;
}

/** "2026-03-02" → "02/03" */
export const ddmm = (d: Data) => d.split('-').reverse().slice(0, 2).join('/');

/**
 * Data de hoje no app. Em desenvolvimento aceita ?hoje=AAAA-MM-DD para simular outros dias.
 */
export function hojeApp(): Data {
  if (import.meta.env.DEV) {
    const p = new URLSearchParams(location.search).get('hoje');
    if (p && /^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
  }
  return hojeEmSaoPaulo();
}
