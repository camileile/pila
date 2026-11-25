import { useState } from 'react';
import { calcularCarimbo, type Data, type RegraCarimbo } from '../engine';
import { registrarRenda, removerFonte, salvarFonte } from '../db/acoes';
import type { FonteRendaRow } from '../db/db';
import type { DadosCiclo } from '../db/estado';
import { usarFontes, usarMetas, type MetaComSaldo } from '../db/metas';
import { reais } from '../lib/formato';
import { CampoDinheiro, Folha, Valor } from '../ui/componentes';

const descreverRegra = (r: RegraCarimbo, meta?: MetaComSaldo) =>
  r.tipo === 'NENHUMA' || !meta ? 'Sem separação automática'
    : `${r.tipo === 'PERCENTUAL' ? `${r.valor}%` : reais(r.valor)} vai para ${meta.titulo}`;

/** D1 — rendas previstas que ainda não caíram neste ciclo. Não entram no teto. */
export function AReceber({ d, aoReceber }: { d: DadosCiclo; aoReceber: (fonteId: string) => void }) {
  const fontes = usarFontes();
  const pendentes = (fontes ?? []).filter((f) => f.valorPrevisto &&
    !d.movimentos.some((m) => m.tipo === 'ENTRADA_RENDA' && m.fonteId === f.id));
  if (!pendentes.length) return null;
  return (
    <section className="card" aria-label="A receber">
      <h2>A receber</h2>
      <p className="sub" style={{ marginTop: -6 }}>Só entra no teto quando cair na conta.</p>
      {pendentes.map((f) => (
        <div key={f.id} className="item">
          <div className="desc">{f.nome}</div>
          <Valor c={f.valorPrevisto!} />
          <button className="btn btn-peq" onClick={() => aoReceber(f.id)}>Caiu</button>
        </div>
      ))}
    </section>
  );
}

/** Lista de fontes para a tela Mais. */
export function CartaoFontes() {
  const fontes = usarFontes();
  const metas = usarMetas();
  const [editando, setEditando] = useState<FonteRendaRow | 'nova' | null>(null);
  return (
    <section className="card">
      <h2>Fontes de renda</h2>
      {!fontes?.length && <p className="sub" style={{ marginTop: 0 }}>Cadastre bolsas e auxílios para usar o "Caiu, Guardou".</p>}
      {fontes?.map((f) => (
        <div key={f.id} className="item">
          <div className="desc">{f.nome}<small>{descreverRegra(f.regraCarimbo, metas?.find((m) => m.id === f.metaDestinoId))}</small></div>
          {f.valorPrevisto ? <Valor c={f.valorPrevisto} /> : null}
          <button className="btn btn-peq" onClick={() => setEditando(f)}>Editar</button>
        </div>
      ))}
      <button className="btn btn-peq" style={{ marginTop: 8 }} onClick={() => setEditando('nova')}>+ Adicionar fonte</button>
      {editando && metas && <FolhaFonte fonte={editando === 'nova' ? undefined : editando} metas={metas} aoFechar={() => setEditando(null)} />}
    </section>
  );
}

