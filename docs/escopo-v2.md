# Escopo v2 — Gestão Financeira Diária Adaptativa

> Revisão do escopo original. Este documento **substitui** as seções 2, 3, 6 e 7 do original
> onde houver conflito. Contexto, justificativa e proposta de valor (seção 1) continuam valendo.

**Contexto do MVP:** projeto pessoal, 1 desenvolvedora, uso próprio, sem prazo fixo,
**100% local** (sem backend e sem login), mas com dados preparados para escalar no futuro.

---

## 1. Decisões fechadas

| # | Tema | Decisão |
|---|---|---|
| D1 | Rendas previstas | O teto considera **só o dinheiro que já caiu**. As rendas previstas aparecem como "a receber" e não aumentam o teto. |
| D2 | Cofrinhos | São **caixinhas reais no banco**. O app lembra de transferir e registra a transferência. O `S` (saldo) é sempre o **saldo livre**, sem as caixinhas. |
| D3 | Gasto rápido x sincronização | O lançamento manual **só categoriza** os gastos. Quem manda é a diferença de saldo, e o que não foi lançado vira "não categorizado". |
| D4 | Modo Rolê | A reserva é descontada de **todos os dias restantes** do ciclo. |
| D5 | Estouro do teto | O valor que passou é redistribuído **automaticamente** entre os dias seguintes. O Streak tem 1 dia de folga por semana. |
| D6 | Fim do ciclo | A sobra passa para o próximo ciclo, e o app oferece mandar uma parte para uma meta. |
| D7 | Cartão de crédito | **Fora do MVP.** O app cobre só débito e Pix. |
| D8 | Divisor do teto | O teto livre é dividido por **todos os dias corridos** restantes, e não só pelos dias de aula (comer e gastar acontece todo dia). Os gastos fixos diários (transporte) só valem nos **dias ativos**. |
| D9 | Buffer "Ficar de Boa" | São **N dias corridos** somados depois de `data_fim`, seguindo o mesmo calendário de dias ativos. Ou seja, buffer em dia de aula também reserva o transporte. |
| D10 | Teto congelado | O teto do dia é calculado **uma vez**, no começo do dia. Durante o dia, o app mostra "resta hoje". Ele só é recalculado quando acontece um **evento estrutural**: entrada de renda, nova conta, nova reserva, aporte ou resgate de meta, ou mudança no ciclo. Lançar gasto **não** recalcula o teto. |
| D11 | Dinheiro | Todos os valores são guardados em **centavos inteiros** (`number`, sem float). O teto é arredondado **para baixo**, e o resto fica no saldo e é redistribuído. |
| D12 | Datas | Datas em `YYYY-MM-DD`, no fuso **America/Sao_Paulo**. O dia vira à meia-noite local. |
| D13 | Plataforma | PWA: Vite + React + TypeScript + Dexie (IndexedDB) + vite-plugin-pwa. Testes com Vitest. Hospedagem estática gratuita. |

---

## 2. Glossário

| Termo | Significado |
|---|---|
| **Ciclo** | Período de planejamento: `data_inicio` → `data_fim`, mais o buffer. |
| **Último dia do ciclo** | `data_fim + buffer_dias`. |
| **Dia ativo** | Dia da semana marcado como ativo (ex.: seg–sex) e que não está em recesso. |
| **Saldo livre (`S`)** | O que está na conta e pode ser movimentado, sem contar as caixinhas. |
| **Provisão diária** | Soma dos gastos fixos diários (`valor_unitario × qtd_padrao`) num dia ativo. Em dia não ativo, é 0. |
| **Livre do ciclo (`L`)** | O que sobra depois de reservar contas, transporte e picos. |
| **Teto do dia (`T`)** | Quanto se pode gastar livremente hoje. |
| **Orçado do dia (`O`)** | Provisão padrão de hoje + `T` + reservas de hoje. |
| **Evento estrutural** | Renda, pagamento de conta fixa, aporte ou resgate de meta, criação ou remoção de reserva. |

---

## 3. Motor de cálculo

### 3.1 Teto do dia

Para o dia `d` do ciclo:

