import type { Centavos, Data, Movimento, RegraCarimbo } from './tipos';

/** Retorna uma mensagem de erro, ou null se a regra for válida. */
export function validarRegraCarimbo(r: RegraCarimbo): string | null {
  if (r.tipo === 'PERCENTUAL' && !(r.valor >= 0 && r.valor <= 100))
    return 'O percentual precisa estar entre 0 e 100.';
  if (r.tipo === 'FIXO' && !(Number.isInteger(r.valor) && r.valor >= 0))
    return 'O valor fixo precisa ser zero ou positivo.';
  return null;
}

/** §3.5 — "Caiu, Guardou". */
export function calcularCarimbo(bruto: Centavos, regra: RegraCarimbo) {
  const erro = validarRegraCarimbo(regra);
  if (erro) throw new RangeError(erro);
  if (!Number.isInteger(bruto) || bruto < 0) throw new RangeError('Valor recebido inválido.');

  let carimbo = 0;
  if (regra.tipo === 'PERCENTUAL') carimbo = Math.round((bruto * regra.valor) / 100);
  if (regra.tipo === 'FIXO') carimbo = Math.min(regra.valor, bruto);
  return { carimbo, liquido: bruto - carimbo };
}

/** Movimentos gerados ao registrar uma renda: entrada bruta + aporte do carimbo. */
export function movimentosDaRenda(
  data: Data,
  bruto: Centavos,
  regra: RegraCarimbo,
  metaId?: string,
): Movimento[] {
  const { carimbo } = calcularCarimbo(bruto, regra);
  const movs: Movimento[] = [{ data, tipo: 'ENTRADA_RENDA', valor: bruto }];
  if (carimbo > 0) movs.push({ data, tipo: 'APORTE_META', valor: carimbo, metaId });
  return movs;
}
