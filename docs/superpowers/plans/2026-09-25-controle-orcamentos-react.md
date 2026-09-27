# Controle de Orçamentos React Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar um sistema React responsivo para três contas Gmail consultarem e manterem orçamentos diretamente em uma única planilha Google compartilhada.

**Architecture:** Um aplicativo Vite + React autentica a conta com Google Identity Services e obtém um token OAuth temporário para chamar a Google Sheets API pelo navegador. Uma camada de domínio trata dados de orçamento e cálculos; uma camada de repositório traduz as abas `Orçamentos` e `Itens do Orçamento` em modelos usados pela interface.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, Google Identity Services, Google Sheets API v4, CSS nativo.

**Spec:** `docs/superpowers/specs/2026-09-25-controle-orcamentos-design.md`

## Global Constraints

- Não inicializar Git, não criar commits e não delegar tarefas a agentes.
- Usar React e manter o servidor Vite local ativo para acompanhamento.
- Não criar backend, banco de dados adicional, Firebase ou armazenar segredos no navegador.
- A fonte de dados é uma planilha compartilhada com três contas Gmail autorizadas.
- O visual é mobile-first e usa a identidade rosa aprovada.
- Nesta versão não incluir PDF, envio por WhatsApp/e-mail, perfis internos, relatórios avançados, hospedagem pública ou persistência offline.

## Review Focus

- Conta Google sem permissão na planilha deve receber uma mensagem compreensível, sem dados incompletos na tela — coberto na Task 3.
- Token expirado ou login cancelado deve permitir uma nova tentativa sem quebrar a sessão da interface — coberto na Task 3.
- Desconto maior que o subtotal não pode produzir total negativo — coberto na Task 2.
- Salvar uma edição deve substituir os itens antigos daquele orçamento em vez de duplicá-los — coberto na Task 4.
- Uma planilha sem as abas ou os cabeçalhos exigidos deve falhar antes de qualquer escrita — coberto na Task 4.

---

## File Structure

- `package.json`: scripts e dependências do projeto Vite.
- `.env.example`: nomes das variáveis públicas necessárias para OAuth e planilha.
- `src/config.ts`: lê e valida `VITE_GOOGLE_CLIENT_ID` e `VITE_GOOGLE_SPREADSHEET_ID`.
- `src/domain/quote.ts`: tipos de orçamento/item e cálculos puros.
- `src/domain/quote.test.ts`: testes unitários do domínio.
- `src/auth/googleAuth.ts`: carrega Google Identity Services e solicita/revoga token de planilhas.
- `src/auth/googleAuth.test.ts`: testes de estados de autorização e erro.
- `src/data/sheetsRepository.ts`: valida abas, lê e persiste orçamentos via Sheets API.
- `src/data/sheetsRepository.test.ts`: testes de mapeamento e chamadas de escrita.
- `src/components/QuoteForm.tsx`: formulário de criação/edição e itens variáveis.
- `src/components/QuoteList.tsx`: busca e lista de orçamentos.
- `src/components/Dashboard.tsx`: resumo de pendências e últimos orçamentos.
- `src/App.tsx`: roteamento local entre login, painel, lista e formulário; estados de carregamento/erro.
- `src/styles.css`: tema rosa responsivo e componentes visuais.
- `src/App.test.tsx`: testes de fluxos essenciais da interface.

### Task 1: Criar a base React e a configuração pública