```
S_base = saldo no começo de d (real, se o dia anterior foi fechado; senão, projetado, ver 3.4)
         + efeitos dos eventos estruturais já registrados em d
P      = soma das contas fixas do ciclo que ainda não foram pagas
C      = soma da provisão diária padrão de cada dia de d até o último dia do ciclo
R      = soma das reservas não concluídas com data ≥ d
D      = quantidade de dias corridos de d até o último dia do ciclo (incluindo os dois)

L = S_base − P − C − R
T = L > 0 ? floor(L / D) : 0
```

- Se `L ≤ 0`, o app entra em **modo aperto**: `T = 0` e ele mostra o déficit `−L`
  ("faltam R$ X para cobrir contas e transporte até o fim do ciclo").
- O resto do arredondamento não some: ele continua em `S` e reaparece nos dias seguintes.

### 3.2 Durante o dia (o que o dashboard mostra)

```
provisao_real_hoje = valor do checklist (se ele não foi preenchido, vale a provisão padrão)
economia_fixo      = provisao_padrao_hoje − provisao_real_hoje      (pode ser negativa)
reserva_hoje       = soma das reservas com data = hoje

resta_hoje = T + economia_fixo + reserva_hoje − soma(gastos variáveis lançados hoje)
```

O **orçado do dia** não muda com o checklist. A economia só troca de "transporte" para "livre":

```
O = provisao_padrao_hoje + T + reserva_hoje
```

Exemplo do UC03/UC04 corrigido: com T = 18,50 e provisão = 14,00, o orçado é **32,50**,
e não 39,50 como estava no escopo original.

### 3.3 Fechamento (sincronização de saldo)

A pessoa informa `S_atual` (o saldo livre que aparece no app do banco).

```
estruturais = + entradas líquidas de renda (bruto − carimbo)
              + resgates de meta
              − pagamentos de contas fixas
              − aportes em meta

G_real   = S_inicio + estruturais − S_atual
economia = O − G_real
dentro   = economia ≥ 0
```

- **Se `G_real < 0`** (o saldo subiu sem nenhuma renda registrada), o app pergunta
  "Entrou dinheiro? É alguma renda?". Se a pessoa registrar a renda, o cálculo é refeito.
  Se ela disser que não, o valor é aceito como economia.
- **Categorização (D3):** `nao_categorizado = max(0, G_real − provisao_real_hoje − soma(variáveis))`.
  Se os lançamentos passarem de `G_real`, o app avisa ("os lançamentos passam do gasto real")
  e `nao_categorizado = 0`.
- As reservas com data no período fechado são marcadas como **concluídas**.
- Depois do fechamento, o saldo real `S_atual` passa a ser a base do dia seguinte. A sobra ou o
  estouro entram sozinhos no novo cálculo do teto (D5).

### 3.4 Dias sem fechamento (saldo projetado)

Se o dia anterior não foi fechado, o app considera que a pessoa gastou exatamente o orçado:

```
S_projetado(d) = S_real_último_fechamento + estruturais(período) − soma(O de cada dia não fechado antes de d)
```

Consequência: se a pessoa gasta exatamente o orçado, o teto fica **estável**
(com diferença de no máximo alguns centavos por causa do arredondamento).

**Fechamento de vários dias:** um único `S_atual` fecha todo o período em aberto.
`O_total` é a soma dos orçados de cada dia e `G_real` é calculado sobre o período inteiro.
O fechamento é gravado como **um registro só**, cobrindo o período, e os dias entram no Streak
juntos: se `economia_total ≥ 0`, todos contam; senão, valem as regras de estouro.

### 3.5 Rendas e carimbo ("Caiu, Guardou")

| Regra | Cálculo |
|---|---|
| `NENHUMA` | `carimbo = 0` |
| `PERCENTUAL p` | `carimbo = round_half_up(bruto × p / 100)`, em centavos |
| `FIXO v` | `carimbo = min(v, bruto)` |

- `liquido = bruto − carimbo`
- O percentual é aplicado sobre o valor **recebido de fato**, e não sobre o valor previsto.
  O app mostra a conta e pede confirmação antes de salvar.
- O app gera dois registros: uma `ENTRADA_RENDA` (bruto) e um `APORTE_META` (carimbo, origem `CARIMBO`).
  O efeito em `S` é `+liquido`.

### 3.6 Modo Rolê (reserva futura)

