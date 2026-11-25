import { useLiveQuery } from 'dexie-react-hooks';
import { ativo, db } from './db';
import type { DadosCiclo } from './estado';

/** Dados do ciclo ativo. undefined = carregando; null = nenhum ciclo ainda. */
export function usarDadosCiclo(): DadosCiclo | null | undefined {
  return useLiveQuery(async () => {
    const ciclo = await db.ciclos.where('status').equals('ATIVO').first();
    if (!ciclo) return null;
    const id = ciclo.id;
    const [contas, registros, movimentos, reservas, fechamentos, gastosFixos] = await Promise.all([
      db.contasCiclo.where('cicloId').equals(id).filter(ativo).toArray(),
      db.registrosFixos.where('cicloId').equals(id).filter(ativo).toArray(),
      db.movimentos.where('cicloId').equals(id).filter(ativo).toArray(),
      db.reservas.where('cicloId').equals(id).filter(ativo).toArray(),
      db.fechamentos.where('cicloId').equals(id).filter(ativo).toArray(),
      db.gastosFixos.filter((g) => ativo(g) && g.ativo).toArray(),
    ]);
    return { ciclo, gastosFixos, contas, registros, movimentos, reservas, fechamentos };
  });
}

export const usarConfig = () => useLiveQuery(() => db.config.get('config'));

/** Fechamentos de todos os ciclos: o Streak atravessa ciclos. */
export const usarTodosFechamentos = () => useLiveQuery(() => db.fechamentos.filter(ativo).toArray());

/** Modelos ativos para pré-preencher um ciclo novo. */
export const usarModelos = () =>
  useLiveQuery(async () => ({
    contas: (await db.contasFixas.toArray()).filter((c) => ativo(c) && c.ativa),
    gastos: (await db.gastosFixos.toArray()).filter((g) => ativo(g) && g.ativo),
  }));
