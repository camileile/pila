import { useRef } from 'react';
import { ultimoDia } from '../engine';
import { definirFolgaSemanal } from '../db/acoes';
import { exportarBackup, importarBackup } from '../db/backup';
import type { ConfigRow } from '../db/db';
import type { DadosCiclo } from '../db/estado';
import { dataCurta } from '../lib/formato';
import type { Acao } from './Hoje';
import { CartaoFontes } from './Rendas';

export function Mais({ d, hoje, config, abrir, avisar }: {
  d: DadosCiclo; hoje: string; config?: ConfigRow; abrir: (a: Acao) => void; avisar: (m: string) => void;
}) {
  const arquivo = useRef<HTMLInputElement>(null);

  async function baixar() {
    const blob = await exportarBackup();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pila-backup-${hoje}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    avisar('Backup salvo.');
  }

  async function restaurar(f: File) {
    if (!confirm('Restaurar este backup substitui TODOS os dados atuais. Continuar?')) return;
    try {
      await importarBackup(await f.text());
      avisar('Backup restaurado.');
    } catch (e) {
      avisar(e instanceof Error ? e.message : 'Não foi possível ler o arquivo.');
    }
  }

  return (
    <>
      <div className="topo"><h1>Mais</h1></div>

      <section className="card">
        <h2>Ciclo atual</h2>
        <div className="item"><div className="desc">Período</div><span>{dataCurta(d.ciclo.dataInicio)} → {dataCurta(d.ciclo.dataFim)}</span></div>
        <div className="item"><div className="desc">Ficar de Boa<small>Último dia com margem: {dataCurta(ultimoDia(d.ciclo))}</small></div><span>+{d.ciclo.bufferDias} dias</span></div>
        <div className="grupo" style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => abrir({ tipo: 'entrada' })}>Entrou dinheiro</button>
          <button className="btn" onClick={() => confirm('Começar um novo ciclo agora? O atual será encerrado e as contas pendentes vão junto como atrasadas.') && abrir({ tipo: 'novoCiclo' })}>Novo ciclo</button>
        </div>
      </section>

      <CartaoFontes />

      <section className="card">
        <h2>Streak</h2>
        <label className="item" style={{ cursor: 'pointer' }}>
          <span className="desc">Folga semanal<small>Um dia fora do teto por semana não zera a sequência.</small></span>
          <input type="checkbox" style={{ width: 24, height: 24 }} checked={config?.folgaSemanal ?? true}
            onChange={(e) => void definirFolgaSemanal(e.target.checked)} />
        </label>
      </section>

      <section className="card">
        <h2>Backup</h2>
        <p className="sub" style={{ marginTop: 0 }}>
          Seus dados ficam só neste aparelho. Salve um backup de vez em quando.
          {config?.ultimoBackupEm && <> Último: {dataCurta(config.ultimoBackupEm.slice(0, 10))}.</>}
        </p>
        <div className="grupo">
          <button className="btn btn-primario" onClick={baixar}>Salvar backup</button>
          <button className="btn" onClick={() => arquivo.current?.click()}>Restaurar</button>
        </div>
        <input ref={arquivo} type="file" accept="application/json,.json" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void restaurar(f); e.target.value = ''; }} />
      </section>

      <p className="sub" style={{ textAlign: 'center' }}>pila. · Cada pila conta.</p>
    </>
  );
}
