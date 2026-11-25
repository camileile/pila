import { useState } from 'react';
import {
  base, diferencaDias, ehDiaAtivo, encerrarCiclo, estadoDoDia, somarDias, tetoDoDia, ultimoDia,
  type Centavos, type Data,
} from '../engine';
import { adiarConta, pagarConta, registrarChecklist, removerRole } from '../db/acoes';
import type { ConfigRow, GastoFixoRow } from '../db/db';
import {
  dataLancamento, gastosVariaveisEntre, montarEstado, provisaoRealDia, ultimoFechamento, type DadosCiclo,
} from '../db/estado';
import { usarMetas } from '../db/metas';
import { AReceber } from './Rendas';
import { FechamentoSemanal, ModoAperto } from './Semana';
import { dataCurta, reais } from '../lib/formato';
import { Icone, Passo, Valor } from '../ui/componentes';

export type Acao =
  | { tipo: 'gasto' }
  | { tipo: 'fechar'; ate: Data }
  | { tipo: 'entrada'; fonteId?: string }
  | { tipo: 'role' }
  | { tipo: 'novoCiclo'; saldo?: Centavos; aporteFinal?: { metaId: string; valor: Centavos } };

const FAIXA = {
  positivo: '✓ No azul',
  atencao: '⚠ Perto do limite',
  alerta: '✕ Passou do limite',
} as const;

export function Hoje({ d, hoje, config, streak, abrir, avisar }: {
  d: DadosCiclo; hoje: Data; config?: ConfigRow; streak: number; abrir: (a: Acao) => void; avisar: (m: string) => void;
}) {
  const estado = montarEstado(d);
  const b = base(estado);
  const fim = ultimoDia(d.ciclo);
  const ult = ultimoFechamento(d.fechamentos);

  const topo = (
    <div className="topo">
      <img src="/logo/pila-horizontal-cor.svg" alt="Pila" />
      <div style={{ textAlign: 'right' }}>
        <div className="sub">{dataCurta(hoje)}</div>
        {streak > 0 && (
          <div className="streak" aria-label={`${streak} ${streak === 1 ? 'dia' : 'dias'} seguidos no azul`}>
            <Icone nome="fogo" />{streak} {streak === 1 ? 'dia' : 'dias'} no azul
          </div>
        )}
      </div>
    </div>
  );
  const semanal = <FechamentoSemanal d={d} hoje={hoje} config={config} avisar={avisar} />;

  const lembreteBackup = precisaBackup(config, d.ciclo.criadoEm, hoje) && (
    <div className="aviso info">Faz um tempo sem backup. Seus dados só existem neste celular.<span className="sub">Mais → Backup</span></div>
  );

  if (hoje < d.ciclo.dataInicio)
    return (
      <>
        {topo}
        <div className="card"><h2>Seu ciclo começa em {dataCurta(d.ciclo.dataInicio)}</h2>
          <p className="sub">Até lá não há teto calculado.</p></div>
      </>
    );

  if (hoje > fim)
    return (
      <>
        {topo}
        <div className="card">
          <h2>Seu ciclo terminou em {dataCurta(fim)}</h2>
          {b.data < fim ? (
            <>
              <p className="sub">Feche os últimos dias para saber como ele terminou.</p>
              <button className="btn btn-primario btn-bloco" onClick={() => abrir({ tipo: 'fechar', ate: fim })}>Fechar o ciclo</button>
            </>
          ) : (
            <FimDeCiclo d={d} saldoFinal={b.saldo} abrir={abrir} />
          )}
        </div>
      </>
    );

  if (b.data >= hoje) {
    const amanha = somarDias(hoje, 1);
    const tetoAmanha = amanha <= fim ? tetoDoDia(estado, amanha).resultado.teto : null;
    return (
      <>
        {topo}
        <div className="card card-teto">
          <div className="rotulo">Dia fechado ✓</div>
          {ult && (
            <div className="valor num">
              {ult.economia >= 0 ? `+${reais(ult.economia)}` : reais(ult.economia)}
            </div>
          )}
          <div>{ult && mensagemFechamento(ult.economia)}</div>
          {tetoAmanha !== null && <div className="linha"><span>Amanhã você pode gastar</span><strong className="num">{reais(tetoAmanha)}</strong></div>}
        </div>
        {semanal}
        <Contas d={d} data={dataLancamento(d, hoje)} />
        <Roles d={d} hoje={hoje} />
        {lembreteBackup}
      </>
    );
  }

  const dia = tetoDoDia(estado, hoje);
  const ed = estadoDoDia({
    teto: dia.resultado.teto,
    provisaoPadrao: dia.provisaoPadrao,
    provisaoReal: provisaoRealDia(d, hoje),
    reservaHoje: dia.reservaDoDia,
    gastosVariaveis: gastosVariaveisEntre(d, hoje, hoje),
  });
  const diasAbertos = diferencaDias(b.data, hoje) - 1;
  const pct = ed.disponivel > 0 ? Math.max(0, Math.min(100, (ed.resta / ed.disponivel) * 100)) : 0;

  return (
    <>
      {topo}
      {diasAbertos > 0 && (
        <div className="aviso atencao">
          <span>{diasAbertos === 1 ? 'Ontem ficou sem fechar.' : `${diasAbertos} dias ficaram sem fechar.`}</span>
          <button className="btn btn-peq" onClick={() => abrir({ tipo: 'fechar', ate: somarDias(hoje, -1) })}>Fechar</button>
        </div>
      )}
      {dia.resultado.modoAperto && <ModoAperto d={d} deficit={dia.resultado.deficit} />}
      {semanal}

      <section className="card card-teto" aria-label="Posso gastar hoje">
        <div className="rotulo">Posso gastar hoje</div>
        <div className="valor"><Valor c={ed.resta} /></div>
        <div className="barra" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
        <div className="linha">
          <span className={`selo ${ed.faixa}`}>{FAIXA[ed.faixa]}</span>
          <span>de <Valor c={ed.disponivel} /></span>
        </div>
        {dia.reservaDoDia > 0 && <div className="linha"><span>Inclui o Rolê de hoje</span><Valor c={dia.reservaDoDia} /></div>}
      </section>

      {ehDiaAtivo(d.ciclo, hoje) && d.gastosFixos.length > 0 && <Checklist d={d} hoje={hoje} />}
      <Contas d={d} data={hoje} />
      <Roles d={d} hoje={hoje} aoAgendar={() => abrir({ tipo: 'role' })} />
      <AReceber d={d} aoReceber={(fonteId) => abrir({ tipo: 'entrada', fonteId })} />

      <div className="card">
        <div className="item"><div className="desc">Saldo livre no início do dia</div><Valor c={dia.saldoBase} /></div>
        <div className="item"><div className="desc">Dias até o fim do ciclo<small>Inclui {d.ciclo.bufferDias} de margem (Ficar de Boa)</small></div><span className="num">{dia.resultado.dias}</span></div>
      </div>
      {lembreteBackup}
    </>
  );
}

