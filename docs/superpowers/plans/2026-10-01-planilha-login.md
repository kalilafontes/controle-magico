# Login pela planilha e API do Apps Script Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir acesso por e-mail e senha da aba `Usuários`, com sessão persistente, e usar um Web App do Apps Script para todas as operações da planilha.

**Architecture:** O frontend guarda uma sessão opaca retornada pelo Web App e passa a chamar uma API JSON única. O Apps Script, vinculado à planilha e executado pela proprietária, valida usuários ativos e encapsula a leitura, gravação, fórmulas e remoção das três abas de negócio.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Google Apps Script e Google Sheets `SpreadsheetApp`.

**Spec:** `docs/superpowers/specs/2026-10-01-planilha-login-design.md`

## Global Constraints

- Usar a aba `Usuários` e as colunas `Email`, `Senha`, `Nome` e `Ativo` já criadas.
- Considerar ativo somente o valor `Sim`, sem distinguir maiúsculas/minúsculas.
- Manter a senha em texto por compatibilidade com a tabela atual.
- Sessão não expira por tempo; encerrar apenas por logout, limpeza local ou desativação do usuário.
- Não fazer chamadas diretas da API Google Sheets nem carregar OAuth no navegador.
- Não criar commits sem solicitação explícita da usuária.

## Review Focus

- Usuário com `Ativo` igual a `Não` após já estar logado deve perder acesso na próxima requisição; testar na API e no frontend.
- E-mail com letras maiúsculas/espaços deve identificar o mesmo cadastro; testar normalização no login do script.
- Senha incorreta e e-mail inexistente devem devolver a mesma mensagem; testar a resposta do login.
- Falha de rede não deve apagar sessão persistida; testar o cliente HTTP.
- Resposta inválida do Web App não deve ser interpretada como login válido; testar validação do payload no módulo de autenticação.

---

## File Structure

- `apps-script/Code.gs`: Web App que autentica sessões e opera as abas `Usuários`, `Orçamentos`, `Itens do Orçamento` e `Planejamento`.
- `apps-script/README.md`: instruções de cópia, autorização, implantação e obtenção da URL `/exec`.
- `src/data/appsScriptClient.ts`: cliente JSON autenticado, tratamento único de resposta e erros de sessão.
- `src/auth/sheetAuth.ts`: persistência local de sessão, login e logout do Web App.
- `src/data/sheetsRepository.ts`: adapta a interface de orçamentos para o Web App, preservando consumidores React.
- `src/data/planningRepository.ts`: adapta a interface de planejamento para o Web App, preservando consumidores React.
- `src/config.ts`, `src/localConfig.ts`: substituem as chaves OAuth por `VITE_APPS_SCRIPT_URL`.
- `src/App.tsx`: tela de e-mail/senha, carregamento de sessão e retorno ao login quando a API a rejeitar.
- Testes próximos aos módulos acima: cobrem contrato, persistência, erro e interface do login.

### Task 1: Cliente e sessão persistente do Web App

**Files:**
- Create: `src/data/appsScriptClient.ts`
- Create: `src/data/appsScriptClient.test.ts`
- Create: `src/auth/sheetAuth.ts`
- Create: `src/auth/sheetAuth.test.ts`
- Modify: `src/config.ts`
- Modify: `src/config.test.ts`
- Modify: `src/localConfig.ts`

**Interfaces:**
- Produces `createAppsScriptClient(url, getSession)` with `request<T>(action, payload): Promise<T>`.
- Produces `loginWithSheet(url, email, password): Promise<{ token: string; name: string }>` and session getters/clearer from `sheetAuth.ts`.
- Produces `getAppConfig()` with `appsScriptUrl: string`.

- [ ] **Step 1: Write failing tests for configuration and session persistence**

Cover missing `VITE_APPS_SCRIPT_URL`, successful login payload persistence, malformed login response, and a rejected network request preserving local session.

- [ ] **Step 2: Run the targeted tests to verify they fail**

Run: `npm test -- src/auth/sheetAuth.test.ts src/data/appsScriptClient.test.ts src/config.test.ts`

Expected: FAIL because the sheet-auth modules and Apps Script URL configuration do not exist.

- [ ] **Step 3: Implement the configuration, client and session modules**

Use text/plain JSON POST requests so the Apps Script Web App can accept cross-origin calls without custom headers. Put `token` in the JSON body, and represent unauthenticated responses with a dedicated `SessionExpiredError` so screens can distinguish them from network failures.

- [ ] **Step 4: Run targeted tests to verify they pass**

Run: `npm test -- src/auth/sheetAuth.test.ts src/data/appsScriptClient.test.ts src/config.test.ts`

Expected: PASS.

### Task 2: Web App do Apps Script e operações da planilha

**Files:**
- Create: `apps-script/Code.gs`
- Create: `apps-script/README.md`

**Interfaces:**
- Consumes the request envelope `{ action: string, token?: string, payload?: object }` from Task 1.
- Produces JSON envelopes `{ ok: true, data }` or `{ ok: false, code, message }`.
- Supports `login`, `logout`, `quotes.list`, `quotes.save`, `quotes.delete`, `plans.list`, `plans.save`, `plans.delete` and `plans.synchronize`.

- [ ] **Step 1: Write the script contract as executable manual checks in `apps-script/README.md`**

Document requests for valid login, wrong password, inactive account, quote list, plan list and logout. Include exact expected `ok`, `code` and response fields.

- [ ] **Step 2: Implement session and user lookup in `apps-script/Code.gs`**

