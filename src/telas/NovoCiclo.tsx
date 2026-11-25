import { useState } from 'react';
import { calcularTeto, somarDias, type Centavos, type Recesso } from '../engine';
import { criarCiclo, type RascunhoCiclo } from '../db/acoes';
import { usarModelos } from '../db/usarDados';
import { dataCurta, hojeApp, reais } from '../lib/formato';
import { CampoDinheiro, Passo } from '../ui/componentes';

const DIAS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const NOMES = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const TITULOS = ['Período', 'Dias de aula', 'Compromissos', 'Saldo'];

export function NovoCiclo({ saldoSugerido, aoCancelar, aoCriar }: {
  saldoSugerido?: Centavos; aoCancelar?: () => void; aoCriar: () => void;
}) {
  const modelos = usarModelos();
  const hoje = hojeApp();
  const [passo, setPasso] = useState(0);
  const [r, setR] = useState<RascunhoCiclo | null>(null);
  const [salvando, setSalvando] = useState(false);

  if (!modelos) return null;
  const rascunho: RascunhoCiclo = r ?? {
    dataInicio: hoje,
    dataFim: somarDias(hoje, 29),
    bufferDias: 3,
    diasAtivos: [1, 2, 3, 4, 5],
    recessos: [],
    saldoInicial: saldoSugerido ?? 0,
    contas: modelos.contas.map((c) => ({ id: c.id, descricao: c.descricao, valor: c.valor })),
    gastos: modelos.gastos.map((g) => ({ id: g.id, descricao: g.descricao, valorUnitario: g.valorUnitario, qtdPadraoDia: g.qtdPadraoDia })),
  };
  const mudar = (p: Partial<RascunhoCiclo>) => setR({ ...rascunho, ...p });

  const periodoOk = rascunho.dataFim >= rascunho.dataInicio;
  const compromissosOk =
    rascunho.contas.every((c) => c.descricao.trim() && c.valor > 0) &&
    rascunho.gastos.every((g) => g.descricao.trim() && g.valorUnitario > 0 && g.qtdPadraoDia > 0);
  const podeAvancar = [periodoOk, true, compromissosOk, true][passo];

  const previa = calcularTeto({
    ciclo: { ...rascunho },
    gastosFixos: rascunho.gastos,
    data: rascunho.dataInicio,
    saldoBase: rascunho.saldoInicial,
    contasPendentes: rascunho.contas.reduce((t, c) => t + c.valor, 0),
    reservasFuturas: 0,
  });

  async function salvar() {
    setSalvando(true);
    await criarCiclo({ ...rascunho, contas: rascunho.contas.map((c) => ({ ...c, descricao: c.descricao.trim() })) });
    aoCriar();
  }

  return (
    <div>
      <div className="topo">
        <h1>Novo ciclo</h1>
        {aoCancelar && <button className="btn-texto" onClick={aoCancelar}>Cancelar</button>}
      </div>
      <div className="progresso-passos" aria-hidden="true">
        {TITULOS.map((t, i) => <span key={t} className={i <= passo ? 'feito' : ''} />)}
      </div>
      <p className="sub">Passo {passo + 1} de 4 · {TITULOS[passo]}</p>

      {passo === 0 && (
        <div className="card">
          <label className="campo"><span>Começa em</span>
            <input type="date" className="entrada" value={rascunho.dataInicio} onChange={(e) => mudar({ dataInicio: e.target.value })} />
          </label>
          <label className="campo"><span>Termina em (quando a próxima renda deve cair)</span>
            <input type="date" className="entrada" value={rascunho.dataFim} onChange={(e) => mudar({ dataFim: e.target.value })} />
          </label>
          {!periodoOk && <p className="alerta">A data final precisa ser depois da inicial.</p>}
          <div className="item">
            <div className="desc">Ficar de Boa<small>Dias extras de margem se a bolsa atrasar</small></div>
            <Passo rotulo="Dias de margem" valor={rascunho.bufferDias} max={15} aoMudar={(n) => mudar({ bufferDias: n })} />
          </div>
        </div>
      )}

      {passo === 1 && (
        <>
          <div className="card">
            <h2>Em quais dias você vai para a aula ou trabalho?</h2>
            <div className="semana">
              {DIAS.map((d, i) => (
                <button key={i} className="chip" aria-label={NOMES[i]} aria-pressed={rascunho.diasAtivos.includes(i)}
                  onClick={() => mudar({
                    diasAtivos: rascunho.diasAtivos.includes(i) ? rascunho.diasAtivos.filter((x) => x !== i) : [...rascunho.diasAtivos, i].sort(),
                  })}>{d}</button>
              ))}
            </div>
            <p className="sub" style={{ marginTop: 12 }}>O transporte só é reservado nesses dias.</p>
          </div>
          <div className="card">
            <h2>Recesso ou férias</h2>
            {rascunho.recessos.map((rc, i) => (
              <div key={i} className="linha-form" style={{ gridTemplateColumns: '1fr 1fr 44px' }}>
                <input type="date" className="entrada" aria-label="Início do recesso" value={rc.dataInicio}
                  onChange={(e) => mudar({ recessos: troca(rascunho.recessos, i, { ...rc, dataInicio: e.target.value }) })} />
                <input type="date" className="entrada" aria-label="Fim do recesso" value={rc.dataFim}
                  onChange={(e) => mudar({ recessos: troca(rascunho.recessos, i, { ...rc, dataFim: e.target.value }) })} />
                <button className="btn btn-peq btn-perigo" aria-label="Remover recesso" onClick={() => mudar({ recessos: rascunho.recessos.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button className="btn btn-peq" onClick={() => mudar({ recessos: [...rascunho.recessos, { dataInicio: rascunho.dataInicio, dataFim: rascunho.dataInicio } as Recesso] })}>+ Adicionar recesso</button>
          </div>
        </>
      )}

      {passo === 2 && (
        <>
          <div className="card">
            <h2>Contas fixas do mês</h2>
            <p className="sub">Internet, passe, celular… Ficam reservadas até você pagar.</p>
            {rascunho.contas.map((c, i) => (
              <div key={i} className="linha-form">
                <input className="entrada" placeholder="Ex.: Internet" aria-label="Descrição da conta" value={c.descricao}
                  onChange={(e) => mudar({ contas: troca(rascunho.contas, i, { ...c, descricao: e.target.value }) })} />
                <CampoDinheiro rotulo="Valor da conta" valor={c.valor} aoMudar={(v) => mudar({ contas: troca(rascunho.contas, i, { ...c, valor: v }) })} />
                <button className="btn btn-peq btn-perigo" aria-label="Remover conta" onClick={() => mudar({ contas: rascunho.contas.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button className="btn btn-peq" onClick={() => mudar({ contas: [...rascunho.contas, { descricao: '', valor: 0 }] })}>+ Adicionar conta</button>
          </div>
          <div className="card">
            <h2>Gastos fixos por dia de aula</h2>
            <p className="sub">Ex.: mototáxi R$ 7,00, 2 vezes por dia.</p>
            {rascunho.gastos.map((g, i) => (
              <div key={i} className="linha-form tres">
                <input className="entrada" placeholder="Ex.: Mototáxi" aria-label="Descrição do gasto" value={g.descricao}
                  onChange={(e) => mudar({ gastos: troca(rascunho.gastos, i, { ...g, descricao: e.target.value }) })} />
                <CampoDinheiro rotulo="Valor de cada vez" valor={g.valorUnitario} aoMudar={(v) => mudar({ gastos: troca(rascunho.gastos, i, { ...g, valorUnitario: v }) })} />
                <input className="entrada num" inputMode="numeric" aria-label="Vezes por dia" value={g.qtdPadraoDia}
                  onChange={(e) => mudar({ gastos: troca(rascunho.gastos, i, { ...g, qtdPadraoDia: Number(e.target.value.replace(/\D/g, '').slice(0, 2) || 0) }) })} />
                <button className="btn btn-peq btn-perigo" aria-label="Remover gasto" onClick={() => mudar({ gastos: rascunho.gastos.filter((_, j) => j !== i) })}>✕</button>
              </div>
            ))}
            <button className="btn btn-peq" onClick={() => mudar({ gastos: [...rascunho.gastos, { descricao: '', valorUnitario: 0, qtdPadraoDia: 2 }] })}>+ Adicionar gasto</button>
          </div>
          {!compromissosOk && <p className="sub">Preencha descrição e valor de cada item (ou remova o que não usar).</p>}
        </>
      )}

      {passo === 3 && (
        <div className="card">
          <h2>Quanto tem livre na conta hoje?</h2>
          <p className="sub">Só o saldo que dá para movimentar, sem contar caixinhas e cofrinhos.</p>
          <CampoDinheiro rotulo="Saldo livre na conta" grande autoFocus valor={rascunho.saldoInicial} aoMudar={(v) => mudar({ saldoInicial: v })} />
          <div className={`aviso ${previa.modoAperto ? 'alerta' : 'info'}`} style={{ marginTop: 16 }}>
            {previa.modoAperto
              ? `Esse saldo não cobre contas e transporte do ciclo. Faltam ${reais(previa.deficit)}.`
              : `Em ${dataCurta(rascunho.dataInicio)} você vai poder gastar ${reais(previa.teto)}.`}
          </div>
        </div>
      )}

      <div className="grupo" style={{ marginTop: 8 }}>
        {passo > 0 && <button className="btn" style={{ flex: 1 }} onClick={() => setPasso(passo - 1)}>Voltar</button>}
        {passo < 3
          ? <button className="btn btn-primario" style={{ flex: 2 }} disabled={!podeAvancar} onClick={() => setPasso(passo + 1)}>Continuar</button>
          : <button className="btn btn-limao" style={{ flex: 2 }} disabled={salvando} onClick={salvar}>Começar ciclo</button>}
      </div>
    </div>
  );
}

function troca<T>(lista: T[], i: number, item: T): T[] {
  return lista.map((x, j) => (j === i ? item : x));
}