- A data precisa estar entre hoje e o último dia do ciclo, e o valor precisa ser maior que 0.
- **A reserva é recusada** se deixar `L` negativo ("não cabe no ciclo; o máximo agora é R$ X").
- No dia da reserva, o valor dela soma ao orçado e ao "resta hoje".
- Se a pessoa gastar mais ou menos que o reservado, a diferença entra no fechamento como qualquer outra.

### 3.7 Contas fixas mensais

- Enquanto não está paga, a conta entra em `P`.
- Pagar uma conta é **neutro para o teto**: `S` e `P` caem o mesmo valor.
- O app mostra um alerta de vencimento (D-3 e no dia do vencimento) quando a conta tem data.

### 3.8 Metas e cofrinhos

- O saldo de uma meta é calculado (não guardado): `soma(aportes) − soma(resgates)`.
- O **Cofrinho Geral** é uma meta do tipo `GERAL`, sem valor-alvo e sem data. Pode ser resgatado
  numa emergência, e o resgate aumenta `S`, ou seja, aumenta o teto.
- **Aporte sugerido:** `ceil(falta / meses_restantes)`, com `meses_restantes = max(1, meses inteiros
  entre hoje e a data_alvo)`.

### 3.9 Streak (sequência no azul)

- Um dia fechado com `dentro = true` soma +1.
- Um dia fechado com `dentro = false`:
  - se a semana (seg–dom) ainda tem a folga, ela é usada e o Streak **fica como está**;
  - se a folga já foi usada, o Streak **volta para 0**.
- Os dias são processados em ordem cronológica, inclusive num fechamento de vários dias.
- O tom das mensagens é sempre encorajador, nunca punitivo.

### 3.10 Fechamento semanal

Todo domingo à noite, ou na primeira abertura do app depois disso, o app mostra a
`soma(economia)` da semana. Se a soma for maior que 0, ele oferece:

| Opção | O que faz |
|---|---|
| **Mover X% para uma meta** | Gera um aporte. Efeito: reduz `S`. |
| **Guardar tudo** | Aporte de 100% no Cofrinho Geral. |
| **Bônus de fim de semana** | Cria uma reserva com o valor para o próximo sábado, se ele estiver dentro do ciclo. |
| **Deixar como está** | Nada muda. O valor já está diluído nos próximos dias. |

### 3.11 Fim do ciclo

- O ciclo termina quando a pessoa fecha o último dia, **ou** quando decide começar um novo ciclo
  antes disso (por exemplo, a bolsa caiu durante o buffer).
- Para isso, o app pede um fechamento de saldo, caso ainda não tenha.
- `sobra = S_final − P_pendentes`. O app oferece mandar uma parte para uma meta.
- As contas pendentes passam para o novo ciclo, marcadas como **atrasadas**.
- O novo ciclo é pré-preenchido com o calendário, as contas e os gastos diários do anterior.

---

## 4. Requisitos funcionais (revisados)

| ID | Nome | Mudanças em relação ao original |
|---|---|---|
| RF01 | Ciclos | Escolha dos dias ativos da semana, períodos de recesso e buffer em dias corridos (D9). O novo ciclo é pré-preenchido. |
| RF02 | Rendas e carimbo | Regra de carimbo `NENHUMA`, `PERCENTUAL` ou `FIXO`. Valor previsto e dia previsto são opcionais (aparecem em "a receber"). |
| RF03 | Contas fixas | Ficam como **modelo** (fixo) e **instância por ciclo**. Vencimento opcional. Pagamento neutro (3.7). |
| RF04 | Gastos fixos diários | Valem só em dias ativos fora de recesso. |
| RF05 | Checklist diário | Opções: Padrão, Alterar quantidade, Não houve gasto. Muda o "resta hoje", mas **não** o orçado (3.2). |
| RF06 | Gasto rápido | Valor + categoria (data = hoje por padrão). **Só categoriza** (D3), mas já desconta do "resta hoje". |
| RF07 | Sincronização de saldo | Fórmula 3.3, fechamento de vários dias (3.4) e pergunta "entrou dinheiro?". |
| RF08 | Modo Rolê | Regras 3.6. |
| RF09 | Metas e cofrinhos | Saldo calculado. Cofrinho Geral. Aporte e resgate manuais. |
| RF10 | Economia | Por dia, semana e ciclo, calculada a partir dos fechamentos. |
| RF11 | Streak | Regras 3.9. |
| RF12 | Fechamento semanal | Regras 3.10. Sem push notification no MVP: o app mostra quando é aberto. |
| RF13 | Dashboard | Teto do dia, "resta hoje" e termômetro (verde: ≥ 50% restante; amarelo: 0–50%; vermelho: < 0). |
| RF14 | Extrato | Movimentações e fechamentos do ciclo, com filtro por tipo e categoria. |
| **RF15** | **Backup** *(novo)* | Exportar e importar um JSON completo. Lembrete se fizer mais de 7 dias sem backup. |
| **RF16** | **Modo aperto** *(novo)* | Quando `L ≤ 0`: mostra o déficit e as contas que dá para adiar. |
| **RF17** | **Desfazer/editar** *(novo)* | Todo lançamento pode ser editado ou excluído (exclusão lógica) e o teto é recalculado. |

