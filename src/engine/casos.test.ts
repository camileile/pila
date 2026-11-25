// Golden cases de docs/casos-de-teste.md — um teste por CT.
import { describe, expect, it } from 'vitest';
import {
  aporteSugerido,
  apurarFechamento,
  calcularCarimbo,
  calcularStreak,
  encerrarCiclo,
  estadoDoDia,
  fecharPeriodo,
  movimentosDaRenda,
  opcoesFechamentoSemanal,
  progressoMeta,
  provisaoPadraoDia,
  projetarAte,
  reservaConcluida,
  saldoMeta,
  tetoDoDia,
  validarRegraCarimbo,
  validarReserva,
  type Ciclo,
  type EstadoCiclo,
} from './index';

/** R$ → centavos */
const r = (reais: number) => Math.round(reais * 100);

// Cenário base B
const cicloB = (over: Partial<Ciclo> = {}): Ciclo => ({
  dataInicio: '2026-03-02',
  dataFim: '2026-03-11',
  bufferDias: 0,
  diasAtivos: [1, 2, 3, 4, 5],
  recessos: [],
  saldoInicial: r(500),
  ...over,
});

const estadoB = (over: Partial<EstadoCiclo> = {}, ciclo: Partial<Ciclo> = {}): EstadoCiclo => ({
  ciclo: cicloB(ciclo),
  gastosFixos: [{ valorUnitario: r(7), qtdPadraoDia: 2 }],
  contas: [{ valor: r(35) }],
  reservas: [],
  movimentos: [],
  ultimoFechamento: null,
  ...over,
});

const teto = (e: EstadoCiclo, d: string) => tetoDoDia(e, d).resultado;

describe('A. Teto do dia (§3.1)', () => {
  it('CT01 — cenário base', () => {
    const t = teto(estadoB(), '2026-03-02');
    expect(t.provisao).toBe(r(112));
    expect(t.livre).toBe(r(353));
    expect(t.dias).toBe(10);
    expect(t.teto).toBe(r(35.3));
  });

  it('CT02 — buffer de 3 dias', () => {
    const t = teto(estadoB({}, { bufferDias: 3 }), '2026-03-02');
    expect(t.provisao).toBe(r(140));
    expect(t.dias).toBe(13);
    expect(t.teto).toBe(r(25));
  });

  it('CT03 — recesso continua no divisor', () => {
    const t = teto(estadoB({}, { recessos: [{ dataInicio: '2026-03-09', dataFim: '2026-03-11' }] }), '2026-03-02');
    expect(t.provisao).toBe(r(70));
    expect(t.dias).toBe(10);
    expect(t.teto).toBe(r(39.5));
  });

  it('CT04 — arredonda para baixo e o resto fica no saldo', () => {
    const e = estadoB(
      { gastosFixos: [], contas: [] },
      { dataInicio: '2026-03-02', dataFim: '2026-03-04', saldoInicial: r(100) },
    );
    expect(teto(e, '2026-03-02').teto).toBe(r(33.33));
    // o centavo que sobra reaparece: dia 03 parte de 66,67 em 2 dias
    expect(teto(e, '2026-03-03').teto).toBe(r(33.33));
    expect(teto(e, '2026-03-04').teto).toBe(r(33.34));
  });

  it('CT05 — modo aperto', () => {
    const t = teto(estadoB({}, { saldoInicial: r(100) }), '2026-03-02');
    expect(t.teto).toBe(0);
    expect(t.modoAperto).toBe(true);
    expect(t.deficit).toBe(r(47));
  });

  it('CT06 — pagar conta fixa é neutro', () => {
    const e = estadoB({
      contas: [{ valor: r(35), pagaEm: '2026-03-02' }],
      movimentos: [{ data: '2026-03-02', tipo: 'PAGAMENTO_CONTA', valor: r(35) }],
    });
    const d = tetoDoDia(e, '2026-03-02');
    expect(d.saldoBase).toBe(r(465));
    expect(d.resultado.teto).toBe(r(35.3));
  });

  it('CT07 — renda recalcula o teto no ato', () => {
    const e = estadoB({ movimentos: [{ data: '2026-03-02', tipo: 'ENTRADA_RENDA', valor: r(300) }] });
    expect(teto(e, '2026-03-02').teto).toBe(r(65.3));
  });

  it('CT08 — dia ativo em recesso não tem provisão', () => {
    const c = cicloB({ recessos: [{ dataInicio: '2026-03-09', dataFim: '2026-03-11' }] });
    expect(provisaoPadraoDia(c, estadoB().gastosFixos, '2026-03-10')).toBe(0);
  });

  it('CT09 — sábado não tem provisão, mas conta no divisor', () => {
    const e = estadoB({}, { bufferDias: 3 });
    expect(provisaoPadraoDia(e.ciclo, e.gastosFixos, '2026-03-14')).toBe(0);
    expect(teto(e, '2026-03-14').dias).toBe(1);
  });
});

