# Login pela planilha e API do Apps Script

## Objetivo

Substituir a autenticação Google visível no site por login com e-mail e senha
cadastrados na aba `Usuários` da planilha. O sistema deve continuar usando a
mesma planilha para orçamentos e planejamentos, mas sem expor credenciais Google
ou dar acesso público às abas.

## Escopo aprovado

- A aba de usuários chama-se exatamente `Usuários` e possui as colunas `Email`,
  `Senha`, `Nome` e `Ativo`.
- No primeiro lançamento, as senhas existentes são comparadas como texto, para
  compatibilidade com a tabela já cadastrada.
- Apenas linhas com `Ativo` igual a `Sim`, sem distinguir maiúsculas/minúsculas,
  podem acessar o sistema.
- A sessão é persistente, sem prazo de expiração. Ela só termina quando a pessoa
  sair, limpar os dados do navegador ou for desativada na aba `Usuários`.
- A validação de usuário ativo ocorre em cada chamada ao servidor. Desativar uma
  pessoa na planilha corta o acesso de uma sessão já aberta.

## Arquitetura

Um Web App do Google Apps Script, vinculado à planilha atual, torna-se a única
ponte entre o frontend e as abas. Ele é publicado para executar como a dona da
planilha e recebe requisições anônimas do site. Cada operação, além de `login`,
deve carregar uma sessão válida.

O script guarda sessões aleatórias no `ScriptProperties`, indexadas pelo token,
com e-mail e nome do usuário. Antes de cada operação, ele recupera a sessão,
relembra o cadastro na aba `Usuários` e confirma que ainda está ativo. Nenhum
token Google, ID de cliente ou acesso direto à API Google Sheets fica no
navegador.

O site envia um corpo JSON simples para o Web App com uma ação, os dados da ação
e a sessão. O servidor devolve JSON com os dados ou um erro. A sessão é mantida
no `localStorage` para sobreviver ao fechamento do navegador.

## Contrato de operações

O Web App fornecerá operações internas para:

- `login`: valida `email` e `senha`, cria uma sessão e devolve `{ token, nome }`.
- `logout`: invalida a sessão no servidor e no navegador.
- `quotes.list`, `quotes.save`, `quotes.delete`: substituem as operações da aba
  `Orçamentos` e de `Itens do Orçamento`.
- `plans.list`, `plans.save`, `plans.delete`, `plans.synchronize`: substituem as
  operações da aba `Planejamento`, inclusive fórmulas, duplicação e reordenação.

Cada resposta de sessão inválida ou usuário inativo encerra a sessão local e
exibe a tela de login. Credenciais inválidas retornam uma mensagem genérica para
não informar se o e-mail existe.

## Mudanças no frontend

- Remover o cliente OAuth Google e o token de uma hora.
- Adicionar módulo de autenticação por sessão da planilha.
- Adicionar `VITE_APPS_SCRIPT_URL` à configuração local e de produção.
- Alterar a tela para campos de e-mail e senha e botão `Entrar`.
- Adaptar os dois repositórios para chamar o Web App, preservando as interfaces
  já usadas pelas telas.
- Manter nome do usuário retornado pelo login para a saudação inicial.

## Publicação do Apps Script

Depois que o arquivo do script estiver no projeto, a publicação será feita pela
proprietária da planilha:

1. Abra a planilha e escolha **Extensões → Apps Script**.
2. Crie ou substitua o arquivo `Code.gs` pelo conteúdo fornecido pelo projeto.
3. Clique em **Implantar → Nova implantação** e escolha **Aplicativo da Web**.
4. Configure **Executar como: Eu** e **Quem tem acesso: Qualquer pessoa**.
   A proteção ocorre pelo token de sessão criado pelo script, não pela abertura
   da planilha.
5. Autorize o script usando a conta dona da planilha.
6. Copie a URL que termina em `/exec` e cadastre-a como
   `VITE_APPS_SCRIPT_URL` no ambiente onde o site é publicado.

Não se deve usar a URL de teste `/dev` no site publicado, pois ela só funciona
para quem edita o script.

## Tratamento de falhas

- Falha de rede: mostrar mensagem de tentativa novamente sem apagar a sessão.
- Sessão inválida, removida ou usuário inativo: limpar o acesso local e voltar ao
  login.
- Dados inválidos na planilha ou ao salvar: devolver a mensagem apropriada sem
  alterar a tela local até a operação confirmar sucesso.

## Testes

- Testar login válido, senha inválida, usuário inexistente e usuário inativo.
- Testar persistência e encerramento da sessão local.
- Testar que repositórios enviam a sessão e tratam resposta não autorizada.
- Preservar os testes de orçamentos, planejamento, ordenação e datas existentes.
- Executar a suíte completa e o build TypeScript/Vite.
