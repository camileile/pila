/** Valores monetários sempre em centavos inteiros (D11). */
export type Centavos = number;
/** Data local no formato YYYY-MM-DD (D12). */
export type Data = string;

export interface Recesso {
  dataInicio: Data;
  dataFim: Data;
}

export interface Ciclo {
  dataInicio: Data;
  dataFim: Data;
  /** Dias corridos somados após dataFim (D9). */
  bufferDias: number;
  /** Dias da semana ativos: 0 = domingo … 6 = sábado. */
  diasAtivos: number[];
  recessos: Recesso[];
  saldoInicial: Centavos;
}

export interface GastoFixoDiario {
  valorUnitario: Centavos;
  qtdPadraoDia: number;
}

export interface ContaCiclo {
  valor: Centavos;
  /** Data em que foi paga; ausente = pendente. */
  pagaEm?: Data;
}

export interface Reserva {
  data: Data;
  valor: Centavos;
}

export type TipoMovimento =
  | 'ENTRADA_RENDA'
  | 'PAGAMENTO_CONTA'
  | 'APORTE_META'
  | 'RESGATE_META'
  | 'GASTO_VARIAVEL';

export interface Movimento {
  data: Data;
  tipo: TipoMovimento;
  valor: Centavos;
  metaId?: string;
}

export interface FechamentoBase {
  /** Último dia coberto pelo fechamento. */
  data: Data;
  /** Saldo livre informado no fechamento. */
  saldo: Centavos;
}

/** Tudo que o motor precisa saber sobre o ciclo ativo. */
export interface EstadoCiclo {
  ciclo: Ciclo;
  gastosFixos: GastoFixoDiario[];
  contas: ContaCiclo[];
  reservas: Reserva[];
  movimentos: Movimento[];
  ultimoFechamento: FechamentoBase | null;
}

export type RegraCarimbo =
  | { tipo: 'NENHUMA' }
  | { tipo: 'PERCENTUAL'; valor: number }
  | { tipo: 'FIXO'; valor: Centavos };

export type FaixaTermometro = 'positivo' | 'atencao' | 'alerta';