describe('B. Durante o dia (§3.2)', () => {
  const base = { teto: r(18.5), provisaoPadrao: r(14) };

  it('CT10 — checklist "1 moto" move a economia para o livre', () => {
    const d = estadoDoDia({ ...base, provisaoReal: r(7) });
    expect(d.economiaFixo).toBe(r(7));
    expect(d.resta).toBe(r(25.5));
    expect(d.orcado).toBe(r(32.5));
  });

  it('CT11 — gasto variável reduz o resta, não o orçado', () => {
    const d = estadoDoDia({ ...base, provisaoReal: r(7), gastosVariaveis: r(12) });
    expect(d.resta).toBe(r(13.5));
    expect(d.orcado).toBe(r(32.5));
  });

  it('CT12 — usar mais que o padrão reduz o resta', () => {
    const d = estadoDoDia({ ...base, provisaoReal: r(21) });
    expect(d.economiaFixo).toBe(r(-7));
    expect(d.resta).toBe(r(11.5));
    expect(d.orcado).toBe(r(32.5));
  });

  it('CT13 — "Não houve gasto"', () => {
    const d = estadoDoDia({ ...base, provisaoReal: 0 });
    expect(d.economiaFixo).toBe(r(14));
    expect(d.resta).toBe(r(32.5));
  });

  it('CT14 — dia com reserva', () => {
    const d = estadoDoDia({ teto: r(12), provisaoPadrao: 0, reservaHoje: r(80) });
    expect(d.resta).toBe(r(92));
    expect(d.orcado).toBe(r(92));
  });
});

