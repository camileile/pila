import type { Centavos } from './tipos';

/**
 * RF16 — modo aperto: quais contas pendentes adiar para cobrir o déficit.
 * Escolhe o conjunto com MENOS contas e, entre esses, o de MENOR soma (adiar só o necessário).
 * Retorna os índices das contas; vazio se não há déficit ou se nem adiando todas ele é coberto.
 * Busca exaustiva: uma pessoa tem poucas contas fixas (limitado a 15 por segurança).
 */
export function sugerirAdiamento(valores: Centavos[], deficit: Centavos): number[] {
  if (deficit <= 0) return [];
  const n = Math.min(valores.length, 15);
  let melhor: { mascara: number; qtd: number; soma: number } | null = null;
  for (let mascara = 1; mascara < 1 << n; mascara++) {
    let soma = 0, qtd = 0;
    for (let i = 0; i < n; i++) if (mascara & (1 << i)) { soma += valores[i]!; qtd++; }
    if (soma < deficit) continue;
    if (!melhor || qtd < melhor.qtd || (qtd === melhor.qtd && soma < melhor.soma)) melhor = { mascara, qtd, soma };
  }
  if (!melhor) return [];
  return [...Array(n).keys()].filter((i) => melhor!.mascara & (1 << i));
}
