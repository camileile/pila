import { db, TABELAS } from './db';

// v2: metas e fontes de renda. Backups v1 continuam importando (tabelas novas vêm vazias).
const VERSAO = 2;

export async function exportarBackup(): Promise<Blob> {
  const tabelas: Record<string, unknown[]> = {};
  for (const t of TABELAS) tabelas[t] = await db.table(t).toArray();
  const conteudo = { app: 'pila', versao: VERSAO, exportadoEm: new Date().toISOString(), tabelas };
  await db.config.put({ id: 'config', ultimoBackupEm: conteudo.exportadoEm });
  return new Blob([JSON.stringify(conteudo)], { type: 'application/json' });
}

/** Substitui todos os dados pelos do backup. Lança erro se o arquivo não for um backup do Pila. */
export async function importarBackup(texto: string) {
  const dados = JSON.parse(texto) as { app?: string; versao?: number; tabelas?: Record<string, unknown[]> };
  if (dados.app !== 'pila' || !dados.tabelas) throw new Error('Esse arquivo não é um backup do Pila.');
  if ((dados.versao ?? 0) > VERSAO) throw new Error('Esse backup é de uma versão mais nova do app.');
  await db.transaction('rw', TABELAS.map((t) => db.table(t)), async () => {
    for (const t of TABELAS) {
      await db.table(t).clear();
      await db.table(t).bulkAdd(dados.tabelas![t] ?? []);
    }
  });
}