describe('C. Fechamento (§3.3)', () => {
  it('CT15 — UC04 corrigido: passou R$ 0,50', () => {
    const a = apurarFechamento({ saldoInicio: r(170), saldoAtual: r(137), estruturais: 0, orcado: r(32.5) });
    expect(a.gastoReal).toBe(r(33));
    expect(a.economia).toBe(r(-0.5));
    expect(a.dentro).toBe(false);
  });

  it('CT16 — renda com carimbo e conta paga no mesmo dia', () => {
    const movs = [
      ...movimentosDaRenda('2026-03-02', r(500), { tipo: 'PERCENTUAL', valor: 20 }),
      { data: '2026-03-02', tipo: 'PAGAMENTO_CONTA' as const, valor: r(35) },
    ];
    const e = estadoB({ movimentos: movs });
    const estruturais = projetarAte(e, '2026-03-02')[0]!.estruturais;
    expect(estruturais).toBe(r(365));
    const a = apurarFechamento({ saldoInicio: r(170), saldoAtual: r(505), estruturais, orcado: r(32.5) });
    expect(a.gastoReal).toBe(r(30));
    expect(a.economia).toBe(r(2.5));
    expect(a.dentro).toBe(true);
  });

  it('CT17 — saldo subiu sem renda: pergunta "entrou dinheiro?"', () => {
    const a = apurarFechamento({ saldoInicio: r(100), saldoAtual: r(150), estruturais: 0, orcado: r(30) });
    expect(a.gastoReal).toBe(r(-50));
    expect(a.entrouDinheiro).toBe(true);
    expect(a.lancamentosAcimaDoReal).toBe(false);
  });

  it('CT18 — registrando a renda, a flag some', () => {
    const a = apurarFechamento({ saldoInicio: r(100), saldoAtual: r(150), estruturais: r(50), orcado: r(30) });
    expect(a.gastoReal).toBe(0);
    expect(a.economia).toBe(r(30));
    expect(a.entrouDinheiro).toBe(false);
  });

  it('CT19 — não categorizado', () => {
    const a = apurarFechamento({
      saldoInicio: r(170), saldoAtual: r(137), estruturais: 0, orcado: r(32.5),
      provisaoReal: r(7), gastosVariaveis: r(20),
    });
    expect(a.naoCategorizado).toBe(r(6));
    expect(a.lancamentosAcimaDoReal).toBe(false);
  });

  it('CT20 — lançamentos acima do gasto real', () => {
    const a = apurarFechamento({
      saldoInicio: r(170), saldoAtual: r(137), estruturais: 0, orcado: r(32.5),
      provisaoReal: r(7), gastosVariaveis: r(40),
    });
    expect(a.naoCategorizado).toBe(0);
    expect(a.lancamentosAcimaDoReal).toBe(true);
  });

  it('CT21 — aporte em meta não conta como gasto', () => {
    const a = apurarFechamento({ saldoInicio: r(200), saldoAtual: r(130), estruturais: r(-50), orcado: r(30) });
    expect(a.gastoReal).toBe(r(20));
    expect(a.economia).toBe(r(10));
  });
});

describe('D. Redistribuição e saldo projetado (§3.4)', () => {
  it('CT22 — dia anterior não fechado: teto estável', () => {
    const d = tetoDoDia(estadoB(), '2026-03-03');
    expect(d.saldoBase).toBe(r(450.7));
    expect(d.resultado.provisao).toBe(r(98));
    expect(d.resultado.teto).toBe(r(35.3));
  });

  it('CT23 — estouro é redistribuído nos dias seguintes', () => {
    const f = fecharPeriodo(estadoB(), '2026-03-02', r(400));
    expect(f.orcado).toBe(r(49.3));
    expect(f.gastoReal).toBe(r(100));
    expect(f.economia).toBe(r(-50.7));
    const e = estadoB({ ultimoFechamento: { data: '2026-03-02', saldo: r(400) } });
    expect(teto(e, '2026-03-03').teto).toBe(r(29.66));
  });

  it('CT24 — fechamento de dois dias de uma vez', () => {
    const f = fecharPeriodo(estadoB(), '2026-03-03', r(410));
    expect(f.dias).toEqual(['2026-03-02', '2026-03-03']);
    expect(f.dataInicio).toBe('2026-03-02');
    expect(f.orcado).toBe(r(98.6));
    expect(f.gastoReal).toBe(r(90));
    expect(f.economia).toBe(r(8.6));
    expect(f.dentro).toBe(true);
  });

  it('CT25 — gastando exatamente o orçado, o teto não muda', () => {
    let e = estadoB();
    const tetos: number[] = [];
    for (let dia = 2; dia <= 11; dia++) {
      const data = `2026-03-${String(dia).padStart(2, '0')}`;
      const d = tetoDoDia(e, data);
      tetos.push(d.resultado.teto);
      const f = fecharPeriodo(e, data, d.saldoBase - d.orcado);
      expect(f.economia).toBe(0);
      e = { ...e, ultimoFechamento: { data, saldo: d.saldoBase - d.orcado } };
    }
    expect(Math.max(...tetos) - Math.min(...tetos)).toBeLessThanOrEqual(1);
    expect(tetos[0]).toBe(r(35.3));
  });
});