**Files:**
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `.env.example`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/config.ts`
- Create: `src/test/setup.ts`
- Create: `src/config.test.ts`

**Interfaces:**
- Produces: `getAppConfig(): AppConfig`, onde `AppConfig` contém `googleClientId: string` e `spreadsheetId: string`.
- Produces: scripts `dev`, `test` e `build` no `package.json`.

- [ ] **Step 1: Escrever o teste de configuração ausente em `src/config.test.ts`**

```ts
expect(() => getAppConfig({})).toThrow('VITE_GOOGLE_CLIENT_ID')
```

- [ ] **Step 2: Executar o teste para confirmar a falha inicial**

Run: `npm test -- src/config.test.ts`
Expected: FAIL porque a função e a base do projeto ainda não existem.

- [ ] **Step 3: Criar o Vite React TypeScript e implementar `getAppConfig(env?: Record<string, string | undefined>): AppConfig`**

Definir `VITE_GOOGLE_CLIENT_ID` e `VITE_GOOGLE_SPREADSHEET_ID` em `.env.example`; falhar com mensagem que nomeie a variável ausente. Configurar Vitest com ambiente jsdom e Testing Library.

- [ ] **Step 4: Executar os testes da configuração**

Run: `npm test -- src/config.test.ts`
Expected: PASS.

- [ ] **Step 5: Construir o projeto base**

Run: `npm run build`
Expected: PASS e geração de `dist/`.

### Task 2: Modelar e calcular orçamentos

**Files:**
- Create: `src/domain/quote.ts`
- Create: `src/domain/quote.test.ts`

**Interfaces:**
- Consumes: nenhuma interface anterior.
- Produces: `Quote`, `QuoteItem`, `QuoteStatus`, `createDraftQuote()`, `calculateQuoteTotals(items, discount)` e `validateQuote(quote)`.

- [ ] **Step 1: Escrever os testes de totais e validação em `src/domain/quote.test.ts`**

```ts
expect(calculateQuoteTotals([{ description: 'Peça', quantity: 2, unitPrice: 50 }], 10)).toEqual({ subtotal: 100, total: 90 })
expect(calculateQuoteTotals([{ description: 'Peça', quantity: 1, unitPrice: 50 }], 80).total).toBe(0)
expect(validateQuote(createDraftQuote())).toContain('Cliente')
```

- [ ] **Step 2: Executar os testes para confirmar a falha inicial**

Run: `npm test -- src/domain/quote.test.ts`
Expected: FAIL porque os tipos e funções ainda não existem.

- [ ] **Step 3: Implementar tipos e funções em `src/domain/quote.ts`**

Usar os status `Rascunho`, `Enviado`, `Aguardando`, `Aprovado` e `Recusado`. Limitar desconto ao intervalo de zero até subtotal; exigir cliente, validade e pelo menos um item com descrição, quantidade maior que zero e valor unitário não negativo.

- [ ] **Step 4: Executar os testes do domínio**

Run: `npm test -- src/domain/quote.test.ts`
Expected: PASS.

### Task 3: Autenticar com Google e tratar estados de acesso

**Files:**
- Create: `src/auth/googleAuth.ts`
- Create: `src/auth/googleAuth.test.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `AppConfig` de `getAppConfig()`.
- Produces: `GoogleAuthClient` com `signIn(): Promise<string>`, `signOut(): void` e `isLoaded(): boolean`.
- Produces: tela de login e estado `accessToken: string | null` em `App`.

- [ ] **Step 1: Escrever testes para autorização concluída, cancelada e expirada em `src/auth/googleAuth.test.ts`**

```ts
await expect(auth.signIn()).resolves.toBe('token-de-teste')
await expect(cancelledAuth.signIn()).rejects.toThrow('Login cancelado')
expect(expiredErrorMessage).toContain('Entre novamente')
```

- [ ] **Step 2: Executar os testes para confirmar a falha inicial**

Run: `npm test -- src/auth/googleAuth.test.ts`
Expected: FAIL porque o adaptador de autenticação ainda não existe.

- [ ] **Step 3: Implementar `createGoogleAuthClient(clientId: string): GoogleAuthClient` em `src/auth/googleAuth.ts`**

Carregar `https://accounts.google.com/gsi/client`, solicitar o escopo `https://www.googleapis.com/auth/spreadsheets`, retornar somente o token temporário à interface e nunca persistir o token em localStorage.

- [ ] **Step 4: Implementar a tela de login e os estados de erro em `src/App.tsx`**

Quando a API retornar 401, limpar o token e mostrar “Sua sessão expirou. Entre novamente.” Quando retornar 403, mostrar que a conta precisa receber acesso à planilha.

- [ ] **Step 5: Executar testes de autenticação e interface**

Run: `npm test -- src/auth/googleAuth.test.ts src/App.test.tsx`
Expected: PASS.

### Task 4: Criar o repositório Google Sheets

**Files:**
- Create: `src/data/sheetsRepository.ts`
- Create: `src/data/sheetsRepository.test.ts`

**Interfaces:**
- Consumes: `Quote`, `QuoteItem` e token OAuth.
- Produces: `createSheetsRepository(input): SheetsRepository`, com `getQuotes(): Promise<Quote[]>`, `saveQuote(quote: Quote): Promise<Quote>` e `validateSchema(): Promise<void>`.

- [ ] **Step 1: Escrever testes de leitura, esquema ausente e edição em `src/data/sheetsRepository.test.ts`**

