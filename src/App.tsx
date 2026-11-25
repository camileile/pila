import { useCallback, useEffect, useState } from 'react';
import { base, calcularStreak, ultimoDia } from './engine';
import { dataLancamento, diasDosFechamentos, montarEstado } from './db/estado';
import { usarConfig, usarDadosCiclo, usarTodosFechamentos } from './db/usarDados';
import { hojeApp } from './lib/formato';
import { Extrato } from './telas/Extrato';
import { FolhaFechar, FolhaGasto, FolhaRole } from './telas/Folhas';
import { Hoje, type Acao } from './telas/Hoje';
import { Mais } from './telas/Mais';
import { Metas } from './telas/Metas';
import { FolhaEntrada } from './telas/Rendas';
import { NovoCiclo } from './telas/NovoCiclo';
import { Icone } from './ui/componentes';

type Aba = 'hoje' | 'extrato' | 'metas' | 'mais';

/** Atualiza "hoje" quando o app volta para a frente (ex.: virou o dia). */
function usarHoje() {
  const [hoje, setHoje] = useState(hojeApp);
  useEffect(() => {
    const atualizar = () => document.visibilityState === 'visible' && setHoje(hojeApp());
    document.addEventListener('visibilitychange', atualizar);
    return () => document.removeEventListener('visibilitychange', atualizar);
  }, []);
  return hoje;
}

export function App() {
  const d = usarDadosCiclo();
  const config = usarConfig();
  const todosFechamentos = usarTodosFechamentos();
  const hoje = usarHoje();
  const [aba, setAba] = useState<Aba>('hoje');
  const [acao, setAcao] = useState<Acao | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const avisar = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast((t) => (t === m ? null : t)), 3500);
  }, []);
  const fechar = useCallback(() => setAcao(null), []);

  if (d === undefined) return null;

  if (d === null || acao?.tipo === 'novoCiclo') {
    const novo = acao?.tipo === 'novoCiclo' ? acao : undefined;
    const saldoSugerido = novo?.saldo ?? (d ? base(montarEstado(d)).saldo : undefined);
    return (
      <main className="app" style={{ paddingBottom: 32 }}>
        {d === null && (
          <div className="boas-vindas">
            <img src="/logo/pila-horizontal-cor.svg" alt="Pila" />
            <p><strong>Quanto posso gastar hoje?</strong><br />Vamos montar seu primeiro ciclo.</p>
          </div>
        )}
        <NovoCiclo saldoSugerido={saldoSugerido} aporteFinal={novo?.aporteFinal} aoCancelar={d ? fechar : undefined}
          aoCriar={() => { setAcao(null); setAba('hoje'); avisar('Ciclo criado. Bora!'); }} />
      </main>
    );
  }

  const fim = ultimoDia(d.ciclo);
  const emAndamento = hoje >= d.ciclo.dataInicio && hoje <= fim;
  const hojeFechado = base(montarEstado(d)).data >= hoje;
  const dataMov = dataLancamento(d, hoje);
  const streak = calcularStreak(diasDosFechamentos(todosFechamentos ?? []), { folgaSemanal: config?.folgaSemanal ?? true }).at(-1)?.streak ?? 0;

  return (
    <>
      <main className="app">
        {aba === 'hoje' && <Hoje d={d} hoje={hoje} config={config} streak={streak} abrir={setAcao} avisar={avisar} />}
        {aba === 'extrato' && <Extrato d={d} />}
        {aba === 'metas' && <Metas d={d} hoje={hoje} dataMov={dataMov} avisar={avisar} />}
        {aba === 'mais' && <Mais d={d} hoje={hoje} config={config} abrir={setAcao} avisar={avisar} />}
      </main>

      {aba === 'hoje' && emAndamento && !hojeFechado && (
        <div className="acoes">
          <button className="btn btn-limao" onClick={() => setAcao({ tipo: 'gasto' })}>+ Gasto</button>
          <button className="btn btn-primario" onClick={() => setAcao({ tipo: 'fechar', ate: hoje })}>Fechar o dia</button>
        </div>
      )}

      <nav className="nav" aria-label="Navegação principal">
        {(['hoje', 'extrato', 'metas', 'mais'] as const).map((a) => (
          <button key={a} aria-current={aba === a ? 'page' : undefined} onClick={() => setAba(a)}>
            <Icone nome={a} />{{ hoje: 'Hoje', extrato: 'Extrato', metas: 'Metas', mais: 'Mais' }[a]}
          </button>
        ))}
      </nav>

      {acao?.tipo === 'gasto' && <FolhaGasto d={d} data={hoje} aoFechar={fechar} avisar={avisar} />}
      {acao?.tipo === 'role' && <FolhaRole d={d} hoje={hoje} aoFechar={fechar} avisar={avisar} />}
      {acao?.tipo === 'entrada' && dataMov && (
        <FolhaEntrada d={d} data={dataMov} fonteInicial={acao.fonteId} aoFechar={fechar} avisar={avisar} />
      )}
      {acao?.tipo === 'fechar' && (
        <FolhaFechar d={d} ate={acao.ate} aoFechar={fechar} avisar={avisar}
          aoRegistrarEntrada={() => setAcao({ tipo: 'entrada' })} />
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
