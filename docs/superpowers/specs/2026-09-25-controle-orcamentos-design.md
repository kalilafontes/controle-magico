# Sistema de controle de orçamentos — desenho

## Objetivo

Criar um sistema web responsivo, em React, para três usuários com contas Gmail criarem, consultarem e atualizarem orçamentos pelo celular ou computador. O Google Planilhas será a fonte de dados; o uso cotidiano acontece no site, não na planilha.

## Restrições e decisões

- Desenvolvimento rápido, inicialmente local, com servidor de desenvolvimento ativo.
- Sem backend próprio, banco de dados adicional, Git ou commits nesta etapa.
- Login com Google e acesso direto à Google Sheets API pelo React.
- Uma única planilha será compartilhada com as três contas Gmail autorizadas.
- O site não exibirá o link da planilha, mas usuários com permissão de edição poderão abri-la se tiverem o link.
- Visual mobile-first com identidade rosa já aprovada.

## Arquitetura

```text
React (navegador)
  ├─ Google Identity Services: login e autorização OAuth
  └─ Google Sheets API: leitura e gravação
                         └─ Planilha compartilhada
```

O React obtém um token de acesso após o usuário autorizar o escopo de planilhas. A API é chamada diretamente no navegador e só permite acesso à planilha para contas que receberam compartilhamento. O ID da planilha e o ID público do cliente OAuth ficam em uma configuração local. Nenhuma chave privada ou segredo é usado no navegador.

## Dados na planilha

### Aba `Orçamentos`

Uma linha por orçamento:

`ID`, `Criado em`, `Atualizado em`, `Cliente`, `Telefone`, `Status`, `Validade`, `Subtotal`, `Desconto`, `Total`, `Observações`.

### Aba `Itens do Orçamento`

Uma linha por item, vinculada ao orçamento por `Orçamento ID`:

`Orçamento ID`, `Descrição`, `Quantidade`, `Valor unitário`, `Total do item`.

### Aba `Clientes`

Reservada para evolução posterior. A primeira versão pode preencher nome e telefone diretamente no orçamento, sem cadastro obrigatório de clientes.

## Telas e fluxos

### Login

O usuário entra com uma conta Google. Se a conta não tiver acesso à planilha, o sistema informa como solicitar acesso e não mostra dados.

### Painel

Mostra quantidade e valor de orçamentos em aberto, botão para novo orçamento e os registros recentes. A navegação é adequada ao uso com uma mão no celular.

### Lista de orçamentos

Permite buscar por número ou cliente e visualizar status, validade e total. Tocar em um registro abre a edição.

### Novo orçamento e edição

Permite preencher cliente, telefone, validade, status, observações e uma lista variável de itens. Cada item possui descrição, quantidade e valor unitário. O subtotal, desconto e total são calculados na tela antes do salvamento. Salvar cria ou atualiza as linhas correspondentes nas duas abas.

## Estados de erro

- Login cancelado ou token expirado: solicitar novo login.
- Conta sem compartilhamento na planilha: mensagem explicando que o acesso precisa ser liberado.
- Planilha ou abas ausentes: mensagem de configuração inválida, sem gravar dados parciais.
- Falha de rede ou API: manter o formulário preenchido e permitir nova tentativa.
- Dados inválidos: impedir salvamento e indicar campos obrigatórios ou valores numéricos inválidos.

## Configuração do Google

1. Criar uma planilha no Google Drive e compartilhar com os três endereços Gmail.
2. Criar um projeto no Google Cloud, configurar a tela de consentimento OAuth como teste e incluir as três contas como usuários de teste.
3. Criar um cliente OAuth para aplicativo web, autorizando `http://localhost` e a porta usada pelo servidor local.
4. Habilitar a Google Sheets API.
5. Informar o ID da planilha e o ID do cliente OAuth no arquivo local de configuração do React.

## Verificação da primeira versão

- Login com uma das contas autorizadas e recusa clara para conta sem acesso.
- Leitura dos orçamentos existentes.
- Criação de orçamento com múltiplos itens e total correto.
- Edição de orçamento sem duplicar itens antigos.
- Confirmação, na planilha, de que as linhas foram criadas ou atualizadas.
- Conferência visual nas larguras de celular e desktop.

## Fora do escopo inicial

- PDF, envio por WhatsApp ou e-mail.
- Perfis e permissões internas.
- Relatórios avançados.
- Publicação em hospedagem pública.
- Persistência offline.
