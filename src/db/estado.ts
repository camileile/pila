// Converte as linhas do banco no formato que o motor entende. Funções puras (testáveis).
import {
  base,
  ehDiaAtivo,
  diaDaSemana,
  intervalo,
  segundaDaSemana,
  somarDias,
  ultimoDia,
  type Centavos,
  type DiaFechado,
  type Data,
  type EstadoCiclo,
} from '../engine';
import type {
  CicloRow, ContaCicloRow, FechamentoRow, GastoFixoRow, MovimentoRow, RegistroFixoRow, ReservaRow,
} from './db';

export interface DadosCiclo {
  ciclo: CicloRow;
  gastosFixos: GastoFixoRow[];
  contas: ContaCicloRow[];
  registros: RegistroFixoRow[];
  movimentos: MovimentoRow[];
  reservas: ReservaRow[];
  fechamentos: FechamentoRow[];
}

export const ultimoFechamento = (f: FechamentoRow[]): FechamentoRow | undefined =>
  [...f].sort((a, b) => a.dataFim.localeCompare(b.dataFim)).at(-1);

export function montarEstado(d: DadosCiclo): EstadoCiclo {
  const ult = ultimoFechamento(d.fechamentos);
  return {
    ciclo: d.ciclo,
    gastosFixos: d.gastosFixos.filter((g) => g.ativo),
    contas: d.contas.filter((c) => !c.adiada).map((c) => ({ valor: c.valor, pagaEm: c.pagaEm })),
    reservas: d.reservas.map((r) => ({ data: r.data, valor: r.valor })),
    movimentos: d.movimentos.map((m) => ({ data: m.data, tipo: m.tipo, valor: m.valor, metaId: m.metaId })),
    ultimoFechamento: ult ? { data: ult.dataFim, saldo: ult.saldoFinal } : null,
  };
}

/** Custo real dos gastos fixos num dia: checklist se houver, senão o padrão. */
export function provisaoRealDia(d: DadosCiclo, data: Data): Centavos {
  if (!ehDiaAtivo(d.ciclo, data)) return 0;
  return d.gastosFixos
    .filter((g) => g.ativo)
    .reduce((t, g) => {
      const reg = d.registros.find((r) => r.gastoFixoId === g.id && r.data === data);
      return t + (reg ? reg.valorTotal : g.valorUnitario * g.qtdPadraoDia);
    }, 0);
}

export const gastosVariaveisEntre = (d: DadosCiclo, de: Data, ate: Data): Centavos =>
  d.movimentos
    .filter((m) => m.tipo === 'GASTO_VARIAVEL' && m.data >= de && m.data <= ate)
    .reduce((t, m) => t + m.valor, 0);

/**
 * Data em que um lançamento novo deve entrar: hoje, ou o primeiro dia ainda aberto se hoje já foi
 * fechado (senão o movimento cairia num dia fechado e viraria "gasto" no próximo fechamento).
 * null quando o ciclo já foi todo fechado.
 */
export function dataLancamento(d: DadosCiclo, hoje: Data): Data | null {
  const proximoAberto = somarDias(base(montarEstado(d)).data, 1);
  const data = hoje > proximoAberto ? hoje : proximoAberto;
  return data <= ultimoDia(d.ciclo) ? data : null;
}

/** Expande cada fechamento nos dias que ele cobre, para o cálculo do Streak. */
export function diasDosFechamentos(f: FechamentoRow[]): DiaFechado[] {
  return f.flatMap((x) => intervalo(x.dataInicio, x.dataFim).map((data) => ({ data, dentro: x.dentro })));
}

export interface SemanaParaFechar {
  segunda: Data;
  domingo: Data;
  economia: Centavos;
}

/**
 * §3.10 — semana que ainda precisa de decisão: a atual se hoje é domingo e já foi fechado,
 * senão a semana anterior. Só aparece se teve economia e ainda não foi resolvida.
 */
export function semanaParaFechar(d: DadosCiclo, hoje: Data, resolvidas: Data[] = []): SemanaParaFechar | null {
  const segAtual = segundaDaSemana(hoje);
  const ultimo = ultimoFechamento(d.fechamentos)?.dataFim ?? '';
  const segunda = diaDaSemana(hoje) === 0 && ultimo >= hoje ? segAtual : somarDias(segAtual, -7);
  const domingo = somarDias(segunda, 6);
  if (resolvidas.includes(segunda)) return null;
  const economia = d.fechamentos
    .filter((f) => f.dataFim >= segunda && f.dataFim <= domingo)
    .reduce((t, f) => t + f.economia, 0);
  return economia > 0 ? { segunda, domingo, economia } : null;
}

/** Lançamentos de categorização de todo o período em aberto até `ate`. */
export function lancamentosAte(d: DadosCiclo, ate: Data) {
  const de = base(montarEstado(d)).data;
  const dias = intervalo(de, ate).slice(1);
  return {
    provisaoReal: dias.reduce((t, x) => t + provisaoRealDia(d, x), 0),
    gastosVariaveis: dias.length ? gastosVariaveisEntre(d, dias[0]!, ate) : 0,
  };
}
