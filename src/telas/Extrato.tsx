import { desfazerFechamento, excluirMovimento } from '../db/acoes';
import type { FechamentoRow, MovimentoRow } from '../db/db';
import { ultimoFechamento, type DadosCiclo } from '../db/estado';
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

export function Extrato({ d }: { d: DadosCiclo }) {
  const ult = ultimoFechamento(d.fechamentos);
  const linhas: Linha[] = [
    ...d.movimentos.map((m) => ({ data: m.data, ordem: m.criadoEm, m })),
    ...d.fechamentos.map((f) => ({ data: f.dataFim, ordem: f.criadoEm, f })),
  ].sort((a, b) => b.data.localeCompare(a.data) || b.ordem.localeCompare(a.ordem));

  const porDia = new Map<string, Linha[]>();
  for (const l of linhas) porDia.set(l.data, [...(porDia.get(l.data) ?? []), l]);

  return (
    <>
      <div className="topo"><h1>Extrato</h1><span className="sub">{d.ciclo.titulo}</span></div>
      {linhas.length === 0 && <div className="card"><p className="sub" style={{ margin: 0 }}>Nada lançado neste ciclo ainda.</p></div>}
      {[...porDia].map(([data, itens]) => (
        <section key={data}>
          <div className="dia-extrato">{dataCurta(data)}</div>
          <div className="card">
            {itens.map((l) => l.m ? (
              <div key={l.m.id} className="item">
                <div className="desc">{l.m.categoria ?? l.m.descricao ?? ROTULO[l.m.tipo]}<small>{ROTULO[l.m.tipo]}</small></div>
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