Implement `doPost(e)`, JSON parse/response helpers, e-mail normalization, `isActiveUser`, random token creation with `Utilities.getUuid()`, session storage in `PropertiesService.getScriptProperties()`, and `requireSession(token)`. Every non-login action must call `requireSession` and re-check `Ativo` in `Usuários`.

- [ ] **Step 3: Implement quote actions in `apps-script/Code.gs`**

Use `SpreadsheetApp.getActiveSpreadsheet()` and reproduce current quote/item read, update, append and row-deletion behavior. Return the same `Quote` shape used by `src/domain/quote.ts`.

- [ ] **Step 4: Implement planning actions in `apps-script/Code.gs`**

Reproduce the existing planning row mapping, formula copying, insert/delete rows and batch schedule updates. Return the `PrintPlan` shape currently used by `PlanningScreen`.

- [ ] **Step 5: Publish and manually validate in the bound Apps Script editor**

Follow `apps-script/README.md`: paste `Code.gs`, deploy as Web App executing as the sheet owner with access for anyone, authorize, then test the manual contract using the `/exec` URL. Record that URL only in `.env` as `VITE_APPS_SCRIPT_URL`, never in source.

### Task 3: Repositórios de orçamento e planejamento via Web App

**Files:**
- Modify: `src/data/sheetsRepository.ts`
- Modify: `src/data/sheetsRepository.test.ts`
- Modify: `src/data/planningRepository.ts`
- Modify: `src/data/planningRepository.test.ts`

**Interfaces:**
- Consumes `createAppsScriptClient` from Task 1 and the action contract from Task 2.
- Preserves `createSheetsRepository(...).getQuotes/saveQuote/deleteQuote` and `createPlanningRepository(...).getPlans/savePlan/deletePlan/synchronizeSchedule` for existing callers.

- [ ] **Step 1: Write failing repository tests against the Apps Script action names**

Assert quotes call `quotes.list`, `quotes.save` and `quotes.delete`; assert planning calls `plans.list`, `plans.save`, `plans.delete` and `plans.synchronize`; assert a session rejection propagates as `SessionExpiredError`.

- [ ] **Step 2: Run repository tests to verify they fail**

Run: `npm test -- src/data/sheetsRepository.test.ts src/data/planningRepository.test.ts`

Expected: FAIL because repositories still construct Google Sheets API URLs and Authorization headers.

- [ ] **Step 3: Adapt repository implementations to the client**

Keep domain validation and scheduling helpers in TypeScript. Move only physical spreadsheet reads/writes into the named actions so component-facing return types and validation messages remain stable.

- [ ] **Step 4: Run repository tests to verify they pass**

Run: `npm test -- src/data/sheetsRepository.test.ts src/data/planningRepository.test.ts`

Expected: PASS.

### Task 4: Tela de login, sessão e remoção do OAuth Google

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Delete: `src/auth/googleAuth.ts`
- Delete: `src/auth/googleAuth.test.ts`
- Modify: `src/components/PlanningScreen.tsx`
- Modify: `src/components/PlanningScreen.test.tsx`

**Interfaces:**
- Consumes `loginWithSheet`, persisted session functions and `SessionExpiredError`.
- Produces a form accessible por `E-mail`, `Senha` e botão `Entrar`.

- [ ] **Step 1: Write failing UI tests for the new login**

Assert that the Google button is absent, e-mail/senha fields are present, valid submission calls the sheet login, an invalid login shows its generic message, and a `SessionExpiredError` returns the app to login.

- [ ] **Step 2: Run App tests to verify they fail**

Run: `npm test -- src/App.test.tsx src/components/PlanningScreen.test.tsx`

Expected: FAIL because the screen still renders `Entrar com Google` and calls OAuth.

- [ ] **Step 3: Implement the session-driven application flow**

Replace the OAuth import/effects and one-hour refresh logic with persisted sheet session loading. Build a controlled login form, preserve the name returned by the session for the home greeting, and expose logout. Convert existing session-expiration callbacks to clear the local sheet session only when the server reports unauthenticated or inactive.

- [ ] **Step 4: Run UI tests to verify they pass**

Run: `npm test -- src/App.test.tsx src/components/PlanningScreen.test.tsx`

Expected: PASS.

### Task 5: Regressions and deployment handoff

**Files:**
- Modify: `.env.example` if it exists, otherwise `README.md`
- Modify: `apps-script/README.md`

**Interfaces:**
- Documents `VITE_APPS_SCRIPT_URL` and the `/exec` deployment URL from Task 2.

- [ ] **Step 1: Add deployment configuration instructions**

Show the exact environment variable name, clarify `/exec` versus `/dev`, and list how to deactivate a user using the `Ativo` column.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test -- --run`

Expected: PASS with all existing quote, planning, date, auth and UI tests.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: PASS with TypeScript and Vite production output.

- [ ] **Step 4: Perform final manual acceptance**

Verify on the deployed site: valid user logs in; wrong password is rejected; closing and reopening preserves access; marking the user `Não` blocks the next action; quote and planning read/write operations work; logout returns to the login form.

## Plan Self-Review

- Spec coverage: Tasks 1–4 cover authentication, persistent sessions, active-user checks, all planned data operations and removal of OAuth; Task 5 covers publishing and acceptance.
- Step scan: each task starts from a failing test or an executable manual contract, then names the exact interface and verification command.
- Type consistency: `SessionExpiredError`, `createAppsScriptClient`, session payload `{ token, name }`, and action names are defined in Task 1 and consumed consistently afterward.
- Review focus: each listed condition is explicitly assigned to Task 1, Task 2, Task 3 or Task 4 tests/manual checks.
- Proportion: the plan states implementation decisions and contracts without duplicating the Apps Script implementation.
