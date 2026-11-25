import { useLiveQuery } from 'dexie-react-hooks';
import { saldoMeta, type Centavos } from '../engine';
import { ativo, db, type FonteRendaRow, type MetaRow, type MovimentoRow } from './db';

export interface MetaComSaldo extends MetaRow {
  saldo: Centavos;
}

/** Saldo de cada meta somando todos os ciclos (§3.8). */
export function metasComSaldo(metas: MetaRow[], movimentos: MovimentoRow[]): MetaComSaldo[] {
  const movs = movimentos.filter(ativo);
  return metas
    .filter((m) => ativo(m) && m.ativa)
    .map((m) => ({ ...m, saldo: saldoMeta(movs, m.id) }))
    .sort((a, b) => (a.tipo === 'GERAL' ? -1 : b.tipo === 'GERAL' ? 1 : (a.dataAlvo ?? '').localeCompare(b.dataAlvo ?? '')));
}

export const usarMetas = () =>
  useLiveQuery(async () =>
    metasComSaldo(await db.metas.toArray(), await db.movimentos.where('metaId').above('').toArray()),
  );

export const usarFontes = () =>
  useLiveQuery(async (): Promise<FonteRendaRow[]> => (await db.fontesRenda.toArray()).filter((f) => ativo(f) && f.ativa));