function Checklist({ d, hoje }: { d: DadosCiclo; hoje: Data }) {
  const [editando, setEditando] = useState<string | null>(null);
  const salvar = (g: GastoFixoRow, qtd: number) => {
    void registrarChecklist(d.ciclo.id, g, hoje, qtd);
    setEditando(null);
  };
  return (
    <section className="card" aria-label="Gastos fixos de hoje">
      <h2>Gastos fixos de hoje</h2>
      {d.gastosFixos.map((g) => {
        const reg = d.registros.find((r) => r.gastoFixoId === g.id && r.data === hoje);
        const qtd = reg?.qtd ?? g.qtdPadraoDia;
        return (
          <div key={g.id} className="item" style={{ flexWrap: 'wrap' }}>
            <div className="desc" style={{ flexBasis: '100%' }}>
              {g.descricao}
              <small>{reg ? (qtd === 0 ? 'Não usei hoje' : `✓ ${qtd} × ${reais(g.valorUnitario)}`) : `Previsto: ${g.qtdPadraoDia} × ${reais(g.valorUnitario)}`}</small>
            </div>
            {editando === g.id ? (
              <div className="grupo">
                <Passo rotulo={`Quantidade de ${g.descricao}`} valor={qtd} max={20}
                  aoMudar={(n) => void registrarChecklist(d.ciclo.id, g, hoje, n)} />
                <button className="btn btn-peq" onClick={() => setEditando(null)}>OK</button>
              </div>
            ) : (
              <div className="grupo">
                {!reg && <button className="btn btn-peq btn-primario" onClick={() => salvar(g, g.qtdPadraoDia)}>Padrão</button>}
                <button className="btn btn-peq" onClick={() => setEditando(g.id)}>Alterar</button>
                {(!reg || reg.qtd > 0) && <button className="btn btn-peq" onClick={() => salvar(g, 0)}>Não usei</button>}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}

/** Rolês agendados de hoje em diante. `aoAgendar` só existe quando hoje está aberto. */
function Roles({ d, hoje, aoAgendar }: { d: DadosCiclo; hoje: Data; aoAgendar?: () => void }) {
  const proximos = d.reservas.filter((r) => r.data >= hoje).sort((a, b) => a.data.localeCompare(b.data));
  if (!proximos.length && !aoAgendar) return null;
  return (
    <section className="card" aria-label="Modo Rolê">
      <h2>Modo Rolê</h2>
      {!proximos.length && <p className="sub" style={{ marginTop: -6 }}>Vai ter um gasto maior num dia? Reserve agora e o resto do ciclo se ajusta.</p>}
      {proximos.map((r) => (
        <div key={r.id} className="item">
          <div className="desc">{r.descricao}<small>{r.data === hoje ? 'Hoje' : dataCurta(r.data)}</small></div>
          <Valor c={r.valor} />
          <button className="btn btn-peq btn-perigo" aria-label={`Cancelar ${r.descricao}`}
            onClick={() => confirm(`Cancelar "${r.descricao}"? O valor volta para os próximos dias.`) && void removerRole(r.id)}>✕</button>
        </div>
      ))}
      {aoAgendar && <button className="btn btn-peq" style={{ marginTop: 8 }} onClick={aoAgendar}>+ Agendar rolê</button>}
    </section>
  );
}

/** §3.11 — ciclo encerrado: mostra a sobra e oferece mandar parte para uma meta. */
function FimDeCiclo({ d, saldoFinal, abrir }: { d: DadosCiclo; saldoFinal: Centavos; abrir: (a: Acao) => void }) {
  const metas = usarMetas();
  const [pct, setPct] = useState(0);
  const [metaId, setMetaId] = useState('');
  const fim = encerrarCiclo(saldoFinal, d.contas.map((c) => ({ valor: c.valor, pagaEm: c.pagaEm })), pct);
  const destino = metaId || metas?.[0]?.id || '';
  return (
    <>
      <dl className="resumo">
        <dt>Saldo final</dt><dd><Valor c={saldoFinal} /></dd>
        {fim.contasAtrasadas.length > 0 && <><dt>Contas pendentes</dt><dd><Valor c={saldoFinal - fim.sobra} /></dd></>}
        <dt>Sobrou</dt><dd><Valor c={fim.sobra} className={fim.sobra >= 0 ? 'positivo' : 'alerta'} /></dd>
      </dl>
      {fim.sobra > 0 && metas && metas.length > 0 && (
        <>
          <p style={{ marginBottom: 8 }}>Quanto da sobra vai para uma meta?</p>
          <div className="grupo" role="group" aria-label="Parte da sobra" style={{ marginBottom: 12 }}>
            {[0, 25, 50, 100].map((p) => <button key={p} className="chip" aria-pressed={pct === p} onClick={() => setPct(p)}>{p === 0 ? 'Nada' : `${p}%`}</button>)}
          </div>
          {pct > 0 && (
            <label className="campo"><span>Meta</span>
              <select className="entrada" value={destino} onChange={(e) => setMetaId(e.target.value)}>
                {metas.map((m) => <option key={m.id} value={m.id}>{m.titulo}</option>)}
              </select>
            </label>
          )}
          {fim.aporte > 0 && <p className="sub">Mova {reais(fim.aporte)} para a caixinha. O novo ciclo começa com {reais(fim.saldoInicialNovoCiclo)}.</p>}
        </>
      )}
      {fim.contasAtrasadas.length > 0 && <p className="sub">As contas pendentes vão para o novo ciclo como atrasadas.</p>}
      <button className="btn btn-limao btn-bloco" onClick={() => abrir({
        tipo: 'novoCiclo', saldo: fim.saldoInicialNovoCiclo,
        aporteFinal: fim.aporte > 0 ? { metaId: destino, valor: fim.aporte } : undefined,
      })}>Começar novo ciclo</button>
    </>
  );
}

function Contas({ d, data }: { d: DadosCiclo; data: Data | null }) {
  const pendentes = d.contas.filter((c) => !c.pagaEm);
  const pagas = d.contas.length - pendentes.length;
  if (!d.contas.length) return null;
  return (
    <section className="card" aria-label="Contas do ciclo">
      <h2>Contas a pagar</h2>
      {pendentes.length === 0 && <p className="positivo" style={{ margin: 0 }}>✓ Todas as contas do ciclo estão pagas.</p>}
      {pendentes.map((c) => (
        <div key={c.id} className="item">
          <div className="desc">
            <span className={c.adiada ? 'riscado' : ''}>{c.descricao}</span>
            {c.adiada ? <small>Adiada para o próximo ciclo</small> : c.atrasada && <small className="alerta">Atrasada do ciclo anterior</small>}
          </div>
          <Valor c={c.valor} />
          {c.adiada
            ? <button className="btn btn-peq" onClick={() => void adiarConta(c.id, false)}>Desfazer</button>
            : data && <button className="btn btn-peq" onClick={() => void pagarConta(c.id, data)}>Paguei</button>}
        </div>
      ))}
      {pagas > 0 && pendentes.length > 0 && <p className="sub" style={{ margin: '8px 0 0' }}>{pagas} já paga{pagas > 1 ? 's' : ''}.</p>}
    </section>
  );
}

export function mensagemFechamento(economia: number): string {
  if (economia > 0) return `Mandou bem! Você economizou ${reais(economia)}.`;
  if (economia === 0) return 'Na mosca: gastou exatamente o previsto.';
  return 'Passou um pouquinho. O limite dos próximos dias será ajustado.';
}

function precisaBackup(config: ConfigRow | undefined, criadoEm: string, hoje: Data): boolean {
  const referencia = (config?.ultimoBackupEm ?? criadoEm).slice(0, 10);
  return diferencaDias(referencia, hoje) > 7;
}