```ts
await expect(repository.validateSchema()).rejects.toThrow('Itens do Orçamento')
await repository.saveQuote(existingQuote)
expect(replaceItemsForQuote).toHaveBeenCalledWith(existingQuote.id, existingQuote.items)
```

- [ ] **Step 2: Executar os testes para confirmar a falha inicial**

Run: `npm test -- src/data/sheetsRepository.test.ts`
Expected: FAIL porque o repositório ainda não existe.

- [ ] **Step 3: Implementar `createSheetsRepository` em `src/data/sheetsRepository.ts`**

Usar `fetch` para a Sheets API v4. Validar as abas `Orçamentos` e `Itens do Orçamento` e seus cabeçalhos antes da primeira escrita. Mapear linhas em `Quote`; em edição, atualizar a linha principal e limpar/regravar exclusivamente os itens do ID editado.

- [ ] **Step 4: Executar os testes do repositório**

Run: `npm test -- src/data/sheetsRepository.test.ts`
Expected: PASS.

### Task 5: Construir painel, lista e formulário responsivos

**Files:**
- Create: `src/components/Dashboard.tsx`
- Create: `src/components/QuoteList.tsx`
- Create: `src/components/QuoteForm.tsx`
- Create: `src/App.test.tsx`
- Modify: `src/App.tsx`
- Create: `src/styles.css`

**Interfaces:**
- Consumes: `Quote`, `validateQuote`, `calculateQuoteTotals` e `SheetsRepository`.
- Produces: telas de consulta, cadastro e edição; `onSave(quote: Quote): Promise<void>` em `QuoteForm`.

- [ ] **Step 1: Escrever testes para busca, inclusão de item e salvamento em `src/App.test.tsx`**

```tsx
await user.type(screen.getByPlaceholderText('Buscar por cliente ou número'), 'Marina')
expect(screen.getByText('Marina Oliveira')).toBeVisible()
await user.click(screen.getByRole('button', { name: 'Adicionar item' }))
await user.click(screen.getByRole('button', { name: 'Salvar orçamento' }))
expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ client: 'Marina Oliveira' }))
```

- [ ] **Step 2: Executar os testes para confirmar a falha inicial**

Run: `npm test -- src/App.test.tsx`
Expected: FAIL porque os componentes ainda não existem.

- [ ] **Step 3: Implementar `Dashboard`, `QuoteList` e `QuoteForm`**

Exibir resumo de orçamentos em aberto e recentes; pesquisar por cliente ou ID; permitir itens variáveis e cálculo instantâneo; preservar conteúdo do formulário se o salvamento falhar.

- [ ] **Step 4: Implementar a composição dos fluxos em `App.tsx` e o tema rosa em `src/styles.css`**

Usar navegação local por estado, controles com área de toque adequada e layout de uma coluna no celular. Exibir confirmação após salvar e mensagens de erro conforme a Task 3 e Task 4.

- [ ] **Step 5: Executar os testes de interface**

Run: `npm test -- src/App.test.tsx`
Expected: PASS.

### Task 6: Verificar a aplicação e iniciar acompanhamento local

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: todos os scripts e variáveis anteriores.
- Produces: instruções locais para preencher `.env`, configurar Google Cloud e iniciar o servidor.

- [ ] **Step 1: Documentar a configuração local em `README.md`**

Incluir criação das abas e cabeçalhos da planilha, compartilhamento com as três contas, configuração OAuth de teste, variáveis do `.env` e comando de desenvolvimento.

- [ ] **Step 2: Executar toda a suíte de testes**

Run: `npm test -- --run`
Expected: PASS.

- [ ] **Step 3: Executar a verificação de produção**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Iniciar o servidor local**

Run: `npm run dev -- --host 127.0.0.1`
Expected: Vite disponível em um endereço `http://127.0.0.1:<porta>/` para acompanhamento.

## Self-Review

- Cobertura da especificação: Tasks 1–5 cobrem React, autenticação, planilha, estrutura de dados, telas mobile, erros e cálculos; Task 6 cobre a operação local e verificação.
- Consistência: `Quote` e `QuoteItem` são definidos na Task 2 e consumidos pelo repositório e interface nas Tasks 4–5.
- Entradas sensíveis: as cinco condições listadas em Review Focus possuem teste designado nas Tasks 2–4.
- Escopo: o plano exclui deliberadamente PDF, mensagens, hospedagem, banco adicional e perfis internos.
- Preferências da usuária: todas as etapas proíbem Git, commits e uso de múltiplos agentes.
