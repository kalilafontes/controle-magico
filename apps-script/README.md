# Publicar o Web App da planilha

1. Abra a planilha e clique em **Extensões → Apps Script**.
2. No arquivo `Code.gs`, apague o conteúdo inicial e cole o conteúdo de
   [`Code.gs`](./Code.gs).
3. Clique em **Implantar → Nova implantação → Aplicativo da Web**.
4. Escolha **Executar como: Eu** e **Quem tem acesso: Qualquer pessoa**.
5. Autorize as permissões solicitadas e copie a URL terminada em `/exec`.
6. No ambiente do site, crie `VITE_APPS_SCRIPT_URL=<a-url-copiada>`.

Use somente a URL `/exec` no site publicado. A URL `/dev` funciona apenas para
quem edita o Apps Script.

## Verificação manual

Após publicar, a tela de login deve aceitar um usuário `Ativo = Sim` da aba
`Usuários`, por exemplo `kalila.fontes@gmail.com` com a senha cadastrada. Uma
senha incorreta, e-mail inexistente ou usuário com `Ativo = Não` deve mostrar
`E-mail ou senha inválidos.`. Depois de entrar, fechar e abrir o navegador deve
manter o acesso. Ao mudar o valor `Ativo` para `Não`, a próxima leitura ou
gravação deve levar a pessoa de volta ao login.

Para publicar uma alteração futura no script, clique em **Implantar → Gerenciar
implantações**, edite a implantação e crie uma nova versão. A URL `/exec`
permanece a mesma.
