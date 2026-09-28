# Vários produtos por orçamento — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir criar, editar e identificar vários produtos em um orçamento, mantendo a planilha sincronizada.

**Architecture:** O domínio continuará representando itens com `QuoteItem`. O repositório passará a carregar e a reconciliar itens por ID do orçamento na aba `Itens do Orçamento`; a tela trocará o item único por uma lista editável e um resumo calculado.

**Tech Stack:** React, TypeScript, Vitest e Google Sheets API.

**Spec:** `docs/superpowers/specs/2026-09-28-multiple-quote-items-design.md`

## Global Constraints

- Campos monetários usam texto formatado em `R$`, sem `input type=number`.
- Não apagar linhas inteiras nem alterar itens de outros orçamentos.
- Não criar commit ou push sem pedido explícito da usuária.

## Review Focus

- Valor `R$ 1.234,56` deve converter para `1234.56` antes de calcular e salvar.
- Um orçamento sem item preenchido deve continuar inválido.
- Editar um orçamento com menos itens deve impedir que os itens removidos voltem ao reabrir.
- Itens de outro ID não podem ser alterados durante a edição.
- Falha da API deve preservar o rascunho mostrado na tela.

---

### Task 1: Reconciliar itens no repositório

**Files:**
- Modify: `src/data/sheetsRepository.ts`
- Create: `src/data/sheetsRepository.test.ts`

**Interfaces:**
- Produces: `getQuotes(): Promise<Quote[]>` com `items` carregados e `saveQuote(quote): Promise<Quote>` que sincroniza os itens pelo ID.

- [ ] Escrever testes falhos para carregar itens de dois IDs e salvar uma edição removendo um item sem tocar no outro ID.
- [ ] Executar `npm test -- --run src/data/sheetsRepository.test.ts` e confirmar a falha esperada.
- [ ] Buscar `Itens do Orçamento!A2:E`, associar cada linha ao orçamento e atualizar/criar/limpar somente células dos itens do ID salvo.
- [ ] Executar o teste do repositório e confirmar aprovação.

### Task 2: Formatar valores em real

**Files:**
- Create: `src/domain/money.ts`
- Create: `src/domain/money.test.ts`

**Interfaces:**
- Produces: `formatMoneyInput(value: number): string` e `parseMoneyInput(value: string): number`.

- [ ] Escrever teste falho para `25`, `R$ 25,50` e `R$ 1.234,56`.
- [ ] Executar `npm test -- --run src/domain/money.test.ts` e confirmar a falha esperada.
- [ ] Implementar as funções de conversão e formatação em português do Brasil.
- [ ] Executar o teste do domínio e confirmar aprovação.

### Task 3: Exibir e editar produtos no orçamento

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Create: `src/App.test.tsx`

**Interfaces:**
- Consumes: `formatMoneyInput`, `parseMoneyInput`, `calculateQuoteTotals` e `QuoteItem`.
- Produces: formulário com lista de itens, adição, remoção e resumo dos valores.

- [ ] Escrever teste falho para adicionar uma linha, remover uma linha extra e atualizar o subtotal/total a partir de valores em real.
- [ ] Executar `npm test -- --run src/App.test.tsx` e confirmar a falha esperada.
- [ ] Substituir os campos únicos por cartões de produto, botão de adicionar, remoção protegida do último item e campos monetários textuais formatados.
- [ ] Executar o teste da tela e confirmar aprovação.

### Task 4: Verificação integrada

**Files:**
- Modify: arquivos acima apenas se a verificação encontrar falhas.

- [ ] Executar `npm test -- --run`.
- [ ] Executar `npm run build`.
- [ ] Executar `git diff --check` e revisar que a implementação cobre criação, edição, remoção, recarregamento e valores monetários.