function FolhaFonte({ fonte, metas, aoFechar }: { fonte?: FonteRendaRow; metas: MetaComSaldo[]; aoFechar: () => void }) {
  const [nome, setNome] = useState(fonte?.nome ?? '');
  const [previsto, setPrevisto] = useState(fonte?.valorPrevisto ?? 0);
  const [regra, setRegra] = useState<RegraCarimbo>(fonte?.regraCarimbo ?? { tipo: 'NENHUMA' });
  const [metaId, setMetaId] = useState(fonte?.metaDestinoId ?? metas.find((m) => m.tipo === 'META')?.id ?? metas[0]?.id ?? '');
  const ok = nome.trim() && (regra.tipo === 'NENHUMA' || (metaId && regra.valor > 0 && (regra.tipo !== 'PERCENTUAL' || regra.valor <= 100)));

  return (
    <Folha titulo={fonte ? 'Editar fonte' : 'Nova fonte de renda'} aoFechar={aoFechar}>
      <label className="campo"><span>Nome</span>
        <input className="entrada" placeholder="Ex.: Bolsa NEABI" value={nome} onChange={(e) => setNome(e.target.value)} />
      </label>
      <label className="campo"><span>Valor esperado (opcional)</span>
        <CampoDinheiro rotulo="Valor esperado" valor={previsto} aoMudar={setPrevisto} />
      </label>
      <div className="campo"><span style={{ display: 'block', fontWeight: 500, marginBottom: 6 }}>Caiu, Guardou</span>
        <div className="grupo" role="group" aria-label="Regra de separação">
          <button className="chip" aria-pressed={regra.tipo === 'NENHUMA'} onClick={() => setRegra({ tipo: 'NENHUMA' })}>Não separar</button>
          <button className="chip" aria-pressed={regra.tipo === 'PERCENTUAL'} onClick={() => setRegra({ tipo: 'PERCENTUAL', valor: 20 })}>Porcentagem</button>
          <button className="chip" aria-pressed={regra.tipo === 'FIXO'} onClick={() => setRegra({ tipo: 'FIXO', valor: 10000 })}>Valor fixo</button>
        </div>
      </div>
      {regra.tipo !== 'NENHUMA' && (
        <>
          {regra.tipo === 'PERCENTUAL' ? (
            <label className="campo"><span>Quanto separar (%)</span>
              <input className="entrada num" inputMode="numeric" value={regra.valor}
                onChange={(e) => setRegra({ tipo: 'PERCENTUAL', valor: Math.min(100, Number(e.target.value.replace(/\D/g, '') || 0)) })} />
            </label>
          ) : (
            <label className="campo"><span>Quanto separar (R$)</span>
              <CampoDinheiro rotulo="Valor fixo a separar" valor={regra.valor} aoMudar={(v) => setRegra({ tipo: 'FIXO', valor: v })} />
            </label>
          )}
          <label className="campo"><span>Para qual meta</span>
            <select className="entrada" value={metaId} onChange={(e) => setMetaId(e.target.value)}>
              {metas.map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
            </select>
          </label>
          {previsto > 0 && (
            <p className="sub">Com {reais(previsto)}: {reais(calcularCarimbo(previsto, regra).carimbo)} guardados e {reais(calcularCarimbo(previsto, regra).liquido)} livres.</p>
          )}
        </>
      )}
      <div className="grupo">
        {fonte && <button className="btn btn-perigo" onClick={async () => { await removerFonte(fonte.id); aoFechar(); }}>Remover</button>}
        <button className="btn btn-primario" style={{ flex: 1 }} disabled={!ok}
          onClick={async () => {
            await salvarFonte({
              id: fonte?.id, nome: nome.trim(), valorPrevisto: previsto || undefined, regraCarimbo: regra,
              metaDestinoId: regra.tipo === 'NENHUMA' ? undefined : metaId,
            });
            aoFechar();
          }}>Salvar</button>
      </div>
    </Folha>
  );
}

/** UC02 — registrar entrada, com o carimbo calculado sobre o valor que caiu de fato. */
export function FolhaEntrada({ d, data, fonteInicial, aoFechar, avisar }: {
  d: DadosCiclo; data: Data; fonteInicial?: string; aoFechar: () => void; avisar: (m: string) => void;
}) {
  const fontes = usarFontes();
  const metas = usarMetas();
  const [fonteId, setFonteId] = useState<string>(fonteInicial ?? '');
  const [valor, setValor] = useState<number | null>(null);
  const [descricao, setDescricao] = useState('');
  if (!fontes || !metas) return null;

  const fonte = fontes.find((f) => f.id === fonteId);
  const bruto = valor ?? fonte?.valorPrevisto ?? 0;
  const meta = metas.find((m) => m.id === fonte?.metaDestinoId);
  const regra: RegraCarimbo = fonte && meta ? fonte.regraCarimbo : { tipo: 'NENHUMA' };
  const { carimbo, liquido } = calcularCarimbo(bruto, regra);

  return (
    <Folha titulo="Entrou dinheiro" aoFechar={aoFechar}>
      {fontes.length > 0 && (
        <div className="grupo" role="group" aria-label="Fonte" style={{ marginBottom: 16 }}>
          {fontes.map((f) => (
            <button key={f.id} className="chip" aria-pressed={f.id === fonteId} onClick={() => { setFonteId(f.id); setValor(null); }}>{f.nome}</button>
          ))}
          <button className="chip" aria-pressed={!fonteId} onClick={() => setFonteId('')}>Outra</button>
        </div>
      )}
      <CampoDinheiro rotulo="Valor recebido" grande autoFocus valor={bruto} aoMudar={setValor} />
      {!fonte && (
        <label className="campo" style={{ marginTop: 16 }}><span>De onde veio?</span>
          <input className="entrada" placeholder="Ex.: Pix da família" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </label>
      )}
      {carimbo > 0 && meta && (
        <div className="aviso positivo" style={{ display: 'block', marginTop: 16 }}>
          <strong>Caiu, Guardou:</strong> {reais(carimbo)} vão para {meta.titulo} e {reais(liquido)} ficam livres.
          <div style={{ marginTop: 6 }}>Lembre de mover {reais(carimbo)} para a caixinha no app do banco.</div>
        </div>
      )}
      <button className="btn btn-primario btn-bloco" style={{ marginTop: 12 }} disabled={bruto <= 0}
        onClick={async () => {
          await registrarRenda(d.ciclo.id, data, bruto, {
            descricao: fonte?.nome ?? (descricao.trim() || 'Entrada'), fonteId: fonte?.id, regra, metaId: meta?.id,
          });
          avisar(carimbo > 0 ? `Entrada registrada. Mova ${reais(carimbo)} para ${meta!.titulo}.` : `Entrada de ${reais(bruto)} registrada.`);
          aoFechar();
        }}>
        Registrar
      </button>
    </Folha>
  );
}
