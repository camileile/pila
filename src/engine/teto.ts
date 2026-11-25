import { diasRestantes, provisaoPadraoDia, provisaoRestante, ultimoDia } from './ciclo';
import { intervalo, somarDias } from './datas';
import type { Centavos, Ciclo, Data, EstadoCiclo, GastoFixoDiario, Movimento } from './tipos';

export interface EntradaTeto {
  ciclo: Ciclo;
  gastosFixos: GastoFixoDiario[];
  data: Data;
  /** Saldo livre no começo do dia + eventos estruturais do dia. */
  saldoBase: Centavos;
  contasPendentes: Centavos;
  reservasFuturas: Centavos;
}

export interface ResultadoTeto {
  teto: Centavos;
  livre: Centavos;
  dias: number;
  provisao: Centavos;
  modoAperto: boolean;
  deficit: Centavos;
}

/** §3.1 — teto do dia. */
export function calcularTeto(e: EntradaTeto): ResultadoTeto {
  const dias = diasRestantes(e.ciclo, e.data);
  if (dias < 1) throw new RangeError(`Data ${e.data} está fora do ciclo`);
  const provisao = provisaoRestante(e.ciclo, e.gastosFixos, e.data);
  const livre = e.saldoBase - e.contasPendentes - provisao - e.reservasFuturas;
  return {
    teto: livre > 0 ? Math.floor(livre / dias) : 0,
    livre,
    dias,
    provisao,
    modoAperto: livre <= 0,
    deficit: livre < 0 ? -livre : 0,
  };
}

/** Efeito de um movimento no saldo livre. Gasto variável não é estrutural (D3). */
export function efeitoEstrutural(m: Movimento): Centavos {
  switch (m.tipo) {
    case 'ENTRADA_RENDA':
    case 'RESGATE_META':
      return m.valor;
    case 'PAGAMENTO_CONTA':
    case 'APORTE_META':
      return -m.valor;
    default:
      return 0;
  }
}

const somar = <T>(itens: T[], f: (x: T) => Centavos) => itens.reduce((t, x) => t + f(x), 0);

export const estruturaisDoDia = (e: EstadoCiclo, d: Data): Centavos =>
  somar(e.movimentos.filter((m) => m.data === d), efeitoEstrutural);

export const contasPendentesEm = (e: EstadoCiclo, d: Data): Centavos =>
  somar(e.contas.filter((c) => !c.pagaEm || c.pagaEm > d), (c) => c.valor);

export const reservasDesde = (e: EstadoCiclo, d: Data): Centavos =>
  somar(e.reservas.filter((r) => r.data >= d), (r) => r.valor);

export const reservasNoDia = (e: EstadoCiclo, d: Data): Centavos =>
  somar(e.reservas.filter((r) => r.data === d), (r) => r.valor);

export interface DiaProjetado {
  data: Data;
  saldoBase: Centavos;
  estruturais: Centavos;
  provisaoPadrao: Centavos;
  reservaDoDia: Centavos;
  /** provisão padrão + teto + reserva do dia */
  orcado: Centavos;
  resultado: ResultadoTeto;
}

/** Ponto de partida: último fechamento ou o saldo inicial do ciclo. */
export function base(e: EstadoCiclo) {
  return e.ultimoFechamento ?? { data: somarDias(e.ciclo.dataInicio, -1), saldo: e.ciclo.saldoInicial };
}

/**
 * §3.4 — projeta cada dia ainda não fechado até `ate`.
 * Dias sem fechamento consomem exatamente o orçado (saldo projetado).
 */
export function projetarAte(e: EstadoCiclo, ate: Data): DiaProjetado[] {
  const b = base(e);
  const primeiro = somarDias(b.data, 1);
  if (ate < primeiro) throw new RangeError(`${ate} já foi fechado`);
  if (ate > ultimoDia(e.ciclo)) throw new RangeError(`${ate} está fora do ciclo`);

  let saldo = b.saldo;
  return intervalo(primeiro, ate).map((data) => {
    const estruturais = estruturaisDoDia(e, data);
    saldo += estruturais;
    const resultado = calcularTeto({
      ciclo: e.ciclo,
      gastosFixos: e.gastosFixos,
      data,
      saldoBase: saldo,
      contasPendentes: contasPendentesEm(e, data),
      reservasFuturas: reservasDesde(e, data),
    });
    const provisaoPadrao = provisaoPadraoDia(e.ciclo, e.gastosFixos, data);
    const reservaDoDia = reservasNoDia(e, data);
    const dia: DiaProjetado = {
      data,
      saldoBase: saldo,
      estruturais,
      provisaoPadrao,
      reservaDoDia,
      orcado: provisaoPadrao + resultado.teto + reservaDoDia,
      resultado,
    };
    saldo -= dia.orcado;
    return dia;
  });
}

/** Teto (e detalhes) do dia `d`. */
export const tetoDoDia = (e: EstadoCiclo, d: Data): DiaProjetado => projetarAte(e, d).at(-1)!;
