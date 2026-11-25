// Testes das peças de apoio (datas, termômetro, erros) que os golden cases não cobrem.
import { describe, expect, it } from 'vitest';
import {
  aporteSugerido,
  calcularCarimbo,
  calcularTeto,
  dentroDoCiclo,
  diaDaSemana,
  efeitoEstrutural,
  encerrarCiclo,
  estadoDoDia,
  faixaTermometro,
  hojeEmSaoPaulo,
  mesesInteiros,
  progressoMeta,
  projetarAte,
  proximoSabado,
  saldoMeta,
  segundaDaSemana,
  somarMeses,
  validarRegraCarimbo,
  type EstadoCiclo,
} from './index';

const estado: EstadoCiclo = {
  ciclo: { dataInicio: '2026-03-02', dataFim: '2026-03-11', bufferDias: 0, diasAtivos: [], recessos: [], saldoInicial: 10000 },
  gastosFixos: [],
  contas: [],
  reservas: [],
  movimentos: [],
  ultimoFechamento: { data: '2026-03-04', saldo: 5000 },
};

describe('datas', () => {
  it('dia da semana, segunda e próximo sábado', () => {
    expect(diaDaSemana('2026-03-02')).toBe(1);
    expect(segundaDaSemana('2026-03-08')).toBe('2026-03-02');
    expect(segundaDaSemana('2026-03-02')).toBe('2026-03-02');
    expect(proximoSabado('2026-03-07')).toBe('2026-03-14');
    expect(proximoSabado('2026-03-06')).toBe('2026-03-07');
  });

  it('meses com fim de mês e virada de ano', () => {
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28');
    expect(somarMeses('2026-11-15', 2)).toBe('2027-01-15');
    expect(mesesInteiros('2026-01-31', '2026-02-27')).toBe(0);
    expect(mesesInteiros('2026-01-31', '2026-02-28')).toBe(1);
  });

  it('hoje no fuso de São Paulo', () => {
    // 02:00 UTC de 03/03 ainda é 02/03 em São Paulo (UTC−3)
    expect(hojeEmSaoPaulo(new Date('2026-03-03T02:00:00Z'))).toBe('2026-03-02');
  });
});

describe('teto e projeção — limites', () => {
  it('data fora do ciclo ou já fechada gera erro', () => {
    expect(() => projetarAte(estado, '2026-03-12')).toThrow(RangeError);
    expect(() => projetarAte(estado, '2026-03-04')).toThrow(RangeError);
    expect(() =>
      calcularTeto({ ciclo: estado.ciclo, gastosFixos: [], data: '2026-03-12', saldoBase: 0, contasPendentes: 0, reservasFuturas: 0 }),
    ).toThrow(RangeError);
  });

  it('parte do último fechamento', () => {
    expect(projetarAte(estado, '2026-03-05')[0]!.saldoBase).toBe(5000);
  });

  it('livre exatamente zero é modo aperto sem déficit', () => {
    const t = calcularTeto({ ciclo: estado.ciclo, gastosFixos: [], data: '2026-03-02', saldoBase: 0, contasPendentes: 0, reservasFuturas: 0 });
    expect(t).toMatchObject({ teto: 0, modoAperto: true, deficit: 0 });
  });

  it('dentroDoCiclo e efeitos estruturais', () => {
    expect(dentroDoCiclo(estado.ciclo, '2026-03-11')).toBe(true);
    expect(dentroDoCiclo(estado.ciclo, '2026-03-01')).toBe(false);
    expect(efeitoEstrutural({ data: '2026-03-02', tipo: 'RESGATE_META', valor: 10 })).toBe(10);
    expect(efeitoEstrutural({ data: '2026-03-02', tipo: 'APORTE_META', valor: 10 })).toBe(-10);
    expect(efeitoEstrutural({ data: '2026-03-02', tipo: 'GASTO_VARIAVEL', valor: 10 })).toBe(0);
  });
});

describe('termômetro', () => {
  it('três faixas', () => {
    expect(faixaTermometro(50, 100)).toBe('positivo');
    expect(faixaTermometro(49, 100)).toBe('atencao');
    expect(faixaTermometro(0, 0)).toBe('atencao');
    expect(faixaTermometro(-1, 100)).toBe('alerta');
    expect(estadoDoDia({ teto: 1000, provisaoPadrao: 0, gastosVariaveis: 1200 }).faixa).toBe('alerta');
  });
});

describe('validações e casos de borda', () => {
  it('carimbo', () => {
    expect(validarRegraCarimbo({ tipo: 'FIXO', valor: -1 })).not.toBeNull();
    expect(validarRegraCarimbo({ tipo: 'FIXO', valor: 1.5 })).not.toBeNull();
    expect(() => calcularCarimbo(-100, { tipo: 'NENHUMA' })).toThrow(RangeError);
  });

  it('metas', () => {
    expect(saldoMeta([{ data: '2026-03-02', tipo: 'RESGATE_META', valor: 300, metaId: 'm' },
      { data: '2026-03-02', tipo: 'GASTO_VARIAVEL', valor: 50, metaId: 'm' }], 'm')).toBe(-300);
    expect(progressoMeta(5000, 1000)).toBe(100);
    expect(progressoMeta(100, 0)).toBe(0);
    expect(aporteSugerido(0, '2026-03-02', '2026-06-02')).toBe(0);
  });

  it('fim de ciclo', () => {
    expect(() => encerrarCiclo(100, [], 150)).toThrow(RangeError);
    expect(encerrarCiclo(-500, [], 50)).toMatchObject({ sobra: -500, aporte: 0, saldoInicialNovoCiclo: -500 });
  });
});