describe('E. Carimbo (§3.5)', () => {
  const pct = (valor: number) => ({ tipo: 'PERCENTUAL' as const, valor });

  it('CT26 — 20% de 500', () => {
    expect(calcularCarimbo(r(500), pct(20))).toEqual({ carimbo: r(100), liquido: r(400) });
  });
  it('CT27 — 20% de 450 (valor recebido diferente do previsto)', () => {
    expect(calcularCarimbo(r(450), pct(20))).toEqual({ carimbo: r(90), liquido: r(360) });
  });
  it('CT28 — arredonda metade para cima', () => {
    expect(calcularCarimbo(r(333.33), pct(15))).toEqual({ carimbo: r(50), liquido: r(283.33) });
  });
  it('CT29 — fixo limitado ao bruto', () => {
    expect(calcularCarimbo(r(80), { tipo: 'FIXO', valor: r(100) })).toEqual({ carimbo: r(80), liquido: 0 });
  });
  it('CT30 — sem regra', () => {
    expect(calcularCarimbo(r(200), { tipo: 'NENHUMA' })).toEqual({ carimbo: 0, liquido: r(200) });
    expect(movimentosDaRenda('2026-03-02', r(200), { tipo: 'NENHUMA' })).toHaveLength(1);
  });
  it('CT31 — limites do percentual', () => {
    expect(validarRegraCarimbo(pct(0))).toBeNull();
    expect(validarRegraCarimbo(pct(100))).toBeNull();
    expect(validarRegraCarimbo(pct(101))).not.toBeNull();
    expect(validarRegraCarimbo(pct(-1))).not.toBeNull();
    expect(() => calcularCarimbo(r(100), pct(101))).toThrow(RangeError);
  });
});

describe('F. Modo Rolê (§3.6)', () => {
  // 10 dias, sem contas e sem gastos fixos, saldo 200 → teto 20
  const estadoRole = (reservas = [] as { data: string; valor: number }[]) =>
    estadoB({ gastosFixos: [], contas: [], reservas }, { saldoInicial: r(200) });
  const reserva = { data: '2026-03-06', valor: r(80) };

  it('CT32 — UC05: teto cai de 20 para 12 em todos os dias', () => {
    expect(teto(estadoRole(), '2026-03-02').teto).toBe(r(20));
    expect(validarReserva(estadoRole(), '2026-03-02', reserva)).toEqual({ ok: true });
    const dias = projetarAte(estadoRole([reserva]), '2026-03-11');
    expect(dias.every((d) => d.resultado.teto === r(12))).toBe(true);
    const diaDoRole = dias.find((d) => d.data === '2026-03-06')!;
    expect(diaDoRole.orcado).toBe(r(92));
  });

  it('CT33 — reserva maior que o livre é recusada', () => {
    expect(validarReserva(estadoRole(), '2026-03-02', { data: '2026-03-06', valor: r(250) })).toEqual({
      ok: false, motivo: 'NAO_CABE', maximo: r(200),
    });
  });

  it('CT34 — data fora do ciclo ou no passado é recusada', () => {
    const e = estadoRole();
    expect(validarReserva(e, '2026-03-02', { data: '2026-03-12', valor: r(10) })).toMatchObject({ motivo: 'FORA_DO_CICLO' });
    expect(validarReserva(e, '2026-03-05', { data: '2026-03-04', valor: r(10) })).toMatchObject({ motivo: 'FORA_DO_CICLO' });
    expect(validarReserva(e, '2026-03-02', { data: '2026-03-04', valor: 0 })).toMatchObject({ motivo: 'VALOR_INVALIDO' });
  });

  it('CT35 — depois do dia fechado, a reserva é concluída e sai do R', () => {
    expect(reservaConcluida(reserva, '2026-03-06')).toBe(true);
    expect(reservaConcluida(reserva, '2026-03-05')).toBe(false);
    const e = estadoRole([reserva]);
    const fechadoNoDia = { ...e, ultimoFechamento: { data: '2026-03-06', saldo: r(60) } };
    expect(teto(fechadoNoDia, '2026-03-07').teto).toBe(r(12));
  });
});

