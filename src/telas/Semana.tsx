import { useState } from 'react';
import { opcoesFechamentoSemanal, sugerirAdiamento, type Centavos, type Data } from '../engine';
import { adiarConta, agendarRole, aportarMeta, garantirCofrinhoGeral, resolverSemana } from '../db/acoes';
import type { ConfigRow } from '../db/db';
import { dataLancamento, semanaParaFechar, type DadosCiclo } from '../db/estado';
import { usarMetas } from '../db/metas';
import { dataCurta, ddmm, reais } from '../lib/formato';
import { Valor } from '../ui/componentes';

/** RF12 — no domingo (ou na volta depois dele), decide o destino da economia da semana. */
export function FechamentoSemanal({ d, hoje, config, avisar }: {
  d: DadosCiclo; hoje: Data; config?: ConfigRow; avisar: (m: string) => void;
}) {
  const metas = usarMetas();
  const [pct, setPct] = useState(50);
  const [metaId, setMetaId] = useState('');
  const semana = semanaParaFechar(d, hoje, config?.semanasResolvidas);
  if (!semana || !metas) return null;

  const data = dataLancamento(d, hoje);
  const opcoes = opcoesFechamentoSemanal(semana.economia, d.ciclo, hoje);
  const destino = metaId || metas.find((m) => m.tipo === 'META')?.id || metas[0]?.id || '';
  const parte = Math.round((semana.economia * pct) / 100);

  async function concluir(acao: () => Promise<unknown>, mensagem: string) {
    await acao();
    await resolverSemana(semana!.segunda);
    avisar(mensagem);
  }

  return (
    <section className="card" aria-label="Fechamento da semana" style={{ borderColor: 'var(--azul)' }}>
      <h2>Fechamento da semana</h2>
      <p style={{ marginTop: -6 }}>
        Mandou bem! De {ddmm(semana.segunda)} a {ddmm(semana.domingo)} você economizou <strong><Valor c={semana.economia} /></strong>.
      </p>
      {data ? (
        <>
          <div className="grupo" role="group" aria-label="Quanto mover" style={{ marginBottom: 10 }}>
            {[25, 50, 100].map((p) => <button key={p} className="chip" aria-pressed={pct === p} onClick={() => setPct(p)}>{p}%</button>)}
            <select className="entrada" style={{ width: 'auto', minHeight: 44 }} aria-label="Meta" value={destino} onChange={(e) => setMetaId(e.target.value)}>
              {metas.map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
            </select>
          </div>
          <div className="grupo">
            <button className="btn btn-peq btn-primario" disabled={!destino}
              onClick={() => concluir(() => aportarMeta(d.ciclo.id, data, destino, parte, 'Economia da semana'),
                `${reais(parte)} movidos. Transfira para a caixinha.`)}>
              Mover {reais(parte)}
            </button>
            <button className="btn btn-peq"
              onClick={() => concluir(async () => aportarMeta(d.ciclo.id, data, await garantirCofrinhoGeral(), semana.economia, 'Economia da semana'),
                `${reais(semana.economia)} guardados no Cofrinho Geral.`)}>
              Guardar tudo
            </button>
            {opcoes?.bonus && (
              <button className="btn btn-peq btn-limao"
                onClick={() => concluir(() => agendarRole(d, data, { ...opcoes.bonus!, descricao: 'Bônus de fim de semana' }),
                  `Bônus de ${reais(semana.economia)} para ${dataCurta(opcoes.bonus!.data)}.`)}>
                Bônus no sábado
              </button>
            )}
          </div>
        </>
      ) : (
        <p className="sub">O ciclo já foi todo fechado; a economia fica no saldo.</p>
      )}
      <button className="btn-texto" style={{ paddingLeft: 0 }} onClick={() => concluir(async () => {}, 'Tudo certo. A economia fica diluída nos próximos dias.')}>
        Deixar como está
      </button>
    </section>
  );
}

/** RF16 — quando o saldo não cobre tudo: mostra o déficit e sugere quais contas adiar. */
export function ModoAperto({ d, deficit }: { d: DadosCiclo; deficit: Centavos }) {
  const pendentes = d.contas.filter((c) => !c.pagaEm && !c.adiada);
  const sugeridas = new Set(sugerirAdiamento(pendentes.map((c) => c.valor), deficit).map((i) => pendentes[i]!.id));
  return (
    <section className="aviso alerta" style={{ display: 'block' }} aria-label="Modo aperto">
      <strong>Seu saldo não cobre todos os compromissos.</strong> Faltam {reais(deficit)} até o fim do ciclo.
      {pendentes.length > 0 && (
        <>
          <p style={{ margin: '8px 0' }}>
            {sugeridas.size ? 'Adiar estas contas para o próximo ciclo resolveria:' : 'Mesmo adiando as contas, ainda falta. Confira se o saldo está certo ou se entrou alguma renda.'}
          </p>
          {pendentes.map((c) => (
            <div key={c.id} className="item" style={{ borderColor: 'rgba(185,28,28,.2)' }}>
              <div className="desc">{c.descricao}{sugeridas.has(c.id) && <small className="alerta">Sugerida</small>}</div>
              <Valor c={c.valor} />
              <button className="btn btn-peq" onClick={() => void adiarConta(c.id)}>Adiar</button>
            </div>
          ))}
        </>
      )}
    </section>
  );
}
