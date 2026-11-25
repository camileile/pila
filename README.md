<p align="center">
  <img src="brand/logo/pila-horizontal-cor.svg" alt="pila." width="320">
</p>

<p align="center"><strong>Cada pila conta.</strong></p>

**Pila** é um app de gestão financeira diária para quem vive de renda fragmentada:
bolsas, auxílios e transferências que caem em datas diferentes. Em vez de mostrar
quanto você já gastou, ele responde uma pergunta só:

> **Quanto posso gastar hoje** sem comprometer minhas contas e metas até a próxima renda cair?

## Como funciona

- **Teto diário dinâmico:** o saldo livre, menos as contas fixas, o transporte dos dias de aula
  e as reservas, dividido pelos dias que faltam no ciclo.
- **Fechar o dia em um toque:** você digita o saldo do banco e o app descobre quanto gastou
  pela diferença. Sobra e estouro se redistribuem sozinhos nos próximos dias.
- **Caiu, Guardou:** cada renda separa automaticamente uma parte para uma meta.
- **Modo Rolê:** reserve dinheiro para um dia específico sem estourar o ciclo.
- **Ficar de Boa:** dias de margem para quando a bolsa atrasa.
- **Local-first:** PWA offline, com os dados guardados só no seu celular.

## Status

| Fase | Situação |
|---|---|
| 0. Escopo v2 e casos de teste | ✅ |
| 1. Motor de cálculo (`src/engine`) | ✅ 58 testes, 100% de cobertura |
| 2. App diário (PWA) | ✅ ciclo, dashboard, checklist, gasto rápido, fechamento, extrato, backup |
| 3. Rendas e metas | ✅ Caiu, Guardou, metas e cofrinho, Modo Rolê, sobra do ciclo |
| 4. Streak, fechamento semanal, extrato | ✅ Streak com folga, fechamento semanal, filtros, modo aperto |
| 5. Nuvem (login, sincronização) | quando fizer sentido |

## Desenvolvimento

Requer Node 20+.

```bash
npm install
npm run dev       # app em http://localhost:5173 (use ?hoje=2026-03-02 para simular um dia)
npm run build     # build de produção com PWA em dist/
npm test          # testes do motor e do banco
npm run coverage  # cobertura
npm run logo      # regera os SVGs da marca
```

## Estrutura

```
docs/        escopo v2 e casos de teste (golden cases)
src/engine/  motor de cálculo em TypeScript puro, sem dependências
src/db/      banco local (Dexie/IndexedDB), ações e backup
src/telas/   telas do app (Hoje, Extrato, Mais, Novo ciclo, folhas)
brand/       logo vetorial, ícones e geradores
```

Stack: Vite, React, TypeScript, Dexie (IndexedDB) e vite-plugin-pwa.