describe('G. Streak (§3.9)', () => {
  const seq = (inicio: string, marcas: string) =>
    [...marcas].map((m, i) => {
      const d = new Date(`${inicio}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      return { data: d.toISOString().slice(0, 10), dentro: m === '✓' };
    });
  const valores = (p: { streak: number }[]) => p.map((x) => x.streak);

  it('CT36 — folga segura um dia, o segundo zera', () => {
    expect(valores(calcularStreak(seq('2026-03-02', '✓✓✗✓✗')))).toEqual([1, 2, 2, 3, 0]);
  });

  it('CT37 — com Streak em 0 a folga não é gasta', () => {
    const p = calcularStreak(seq('2026-03-02', '✓✓✗✓✗✗✗✗'));
    expect(valores(p).slice(-1)).toEqual([0]);
    expect(p.at(-1)!.folgaUsada).toBe(false);
  });

  it('CT38 — a folga renova na segunda-feira', () => {
    const p = calcularStreak(seq('2026-03-05', '✓✓✗✓✗')); // qui, sex, sáb, dom, seg
    expect(valores(p)).toEqual([1, 2, 2, 3, 3]);
    expect(p.map((x) => x.folgaUsada)).toEqual([false, false, true, false, true]);
  });

  it('CT39 — folga desligada', () => {
    expect(valores(calcularStreak(seq('2026-03-02', '✓✓✗'), { folgaSemanal: false }))).toEqual([1, 2, 0]);
  });
});

describe('H. Metas, fechamento semanal e fim de ciclo', () => {
  it('CT40 — saldo e progresso da meta', () => {
    const movs = [
      { data: '2026-03-02', tipo: 'APORTE_META' as const, valor: r(300), metaId: 'viagem' },
      { data: '2026-03-05', tipo: 'APORTE_META' as const, valor: r(100), metaId: 'viagem' },
      { data: '2026-03-05', tipo: 'APORTE_META' as const, valor: r(999), metaId: 'outra' },
    ];
    const saldo = saldoMeta(movs, 'viagem');
    expect(saldo).toBe(r(400));
    expect(progressoMeta(saldo, r(1000))).toBe(40);
  });

  it('CT41 — aporte sugerido em 3 meses', () => {
    expect(aporteSugerido(r(600), '2026-03-02', '2026-06-02')).toBe(r(200));
  });

  it('CT42 — menos de um mês conta como 1', () => {
    expect(aporteSugerido(r(600), '2026-03-02', '2026-03-12')).toBe(r(600));
  });

  it('CT43 — bônus de fim de semana vira reserva no sábado', () => {
    const o = opcoesFechamentoSemanal(r(30), cicloB({ bufferDias: 3 }), '2026-03-08');
    expect(o?.bonus).toEqual({ data: '2026-03-14', valor: r(30) });
  });

  it('CT44 — sábado fora do ciclo: bônus indisponível', () => {
    expect(opcoesFechamentoSemanal(r(30), cicloB(), '2026-03-08')?.bonus).toBeNull();
  });

  it('CT45 — sem economia, sem fechamento semanal', () => {
    expect(opcoesFechamentoSemanal(0, cicloB(), '2026-03-08')).toBeNull();
    expect(opcoesFechamentoSemanal(r(-5), cicloB(), '2026-03-08')).toBeNull();
  });

  it('CT46 — fim de ciclo com 50% para a meta', () => {
    const f = encerrarCiclo(r(60), [], 50);
    expect(f).toMatchObject({ sobra: r(60), aporte: r(30), saldoInicialNovoCiclo: r(30) });
  });

  it('CT47 — conta pendente vai atrasada para o novo ciclo', () => {
    const f = encerrarCiclo(r(60), [{ valor: r(35) }, { valor: r(10), pagaEm: '2026-03-05' }]);
    expect(f.sobra).toBe(r(25));
    expect(f.saldoInicialNovoCiclo).toBe(r(60));
    expect(f.contasAtrasadas).toEqual([{ valor: r(35), atrasada: true }]);
  });
});
