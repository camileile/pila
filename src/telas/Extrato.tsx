import { useState } from 'react';
import { desfazerFechamento, excluirMovimento } from '../db/acoes';
import type { FechamentoRow, MovimentoRow } from '../db/db';
import { ultimoFechamento, type DadosCiclo } from '../db/estado';
import { usarMetas } from '../db/metas';
import { dataCurta, ddmm } from '../lib/formato';
import { Valor } from '../ui/componentes';

const ROTULO: Record<MovimentoRow['tipo'], string> = {
  ENTRADA_RENDA: 'Entrada',
  PAGAMENTO_CONTA: 'Conta paga',
  GASTO_VARIAVEL: 'Gasto',
  APORTE_META: 'Guardado em meta',
  RESGATE_META: 'Resgate de meta',
};

type Linha = { data: string; ordem: string; m?: MovimentoRow; f?: FechamentoRow };

/** RF14 — filtros por tipo de operação. */
const FILTROS = {
  todos: { rotulo: 'Tudo', aceita: () => true },
  gastos: { rotulo: 'Gastos', aceita: (l: Linha) => l.m?.tipo === 'GASTO_VARIAVEL' },
  entradas: { rotulo: 'Entradas', aceita: (l: Linha) => l.m?.tipo === 'ENTRADA_RENDA' },
  contas: { rotulo: 'Contas', aceita: (l: Linha) => l.m?.tipo === 'PAGAMENTO_CONTA' },
  metas: { rotulo: 'Metas', aceita: (l: Linha) => l.m?.tipo === 'APORTE_META' || l.m?.tipo === 'RESGATE_META' },
  fechamentos: { rotulo: 'Fechamentos', aceita: (l: Linha) => !!l.f },
} as const;
type Filtro = keyof typeof FILTROS;

export function Extrato({ d }: { d: DadosCiclo }) {
  const metas = usarMetas();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [categoria, setCategoria] = useState<string | null>(null);
  const nomeMeta = (id?: string) => metas?.find((m) => m.id === id)?.titulo;
  const ult = ultimoFechamento(d.fechamentos);
  const todas: Linha[] = [
    ...d.movimentos.map((m) => ({ data: m.data, ordem: m.criadoEm, m })),
    ...d.fechamentos.map((f) => ({ data: f.dataFim, ordem: f.criadoEm, f })),
  ].sort((a, b) => b.data.localeCompare(a.data) || b.ordem.localeCompare(a.ordem));
  const linhas = todas.filter((l) => FILTROS[filtro].aceita(l) && (filtro !== 'gastos' || !categoria || l.m?.categoria === categoria));

  // Total de gastos por categoria no ciclo (mais caro primeiro).
  const porCategoria = new Map<string, number>();
  for (const m of d.movimentos.filter((x) => x.tipo === 'GASTO_VARIAVEL'))
    porCategoria.set(m.categoria ?? 'Outros', (porCategoria.get(m.categoria ?? 'Outros') ?? 0) + m.valor);
  const categorias = [...porCategoria].sort((a, b) => b[1] - a[1]);
  const totalFiltrado = linhas.reduce((t, l) => t + (l.m?.valor ?? 0), 0);

  const porDia = new Map<string, Linha[]>();
  for (const l of linhas) porDia.set(l.data, [...(porDia.get(l.data) ?? []), l]);

  return (
    <>
      <div className="topo"><h1>Extrato</h1><span className="sub">{d.ciclo.titulo}</span></div>
      <div className="rolagem" role="group" aria-label="Filtrar por tipo">
        {(Object.keys(FILTROS) as Filtro[]).map((f) => (
          <button key={f} className="chip" aria-pressed={filtro === f} onClick={() => { setFiltro(f); setCategoria(null); }}>{FILTROS[f].rotulo}</button>
        ))}
      </div>
      {filtro === 'gastos' && categorias.length > 0 && (
        <section className="card" aria-label="Gastos por categoria">
          {categorias.map(([c, v]) => (
            <button key={c} className="item linha-botao" aria-pressed={categoria === c} onClick={() => setCategoria(categoria === c ? null : c)}>
              <span className="desc">{c}</span><Valor c={v} />
            </button>
          ))}
        </section>
      )}
      {filtro !== 'todos' && filtro !== 'fechamentos' && linhas.length > 0 && (
        <p className="sub">Total{categoria ? ` em ${categoria}` : ''}: <Valor c={totalFiltrado} /></p>
      )}
      {linhas.length === 0 && <div className="card"><p className="sub" style={{ margin: 0 }}>{todas.length ? 'Nada com esse filtro.' : 'Nada lançado neste ciclo ainda.'}</p></div>}
      {[...porDia].map(([data, itens]) => (
        <section key={data}>
          <div className="dia-extrato">{dataCurta(data)}</div>
          <div className="card">
            {itens.map((l) => l.m ? (
              <div key={l.m.id} className="item">
                <div className="desc">{l.m.categoria ?? l.m.descricao ?? ROTULO[l.m.tipo]}<small>{ROTULO[l.m.tipo]}{l.m.metaId && nomeMeta(l.m.metaId) ? ` · ${nomeMeta(l.m.metaId)}` : ''}</small></div>
                <Valor c={l.m.tipo === 'ENTRADA_RENDA' || l.m.tipo === 'RESGATE_META' ? l.m.valor : -l.m.valor}
                  className={l.m.tipo === 'ENTRADA_RENDA' ? 'positivo' : ''} />
                <button className="btn btn-peq btn-perigo" aria-label="Excluir lançamento"
                  onClick={() => confirm('Excluir este lançamento?') && void excluirMovimento(l.m!.id)}>✕</button>
              </div>
            ) : (
              <div key={l.f!.id} className="item">
                <div className="desc">
                  Fechamento {l.f!.dataInicio !== l.f!.dataFim && `${ddmm(l.f!.dataInicio)}–${ddmm(l.f!.dataFim)}`}
                  <small>Orçado <Valor c={l.f!.orcado} /> · gasto <Valor c={l.f!.gastoReal} /></small>
                </div>
                <Valor c={l.f!.economia} className={l.f!.dentro ? 'positivo' : 'alerta'} />
                {l.f!.id === ult?.id && (
                  <button className="btn btn-peq" aria-label="Desfazer fechamento"
                    onClick={() => confirm('Desfazer este fechamento? Os dias voltam a ficar em aberto.') && void desfazerFechamento(l.f!.id)}>↶</button>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
