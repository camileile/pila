import type { Centavos, FaixaTermometro } from './tipos';

export interface EntradaDia {
  teto: Centavos;
  provisaoPadrao: Centavos;
  /** Valor do checklist; se ausente, vale a provisão padrão. */
  provisaoReal?: Centavos;
  reservaHoje?: Centavos;
  gastosVariaveis?: Centavos;
}

export interface EstadoDia {
  economiaFixo: Centavos;
  /** Total livre do dia (teto + economia do fixo + reserva). */
  disponivel: Centavos;
  resta: Centavos;
  orcado: Centavos;
  faixa: FaixaTermometro;
}

/** Termômetro: ≥ 50% restante = positivo; 0–50% = atenção; negativo = alerta. */
export function faixaTermometro(resta: Centavos, disponivel: Centavos): FaixaTermometro {
  if (resta < 0) return 'alerta';
  if (disponivel > 0 && resta * 2 >= disponivel) return 'positivo';
  return 'atencao';
}

/** §3.2 — o que o dashboard mostra durante o dia. */
export function estadoDoDia(e: EntradaDia): EstadoDia {
  const reserva = e.reservaHoje ?? 0;
  const economiaFixo = e.provisaoPadrao - (e.provisaoReal ?? e.provisaoPadrao);
  const disponivel = e.teto + economiaFixo + reserva;
  const resta = disponivel - (e.gastosVariaveis ?? 0);
  return {
    economiaFixo,
    disponivel,
    resta,
    orcado: e.provisaoPadrao + e.teto + reserva,
    faixa: faixaTermometro(resta, disponivel),
  };
}
