import Dexie, { type EntityTable } from 'dexie';
import type { Centavos, Data, Recesso, RegraCarimbo, TipoMovimento } from '../engine';

/** Campos comuns: prontos para sincronizar com um servidor no futuro (§6). */
export interface Base {
  id: string;
  criadoEm: string;
  atualizadoEm: string;
  excluidoEm: string | null;
}

export interface CicloRow extends Base {
  titulo: string;
  dataInicio: Data;
  dataFim: Data;
  bufferDias: number;
  diasAtivos: number[];
  recessos: Recesso[];
  saldoInicial: Centavos;
  status: 'ATIVO' | 'CONCLUIDO';
}

export interface GastoFixoRow extends Base {
  descricao: string;
  valorUnitario: Centavos;
  qtdPadraoDia: number;
  ativo: boolean;
}

export interface ContaFixaRow extends Base {
  descricao: string;
  valor: Centavos;
  ativa: boolean;
}

export interface ContaCicloRow extends Base {
  cicloId: string;
  contaFixaId?: string;
  descricao: string;
  valor: Centavos;
  pagaEm?: Data;
  atrasada: boolean;
  /** RF16 — adiada para o próximo ciclo: sai do cálculo deste ciclo. */
  adiada?: boolean;
}

export interface RegistroFixoRow extends Base {
  cicloId: string;
  gastoFixoId: string;
  data: Data;
  qtd: number;
  valorTotal: Centavos;
}

export interface MovimentoRow extends Base {
  cicloId: string;
  data: Data;
  tipo: TipoMovimento;
  valor: Centavos;
  categoria?: string;
  descricao?: string;
  contaCicloId?: string;
  metaId?: string;
  fonteId?: string;
}

export interface MetaRow extends Base {
  /** GERAL = Cofrinho Geral (reserva de emergência, sem alvo). */
  tipo: 'GERAL' | 'META';
  titulo: string;
  valorObjetivo?: Centavos;
  dataAlvo?: Data;
  ativa: boolean;
}

export interface FonteRendaRow extends Base {
  nome: string;
  valorPrevisto?: Centavos;
  regraCarimbo: RegraCarimbo;
  metaDestinoId?: string;
  ativa: boolean;
}

export interface ReservaRow extends Base {
  cicloId: string;
  data: Data;
  descricao: string;
  valor: Centavos;
}

export interface FechamentoRow extends Base {
  cicloId: string;
  dataInicio: Data;
  dataFim: Data;
  saldoInicial: Centavos;
  saldoFinal: Centavos;
  estruturais: Centavos;
  orcado: Centavos;
  gastoReal: Centavos;
  economia: Centavos;
  naoCategorizado: Centavos;
  dentro: boolean;
}

export interface ConfigRow {
  id: 'config';
  ultimoBackupEm?: string;
  /** Streak com 1 dia de folga por semana (§3.9). Padrão: ligado. */
  folgaSemanal?: boolean;
  /** Segundas-feiras das semanas cujo fechamento semanal já foi decidido (§3.10). */
  semanasResolvidas?: Data[];
}

export class PilaDB extends Dexie {
  ciclos!: EntityTable<CicloRow, 'id'>;
  gastosFixos!: EntityTable<GastoFixoRow, 'id'>;
  contasFixas!: EntityTable<ContaFixaRow, 'id'>;
  contasCiclo!: EntityTable<ContaCicloRow, 'id'>;
  registrosFixos!: EntityTable<RegistroFixoRow, 'id'>;
  movimentos!: EntityTable<MovimentoRow, 'id'>;
  reservas!: EntityTable<ReservaRow, 'id'>;
  fechamentos!: EntityTable<FechamentoRow, 'id'>;
  config!: EntityTable<ConfigRow, 'id'>;
  metas!: EntityTable<MetaRow, 'id'>;
  fontesRenda!: EntityTable<FonteRendaRow, 'id'>;

  constructor(nome = 'pila') {
    super(nome);
    const v1 = {
      ciclos: 'id, status',
      gastosFixos: 'id',
      contasFixas: 'id',
      contasCiclo: 'id, cicloId',
      registrosFixos: 'id, cicloId, [gastoFixoId+data]',
      movimentos: 'id, cicloId, data',
      reservas: 'id, cicloId',
      fechamentos: 'id, cicloId, dataFim',
      config: 'id',
    };
    this.version(1).stores(v1);
    // Fase 3: metas, fontes de renda e índice de movimentos por meta.
    this.version(2).stores({ ...v1, movimentos: 'id, cicloId, data, metaId', metas: 'id', fontesRenda: 'id' });
  }
}

export const db = new PilaDB();

export const TABELAS = [
  'ciclos', 'gastosFixos', 'contasFixas', 'contasCiclo', 'registrosFixos',
  'movimentos', 'reservas', 'fechamentos', 'config', 'metas', 'fontesRenda',
] as const;

/** Cria os campos de sincronização de um registro novo. */
export function novo<T extends object>(dados: T): T & Base {
  const agora = new Date().toISOString();
  return { id: crypto.randomUUID(), criadoEm: agora, atualizadoEm: agora, excluidoEm: null, ...dados };
}

export const ativo = (r: { excluidoEm: string | null }) => r.excluidoEm === null;
export const carimboAgora = () => ({ atualizadoEm: new Date().toISOString() });
