import { useEffect, useState } from 'react';
import { aporteSugerido, progressoMeta, somarMeses, type Data } from '../engine';
import { aportarMeta, arquivarMeta, criarMeta, garantirCofrinhoGeral, resgatarMeta } from '../db/acoes';
import type { DadosCiclo } from '../db/estado';
import { usarMetas, type MetaComSaldo } from '../db/metas';
import { dataCurta, reais } from '../lib/formato';
import { CampoDinheiro, Folha, Valor } from '../ui/componentes';

type FolhaMeta = { tipo: 'nova' } | { tipo: 'mover'; meta: MetaComSaldo; modo: 'guardar' | 'resgatar' };

/** RF09 — metas com data-alvo e Cofrinho Geral. `dataMov` = null quando não há dia aberto no ciclo. */
export function Metas({ d, hoje, dataMov, avisar }: { d: DadosCiclo; hoje: Data; dataMov: Data | null; avisar: (m: string) => void }) {
  const metas = usarMetas();
  const [folha, setFolha] = useState<FolhaMeta | null>(null);
  useEffect(() => void garantirCofrinhoGeral(), []);
  if (!metas) return null;
  const total = metas.reduce((t, m) => t + m.saldo, 0);

  return (
    <>
      <div className="topo"><h1>Metas</h1><button className="btn btn-peq btn-primario" onClick={() => setFolha({ tipo: 'nova' })}>+ Nova meta</button></div>
      <div className="card card-teto">
        <div className="rotulo">Guardado em cofrinhos e metas</div>
        <div className="valor"><Valor c={total} /></div>
        <div style={{ fontSize: 14 }}>Esse dinheiro não entra no "Posso gastar hoje".</div>
      </div>
      {!dataMov && <div className="aviso atencao">O ciclo já foi todo fechado. Comece um novo ciclo para guardar ou resgatar.</div>}

      {metas.map((m) => {
        const pct = m.valorObjetivo ? progressoMeta(m.saldo, m.valorObjetivo) : 0;
        const falta = m.valorObjetivo ? m.valorObjetivo - m.saldo : 0;
        return (
          <section key={m.id} className="card" aria-label={m.titulo}>
            <div className="item" style={{ paddingTop: 0 }}>
              <div className="desc">
                <strong>{m.titulo}</strong>
                <small>{m.tipo === 'GERAL' ? 'Reserva para emergências' : `Até ${dataCurta(m.dataAlvo!)}`}</small>
              </div>
              <Valor c={m.saldo} />
            </div>
            {m.valorObjetivo !== undefined && (
              <>
                <div className="progresso" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${pct}% de ${m.titulo}`}>
                  <span style={{ width: `${pct}%` }} />
                </div>
                <p className="sub" style={{ margin: '8px 0 0' }}>
                  {pct}% de {reais(m.valorObjetivo)}
                  {falta > 0 ? ` · guarde ${reais(aporteSugerido(falta, hoje, m.dataAlvo!))} por mês para chegar lá` : ' · meta batida! 🎉'}
                </p>
              </>
            )}
            <div className="grupo" style={{ marginTop: 12 }}>
              <button className="btn btn-peq btn-primario" disabled={!dataMov} onClick={() => setFolha({ tipo: 'mover', meta: m, modo: 'guardar' })}>Guardar</button>
              <button className="btn btn-peq" disabled={!dataMov || m.saldo <= 0} onClick={() => setFolha({ tipo: 'mover', meta: m, modo: 'resgatar' })}>Resgatar</button>
              {m.tipo === 'META' && m.saldo === 0 && (
                <button className="btn-texto" onClick={() => confirm(`Arquivar a meta "${m.titulo}"?`) && void arquivarMeta(m.id)}>Arquivar</button>
              )}
            </div>
          </section>
        );
      })}

      {folha?.tipo === 'nova' && <FolhaNovaMeta hoje={hoje} aoFechar={() => setFolha(null)} avisar={avisar} />}
      {folha?.tipo === 'mover' && dataMov && (
        <FolhaMover d={d} data={dataMov} meta={folha.meta} modo={folha.modo} aoFechar={() => setFolha(null)} avisar={avisar} />
      )}
    </>
  );
}

function FolhaNovaMeta({ hoje, aoFechar, avisar }: { hoje: Data; aoFechar: () => void; avisar: (m: string) => void }) {
  const [titulo, setTitulo] = useState('');
  const [valor, setValor] = useState(0);
  const [dataAlvo, setDataAlvo] = useState(somarMeses(hoje, 3));
  const ok = titulo.trim() && valor > 0 && dataAlvo > hoje;
  return (
    <Folha titulo="Nova meta" aoFechar={aoFechar}>
      <label className="campo"><span>Objetivo</span>
        <input className="entrada" placeholder="Ex.: Viagem acadêmica" value={titulo} onChange={(e) => setTitulo(e.target.value)} autoFocus />
      </label>
      <label className="campo"><span>Quanto precisa juntar</span>
        <CampoDinheiro rotulo="Valor da meta" valor={valor} aoMudar={setValor} />
      </label>
      <label className="campo"><span>Até quando</span>
        <input type="date" className="entrada" min={hoje} value={dataAlvo} onChange={(e) => setDataAlvo(e.target.value)} />
      </label>
      {valor > 0 && dataAlvo > hoje && (
        <p className="sub">Guardando {reais(aporteSugerido(valor, hoje, dataAlvo))} por mês você chega lá.</p>
      )}
      <button className="btn btn-primario btn-bloco" disabled={!ok}
        onClick={async () => { await criarMeta(titulo.trim(), valor, dataAlvo); avisar('Meta criada.'); aoFechar(); }}>
        Criar meta
      </button>
    </Folha>
  );
}

function FolhaMover({ d, data, meta, modo, aoFechar, avisar }: {
  d: DadosCiclo; data: Data; meta: MetaComSaldo; modo: 'guardar' | 'resgatar'; aoFechar: () => void; avisar: (m: string) => void;
}) {
  const [valor, setValor] = useState(0);
  const guardar = modo === 'guardar';
  const invalido = valor <= 0 || (!guardar && valor > meta.saldo);
  return (
    <Folha titulo={`${guardar ? 'Guardar em' : 'Resgatar de'} ${meta.titulo}`} aoFechar={aoFechar}>
      <CampoDinheiro rotulo="Valor" grande autoFocus valor={valor} aoMudar={setValor} />
      <p className="sub">
        {guardar
          ? 'Transfira esse valor para a caixinha no app do banco. O teto dos próximos dias diminui.'
          : `Disponível: ${reais(meta.saldo)}. Traga o valor da caixinha para a conta. O teto dos próximos dias aumenta.`}
      </p>
      <button className="btn btn-primario btn-bloco" disabled={invalido}
        onClick={async () => {
          if (guardar) await aportarMeta(d.ciclo.id, data, meta.id, valor);
          else await resgatarMeta(d.ciclo.id, data, meta.id, valor);
          avisar(guardar ? `${reais(valor)} guardados em ${meta.titulo}.` : `${reais(valor)} resgatados.`);
          aoFechar();
        }}>
        {guardar ? 'Guardar' : 'Resgatar'}
      </button>
    </Folha>
  );
}
