# Casos de teste do motor (golden cases)

Estes casos são a referência da Fase 1: cada um vira um teste no Vitest.
Os valores estão em R$ para facilitar a leitura, mas o motor trabalha em **centavos**.
As seções citadas (§) são do [escopo-v2.md](escopo-v2.md).

## Cenário base (B)

| Item | Valor |
|---|---|
| Ciclo | 2026-03-02 (seg) → 2026-03-11 (qua), buffer 0 |
| Dias corridos | 10 |
| Dias ativos | seg–sex |
| Saldo inicial | 500,00 |
| Contas fixas | Internet 35,00 (pendente) |
| Gasto fixo diário | Mototáxi 7,00 × 2 = 14,00 por dia ativo |

Dias ativos de 02 a 11/03: 02, 03, 04, 05, 06, 09, 10 e 11, ou seja, **8 dias**.

---

## A. Teto do dia (§3.1)

| ID | Situação | Cálculo | Esperado |
|---|---|---|---|
| CT01 | B, hoje 02/03 | C = 8 × 14 = 112 · L = 500 − 35 − 112 = 353 · D = 10 | **T = 35,30** |
| CT02 | B + buffer 3 (último dia 14/03, sáb) | Ativos +12 e +13 → 10 · C = 140 · L = 325 · D = 13 | **T = 25,00** |
| CT03 | B + recesso 09–11/03 | Ativos 5 · C = 70 · L = 395 · D = 10 (o recesso continua no divisor) | **T = 39,50** |
| CT04 | Ciclo de 3 dias, saldo 100,00, sem contas nem gastos fixos | 10000 / 3 = 3333,33 cent. | **T = 33,33** (resto de 0,01 fica no saldo) |
| CT05 | B com saldo 100,00 | L = 100 − 35 − 112 = −47 | **T = 0**, modo aperto, **déficit 47,00** |
| CT06 | B, pagou a internet em 02/03 | S_base = 465 · P = 0 · L = 353 | **T = 35,30** (pagamento neutro, §3.7) |
| CT07 | B, renda de 300,00 sem carimbo em 02/03 | S_base = 800 · L = 653 · D = 10 | **T = 65,30** (recalculado no ato, D10) |
| CT08 | Dia ativo em recesso | — | provisão do dia = **0** |
| CT09 | Sábado fora de recesso | — | provisão do dia = **0**, mas conta em D |

## B. Durante o dia (§3.2)

| ID | Situação | Esperado |
|---|---|---|
| CT10 | T = 18,50 · provisão padrão 14,00 · checklist "1 moto" (7,00) | economia_fixo = 7,00 · **resta = 25,50** · **O = 32,50** |
| CT11 | Mesmo dia + gasto variável de 12,00 | **resta = 13,50** · O continua **32,50** |
| CT12 | Checklist "3 motos" (21,00) | economia_fixo = −7,00 · **resta = 11,50** · O = 32,50 |
| CT13 | Checklist "Não houve gasto" | economia_fixo = 14,00 · **resta = 32,50** |
| CT14 | Dia com reserva de 80,00, T = 12,00, sem provisão | **resta = 92,00** · **O = 92,00** |

## C. Fechamento (§3.3)

| ID | Situação | Cálculo | Esperado |
|---|---|---|---|
| CT15 | **UC04 corrigido:** CT10 + S_inicio 170,00, S_atual 137,00 | G = 33,00 · O = 32,50 | **economia = −0,50**, dentro = **false** |
| CT16 | O = 32,50 · S_inicio 170 · renda bruta 500 com carimbo 20% (líquido 400) · pagou internet 35 · S_atual 505 | estruturais = +400 − 35 = 365 · G = 170 + 365 − 505 = 30 | **economia = 2,50**, dentro = true |
| CT17 | S_inicio 100, S_atual 150, nada registrado | G = −50 | flag **"entrou dinheiro?"** |
| CT18 | CT17 + a pessoa registra renda de 50 sem carimbo | G = 100 + 50 − 150 = 0 | economia = O, sem flag |
| CT19 | G = 33 · checklist 7 · variáveis 20 (alimentação) | 33 − 7 − 20 | **não categorizado = 6,00** |
| CT20 | G = 33 · checklist 7 · variáveis 40 | 33 − 7 − 40 < 0 | **não categorizado = 0** + aviso de inconsistência |
| CT21 | Aporte manual em meta de 50 no dia · S_inicio 200 · S_atual 130 · O = 30 | G = 200 − 50 − 130 = 20 | **economia = 10,00** |

