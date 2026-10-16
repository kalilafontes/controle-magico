# Comissão Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar e acompanhar comissões por item de orçamento na aba `Comissões`.

**Architecture:** Um módulo de domínio calcula valores a partir de quantidade, preço unitário de venda e custo-base unitário. Um repositório chama novas ações do Apps Script, que mantém os lançamentos na aba `Comissões`; uma tela própria cria lançamentos e atualiza seu status.

**Tech Stack:** React, TypeScript, Vitest, Google Apps Script e Google Sheets.

**Spec:** `docs/superpowers/specs/2026-10-15-comissoes-design.md`

## Global Constraints

- Não alterar as abas existentes de orçamentos ou planejamento.
- Usar os valores unitários de venda do orçamento como fotografia do lançamento.
- Status permitido: `Não pago` ou `Pago`.
- Não criar commits; pedido expresso da usuária.

## Review Focus

- Item com quantidade maior que um deve multiplicar venda, custo, lucro e comissão.
- Custo-base maior que venda deve mostrar comissão negativa de forma transparente.
- Aba `Comissões` vazia deve receber os cabeçalhos automaticamente.
- Aba preenchida com cabeçalhos inválidos deve retornar erro explícito.
- Sessão expirada em qualquer operação de comissão deve retornar à tela de login.

---

### Task 1: Domínio de comissão

**Files:**
- Create: `src/domain/commission.ts`
- Create: `src/domain/commission.test.ts`

**Interfaces:**
- Produces `calculateCommissionValues(quantity, saleUnitPrice, baseUnitPrice)` e os tipos `CommissionEntry` e `CommissionStatus`.

- [ ] Escrever testes de cálculo para uma peça e para quantidade maior que um.
- [ ] Executar os testes e confirmar falha antes da implementação.
- [ ] Implementar tipos e cálculo de venda total, custo total, lucro e 25% de comissão.
- [ ] Executar os testes do domínio e a compilação.

### Task 2: Persistência na planilha

**Files:**
- Create: `src/data/commissionRepository.ts`
- Create: `src/data/commissionRepository.test.ts`
- Modify: `apps-script/Code.gs`

**Interfaces:**
- Consumes `CommissionEntry` e `CommissionStatus`.
- Produces `createCommissionRepository(url, token)` com `getEntries`, `saveEntry` e `updateStatus`.

- [ ] Escrever testes do contrato de chamadas do repositório.
- [ ] Executar os testes e confirmar falha antes da implementação.
- [ ] Adicionar ações autenticadas de listar, salvar e atualizar status no Apps Script; inicializar ou validar cabeçalhos da aba `Comissões`.
- [ ] Implementar o repositório e executar seus testes e a compilação.

### Task 3: Tela Comissão

**Files:**
- Create: `src/components/CommissionScreen.tsx`
- Create: `src/components/CommissionScreen.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/navigation.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes `Quote`, `CommissionEntry` e `createCommissionRepository`.
- Produces uma tela para selecionar orçamento e item, informar custo-base unitário, salvar lançamento e alternar status.

- [ ] Escrever testes da tela: acesso pela navegação, preço de venda preenchido pelo item e totais pagos/a pagar.
- [ ] Executar os testes e confirmar falha antes da implementação.
- [ ] Implementar tela, integração de navegação e estilos responsivos.
- [ ] Executar testes da tela, todos os testes do projeto e `npm run build`.