## 5. Requisitos não funcionais (revisados)

| ID | Requisito |
|---|---|
| RNF01 | Gasto rápido e sincronização em **até 3 toques**. Mobile-first, uso com uma mão só. |
| RNF02 | Funciona 100% offline. Pede armazenamento persistente com `navigator.storage.persist()`. Instalável como PWA. |
| RNF03 | Motor de cálculo em **menos de 100 ms**. Pacote inicial com **menos de 150 KB gzip**. |
| RNF04 | Dados só no aparelho. Nada é enviado para terceiros. Sem analytics no MVP. |
| RNF05 | Motor em **módulo puro**, sem React e sem Dexie, com **≥ 90% de cobertura** de testes. |
| RNF06 | Acessibilidade: contraste AA, área de toque ≥ 44 px, valores com `aria-label` por extenso. |
| ~~RNF04 orig.~~ | Login, bcrypt e multi-tenant ficam para a **Fase 5**. |

---

## 6. Modelo de dados (IndexedDB / Dexie)

Todo registro tem: `id` (UUID v4 gerado no aparelho), `criadoEm`, `atualizadoEm` e
`excluidoEm` (`null` = ativo). Valores em **centavos**. Datas em `YYYY-MM-DD`.
Esses campos já deixam os dados prontos para sincronizar com um servidor na Fase 5.

```ts
Ciclo            { titulo, dataInicio, dataFim, bufferDias,
                   diasAtivos: number[] /* 0=dom … 6=sáb */,
                   saldoInicial, status: 'ATIVO'|'CONCLUIDO' }
Recesso          { cicloId, dataInicio, dataFim, descricao }

FonteRenda       { nome, valorPrevisto?, diaPrevisto?,
                   regraCarimbo: { tipo: 'NENHUMA'|'PERCENTUAL'|'FIXO', valor },
                   metaDestinoId? }

ContaFixa        { descricao, valor, diaVencimento?, ativa }                // modelo
ContaFixaCiclo   { cicloId, contaFixaId?, descricao, valor,
                   vencimento?, pagaEm?, atrasada }                         // instância

GastoFixoDiario  { descricao, valorUnitario, qtdPadraoDia, ativo }
RegistroFixoDia  { cicloId, gastoFixoId, data, qtd, valorTotal }

Meta             { tipo: 'GERAL'|'META', titulo, valorObjetivo?, dataAlvo?, ativa }

Movimentacao     { cicloId, data, tipo, valor, categoria?, descricao?,
                   fonteId?, metaId?, contaFixaCicloId?, origem?: 'CARIMBO'|'MANUAL'|'SEMANAL' }
  tipo: ENTRADA_RENDA | PAGAMENTO_CONTA | GASTO_VARIAVEL
      | APORTE_META | RESGATE_META | AJUSTE_SALDO

ReservaFutura    { cicloId, data, descricao, valor, concluida }

Fechamento       { cicloId, dataInicio, dataFim, saldoInicial, saldoFinal,
                   estruturais, orcado, gastoReal, economia,
                   naoCategorizado, dentro, folgaUsada }

Configuracao     { ultimoBackupEm?, categorias: string[], folgaSemanal: boolean }
```

O que mudou em relação ao modelo original:
- **Removidos:** `usuario` (não tem login no MVP), `meta.valor_atual` (agora é calculado)
  e `ciclo.saldo_conta_atual` (o saldo vem dos fechamentos).
- **Adicionados:** `Recesso`, o par modelo + instância das contas fixas, `regraCarimbo` com tipo,
  `Configuracao` e os campos de sincronização em todos os registros.

