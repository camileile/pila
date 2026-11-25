import { useState } from 'react';
import { fecharPeriodo, type Data } from '../engine';
import { fecharDia, lancarGasto, registrarEntrada } from '../db/acoes';
import { lancamentosAte, montarEstado, type DadosCiclo } from '../db/estado';
import { dataCurta, reais } from '../lib/formato';
import { CampoDinheiro, Folha, Valor } from '../ui/componentes';
import { mensagemFechamento } from './Hoje';

export const CATEGORIAS = ['Alimentação', 'Lazer', 'Delivery', 'Transporte', 'Outros'];

/** RF06 — 3 toques: abrir, digitar valor, salvar (categoria já vem marcada). */
export function FolhaGasto({ d, hoje, aoFechar, avisar }: { d: DadosCiclo; hoje: Data; aoFechar: () => void; avisar: (m: string) => void }) {
  const [valor, setValor] = useState(0);
  const [categoria, setCategoria] = useState(CATEGORIAS[0]!);
  return (
    <Folha titulo="Novo gasto" aoFechar={aoFechar}>
      <CampoDinheiro rotulo="Valor do gasto" grande autoFocus valor={valor} aoMudar={setValor} />
      <div className="grupo" style={{ margin: '16px 0' }} role="group" aria-label="Categoria">
        {CATEGORIAS.map((c) => <button key={c} className="chip" aria-pressed={c === categoria} onClick={() => setCategoria(c)}>{c}</button>)}
      </div>
      <button className="btn btn-primario btn-bloco" disabled={valor <= 0}
        onClick={async () => { await lancarGasto(d.ciclo.id, hoje, valor, categoria); avisar(`Gasto de ${reais(valor)} lançado.`); aoFechar(); }}>
        Salvar
      </button>
    </Folha>
  );
}

export function FolhaEntrada({ d, hoje, aoFechar, avisar }: { d: DadosCiclo; hoje: Data; aoFechar: () => void; avisar: (m: string) => void }) {
  const [valor, setValor] = useState(0);
  const [descricao, setDescricao] = useState('');
  return (
    <Folha titulo="Entrou dinheiro" aoFechar={aoFechar}>
      <CampoDinheiro rotulo="Valor recebido" grande autoFocus valor={valor} aoMudar={setValor} />
      <label className="campo" style={{ marginTop: 16 }}><span>De onde veio?</span>
        <input className="entrada" placeholder="Ex.: Bolsa NEABI" value={descricao} onChange={(e) => setDescricao(e.target.value)} />
      </label>
      <p className="sub">O teto é recalculado na hora. A separação automática para metas ("Caiu, Guardou") chega na próxima fase.</p>
      <button className="btn btn-primario btn-bloco" disabled={valor <= 0}
        onClick={async () => { await registrarEntrada(d.ciclo.id, hoje, valor, descricao.trim() || 'Entrada'); avisar(`Entrada de ${reais(valor)} registrada.`); aoFechar(); }}>
        Registrar
      </button>
    </Folha>
  );
}

/** RF07 — fechamento por diferença de saldo, de um ou vários dias. */
export function FolhaFechar({ d, ate, aoFechar, aoRegistrarEntrada, avisar }: {
  d: DadosCiclo; ate: Data; aoFechar: () => void; aoRegistrarEntrada: () => void; avisar: (m: string) => void;
}) {
  const [saldo, setSaldo] = useState<number | null>(null);
  const [confirmouEconomia, setConfirmouEconomia] = useState(false);
  const estado = montarEstado(d);
  const previa = saldo === null ? null : fecharPeriodo(estado, ate, saldo, lancamentosAte(d, ate));
  const varios = previa ? previa.dias.length > 1 : false;
  const bloqueado = saldo === null || (previa?.entrouDinheiro && !confirmouEconomia);

  return (
    <Folha titulo="Fechar o dia" aoFechar={aoFechar}>
      <p style={{ marginTop: 0 }}>Quanto tem na conta agora?</p>
      <CampoDinheiro rotulo="Saldo livre na conta agora" grande autoFocus valor={saldo ?? 0} aoMudar={setSaldo} />
      <p className="sub">Abra o app do banco e digite o saldo livre, sem caixinhas.</p>

      {previa && (
        <>
          {varios && <div className="aviso info">Vai fechar {previa.dias.length} dias juntos: de {dataCurta(previa.dataInicio)} a {dataCurta(ate)}.</div>}
          <dl className="resumo">
            <dt>Orçado</dt><dd><Valor c={previa.orcado} /></dd>
            <dt>Gasto real</dt><dd><Valor c={previa.gastoReal} /></dd>
            {previa.naoCategorizado > 0 && <><dt>Sem categoria</dt><dd><Valor c={previa.naoCategorizado} /></dd></>}
          </dl>
          {previa.entrouDinheiro ? (
            <div className="aviso atencao" style={{ display: 'block' }}>
              Seu saldo subiu {reais(-previa.gastoReal)} sem nenhuma entrada registrada. Entrou dinheiro?
              <div className="grupo" style={{ marginTop: 10 }}>
                <button className="btn btn-peq btn-primario" onClick={aoRegistrarEntrada}>Sim, registrar entrada</button>
                <button className="btn btn-peq" aria-pressed={confirmouEconomia} onClick={() => setConfirmouEconomia(true)}>Não, foi economia</button>
              </div>
            </div>
          ) : (
            <div className={`aviso ${previa.dentro ? 'positivo' : 'atencao'}`}>{mensagemFechamento(previa.economia)}</div>
          )}
          {previa.lancamentosAcimaDoReal && <p className="sub">Os gastos lançados passam do gasto real. Algum lançamento pode estar duplicado.</p>}
        </>
      )}
      <button className="btn btn-primario btn-bloco" disabled={bloqueado}
        onClick={async () => { const f = await fecharDia(d, ate, saldo!); avisar(mensagemFechamento(f.economia)); aoFechar(); }}>
        Confirmar
      </button>
    </Folha>
  );
}
