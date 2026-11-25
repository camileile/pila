import { useState } from 'react';
import {
  base, diferencaDias, ehDiaAtivo, estadoDoDia, somarDias, tetoDoDia, ultimoDia, type Data,
} from '../engine';
import { pagarConta, registrarChecklist } from '../db/acoes';
import type { ConfigRow, GastoFixoRow } from '../db/db';
import {
  gastosVariaveisEntre, montarEstado, provisaoRealDia, ultimoFechamento, type DadosCiclo,
} from '../db/estado';
import { dataCurta, reais } from '../lib/formato';
import { Passo, Valor } from '../ui/componentes';

export type Acao = { tipo: 'gasto' } | { tipo: 'fechar'; ate: Data } | { tipo: 'entrada' } | { tipo: 'novoCiclo' };

const FAIXA = {
  positivo: '✓ No azul',
  atencao: '⚠ Perto do limite',
  alerta: '✕ Passou do limite',
} as const;

export function Hoje({ d, hoje, config, abrir }: { d: DadosCiclo; hoje: Data; config?: ConfigRow; abrir: (a: Acao) => void }) {
  const estado = montarEstado(d);
  const b = base(estado);
  const fim = ultimoDia(d.ciclo);
  const ult = ultimoFechamento(d.fechamentos);

  const topo = (
    <div className="topo">
      <img src="/logo/pila-horizontal-cor.svg" alt="Pila" />
      <span className="sub">{dataCurta(hoje)}</span>
    </div>
  );

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
            <>
              <p>Saldo final: <Valor c={b.saldo} /></p>
              <button className="btn btn-limao btn-bloco" onClick={() => abrir({ tipo: 'novoCiclo' })}>Começar novo ciclo</button>
            </>
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
        <Contas d={d} hoje={hoje} />
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
      {dia.resultado.modoAperto && (
        <div className="aviso alerta">
          Seu saldo não cobre todos os compromissos. Faltam {reais(dia.resultado.deficit)} até o fim do ciclo. Confira as contas pendentes.
        </div>
      )}

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
      <Contas d={d} hoje={hoje} />

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

function Contas({ d, hoje }: { d: DadosCiclo; hoje: Data }) {
  const pendentes = d.contas.filter((c) => !c.pagaEm);
  const pagas = d.contas.length - pendentes.length;
  if (!d.contas.length) return null;
  return (
    <section className="card" aria-label="Contas do ciclo">
      <h2>Contas a pagar</h2>
      {pendentes.length === 0 && <p className="positivo" style={{ margin: 0 }}>✓ Todas as contas do ciclo estão pagas.</p>}
      {pendentes.map((c) => (
        <div key={c.id} className="item">
          <div className="desc">{c.descricao}{c.atrasada && <small className="alerta">Atrasada do ciclo anterior</small>}</div>
          <Valor c={c.valor} />
          <button className="btn btn-peq" onClick={() => void pagarConta(c.id, hoje)}>Paguei</button>
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
