import { useEffect, useRef, type ReactNode } from 'react';
import type { Centavos } from '../engine';
import { centavosDeDigitos, reais, reaisPorExtenso } from '../lib/formato';

/** Campo de dinheiro: digita só números e eles entram como centavos ("1250" → R$ 12,50). */
export function CampoDinheiro({
  valor, aoMudar, rotulo, autoFocus, grande,
}: { valor: Centavos; aoMudar: (c: Centavos) => void; rotulo: string; autoFocus?: boolean; grande?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const atual = useRef(valor);
  atual.current = valor;
  const mudar = useRef(aoMudar);
  mudar.current = aoMudar;

  // Ignora a posição do cursor: cada dígito entra pela direita e o apagar remove o último,
  // como nos apps de banco. Usa o evento nativo `beforeinput`, que funciona nos teclados de celular.
  useEffect(() => {
    const el = ref.current!;
    const tratar = (ev: InputEvent) => {
      ev.preventDefault();
      const v = atual.current;
      if (ev.inputType === 'insertFromPaste' || ev.inputType === 'insertReplacementText')
        mudar.current(centavosDeDigitos(ev.data ?? ev.dataTransfer?.getData('text') ?? ''));
      else if (ev.inputType.startsWith('insert')) {
        const digitos = (ev.data ?? '').replace(/\D/g, '');
        if (digitos) mudar.current(centavosDeDigitos(String(v) + digitos));
      } else if (ev.inputType === 'deleteContentBackward') mudar.current(Math.floor(v / 10));
      else if (ev.inputType.startsWith('delete')) mudar.current(0);
    };
    el.addEventListener('beforeinput', tratar);
    return () => el.removeEventListener('beforeinput', tratar);
  }, []);

  return (
    <input
      ref={ref}
      className={`entrada ${grande ? 'dinheiro' : 'num'}`}
      inputMode="numeric"
      aria-label={rotulo}
      autoFocus={autoFocus}
      value={reais(valor)}
      onChange={() => {}}
    />
  );
}

export function Folha({ titulo, aoFechar, children }: { titulo: string; aoFechar: () => void; children: ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    addEventListener('keydown', esc);
    return () => removeEventListener('keydown', esc);
  }, [aoFechar]);
  return (
    <div className="veu" onClick={aoFechar}>
      <section className="folha" role="dialog" aria-modal="true" aria-label={titulo} onClick={(e) => e.stopPropagation()}>
        <header>
          <h2 style={{ margin: 0 }}>{titulo}</h2>
          <button className="btn-texto" onClick={aoFechar}>Fechar</button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function Passo({ valor, aoMudar, min = 0, max = 99, rotulo }: {
  valor: number; aoMudar: (n: number) => void; min?: number; max?: number; rotulo: string;
}) {
  return (
    <div className="passo" role="group" aria-label={rotulo}>
      <button type="button" aria-label="Diminuir" disabled={valor <= min} onClick={() => aoMudar(valor - 1)}>−</button>
      <span className="num" aria-live="polite">{valor}</span>
      <button type="button" aria-label="Aumentar" disabled={valor >= max} onClick={() => aoMudar(valor + 1)}>+</button>
    </div>
  );
}

/** Valor monetário com rótulo acessível por extenso. */
export function Valor({ c, className }: { c: Centavos; className?: string }) {
  return (
    <span className={`num ${className ?? ''}`}>
      <span aria-hidden="true">{reais(c)}</span>
      <span className="sr">{reaisPorExtenso(c)}</span>
    </span>
  );
}

const caminhos = {
  hoje: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  extrato: 'M5 4h14M5 9h14M5 14h14M5 19h9',
  metas: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  mais: 'M5 12h.01M12 12h.01M19 12h.01',
};
export function Icone({ nome }: { nome: keyof typeof caminhos }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={nome === 'mais' ? 3.5 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={caminhos[nome]} />
    </svg>
  );
}