## D. Redistribuição e saldo projetado (§3.4, D5)

| ID | Situação | Cálculo | Esperado |
|---|---|---|---|
| CT22 | B, dia 02 **não** fechado, hoje 03/03 | S_proj = 500 − (14 + 35,30) = 450,70 · C = 7 × 14 = 98 · L = 450,70 − 35 − 98 = 317,70 · D = 9 | **T = 35,30** (estável) |
| CT23 | B, 02/03 fechado com S_atual 400 (estouro) | G = 100 · O = 49,30 · economia −50,70. No dia 03: L = 400 − 35 − 98 = 267 · D = 9 | **T(03) = 29,66** |
| CT24 | B, fechamento de 02+03 juntos, S_atual 410 | O_total = 2 × 49,30 = 98,60 · G = 90 | **economia = 8,60**, 1 registro, Streak +2 |
| CT25 | Gastou exatamente o orçado em todos os dias de B | — | T fica estável em todos os dias (± 0,01) |

## E. Carimbo (§3.5)

| ID | Bruto | Regra | Esperado (carimbo / líquido) |
|---|---|---|---|
| CT26 | 500,00 | 20% | **100,00 / 400,00** |
| CT27 | 450,00 | 20% | **90,00 / 360,00** (UC02 alternativo) |
| CT28 | 333,33 | 15% | 49,9995 → **50,00 / 283,33** (arredonda metade para cima) |
| CT29 | 80,00 | Fixo 100,00 | **80,00 / 0,00** (limitado ao bruto) |
| CT30 | 200,00 | Nenhuma | **0,00 / 200,00** |
| CT31 | qualquer | 0% ou 100% | válido · 101% e −1% são **rejeitados** |

## F. Modo Rolê (§3.6)

| ID | Situação | Esperado |
|---|---|---|
| CT32 | **UC05:** 10 dias restantes, L = 200 (T = 20), reserva de 80 para daqui a 4 dias | L = 120 · **T = 12,00** em todos os dias restantes |
| CT33 | CT32 com reserva de 250 | **recusada**, mensagem com o máximo de **200,00** |
| CT34 | Reserva com data depois do último dia do ciclo, ou antes de hoje | **recusada** |
| CT35 | Dia da reserva fechado | reserva marcada como `concluida = true` e sai do R |

## G. Streak (§3.9)

Semana de seg a dom, com folga ligada.

| ID | Sequência de dias (✓ dentro / ✗ fora) | Streak depois de cada dia |
|---|---|---|
| CT36 | seg ✓, ter ✓, qua ✗, qui ✓, sex ✗ | 1, 2, **2** (usou a folga), 3, **0** |
| CT37 | CT36 + próx. seg ✗ (folga nova) | **0** (continua 0) |
| CT38 | sáb ✗ (usa a folga), dom ✓, **seg ✗** | sáb mantém, dom +1, seg usa a **folga da nova semana** |
| CT39 | Folga desligada: ✓ ✓ ✗ | 1, 2, **0** |

## H. Metas, fechamento semanal e fim de ciclo (§3.8, §3.10, §3.11)

| ID | Situação | Esperado |
|---|---|---|
| CT40 | Meta 1.000 · aportes 400 · resgate 0 | saldo = **400,00** · progresso **40%** |
| CT41 | Falta 600 · hoje 2026-03-02 · alvo 2026-06-02 | 3 meses → **aporte sugerido = 200,00/mês** |
| CT42 | Falta 600 · alvo em 10 dias | meses = max(1, 0) = 1 → **600,00** |
| CT43 | Semana com economia total de 30,00 → "Bônus de fim de semana" | cria reserva de **30,00** no próximo sábado |
| CT44 | CT43, mas o próximo sábado fica depois do ciclo | opção **indisponível** |
| CT45 | Semana com economia total ≤ 0 | fechamento semanal **não é oferecido** |
| CT46 | Fim de ciclo: S_final 60,00, sem contas pendentes, manda 50% para uma meta | aporte de **30,00** · saldo inicial do novo ciclo **30,00** |
| CT47 | Fim de ciclo com a internet (35,00) pendente | sobra = S_final − 35 · a conta vai para o novo ciclo com `atrasada = true` |