---

## 7. Telas (esboço)

```
┌─ Hoje ─────────────────────┐  ┌─ Fechar o dia ─────────────┐  ┌─ + Gasto ──────────────────┐
│  Seg, 02 mar · 🔥 5 dias    │  │ Quanto tem na conta agora? │  │  R$ [ 12,00 ]              │
│                            │  │                            │  │                            │
│   Posso gastar hoje        │  │   R$ [ 137,00 ]            │  │ [Alimentação] [Lazer]      │
│      R$ 25,50              │  │                            │  │ [Delivery]   [Outros]      │
│   ███████░░░  resta 18,50  │  │ Orçado 32,50 · Gasto 33,00 │  │                            │
│                            │  │ ⚠ passou R$ 0,50           │  │       [ Salvar ]           │
│ 🛵 Mototáxi  2×7,00        │  │ (amanhã se ajusta sozinho) │  └────────────────────────────┘
│ [Padrão] [Alterar] [Não]   │  │                            │
│                            │  │       [ Confirmar ]        │
│ Contas a pagar: 35,00      │  └────────────────────────────┘
│ Cofrinhos: 340,00          │
│ [+ Gasto]  [Fechar o dia]  │   Outras telas: Ciclo (passo a passo), Rendas,
└────────────────────────────┘   Metas, Modo Rolê, Extrato, Ajustes/Backup
```

Navegação: barra inferior com **Hoje · Extrato · Metas · Mais**. O botão "+" fica sempre visível.

---

## 7.1 Direção visual (v1.0)

Linha visual moderna, jovem e minimalista. Predominam o branco e os neutros; o azul é a âncora
visual e o limão aparece em pequenas doses. Nada de cara burocrática de banco.

| Token | Hex | Uso |
|---|---|---|
| `--azul` | `#0131CD` | Identidade, botão principal, navegação ativa, card do teto |
| `--branco` | `#FFFFFF` | Superfícies, cards, texto sobre azul |
| `--limao` | `#B9FC01` | Destaques, progresso, conquistas, ações sobre azul |
| `--fundo` | `#F5F7FA` | Fundo secundário |
| `--grafite` | `#14171C` | Texto principal, texto sobre limão |
| `--cinza` | `#626B7A` | Texto secundário |
| `--borda` | `#DDE2EA` | Separadores |
| `--positivo` | `#166534` | Termômetro verde (dentro do teto) |
| `--atencao` | `#92400E` | Termômetro amarelo (perto do limite) |
| `--alerta` | `#B91C1C` | Termômetro vermelho (estouro ou déficit) |

**Marca:** Pila, assinatura `pila.` e slogan "Cada pila conta.". Logos vetoriais em `brand/`.
**Tipografia:** Space Grotesk (títulos e valores, com algarismos tabulares) e Inter (textos),
empacotadas com o app para funcionar offline.

**Regras de contraste:**
- **Combinações que passam no AA:** branco sobre azul (≈ 9:1), limão sobre azul (≈ 7:1), grafite sobre limão.
- **Limão sobre branco (≈ 1,2:1) é proibido** para texto e para formas que carregam informação.
  Nas barras de progresso, use um trilho em `--borda` e um contorno em `--grafite` ou `--azul`.
- **Os estados nunca são indicados só pela cor:** sempre acompanham ícone e texto
  (ex.: "✓ No azul", "⚠ Perto do limite", "✕ Passou R$ 0,50").

---

## 8. Roadmap

| Fase | Entregável | Critério de pronto |
|---|---|---|
| **0. Escopo v2** | Este documento + `casos-de-teste.md` | ✅ |
| **1. Motor** | `src/engine/` puro + testes de todos os casos | Todos os casos passam, cobertura ≥ 90% |
| **2. Núcleo diário** | Ciclo, dashboard, checklist, gasto rápido, fechamento, backup, PWA | Uso real diário por 1 semana |
| **3. Rendas e metas** | Carimbo, metas e cofrinho, Modo Rolê, fim de ciclo | 1 ciclo completo usado de verdade |
| **4. Extras** | Streak, fechamento semanal, extrato com filtros, modo aperto | — |
| **5. Escalar** | Backend, login, sincronização, LGPD | Quando fizer sentido |
