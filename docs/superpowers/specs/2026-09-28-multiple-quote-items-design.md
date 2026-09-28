# Vários produtos por orçamento

## Objetivo

Permitir que um orçamento reúna vários produtos identificáveis, com quantidade,
valor unitário, subtotal por item e total consolidado. A pessoa deve conseguir
criar, editar e remover os produtos sem duplicá-los na planilha.

## Interface

O formulário de orçamento terá uma seção **Produtos**. Cada item será exibido
em um cartão/linha com:

- descrição do produto;
- quantidade;
- valor unitário;
- subtotal calculado;
- ação de remover, exceto quando for o único item.

O botão **+ Adicionar produto** acrescentará uma linha vazia. Abaixo da lista,
o resumo mostrará subtotal, desconto e total. Os campos de dinheiro (valor
unitário, desconto e valor recebido) serão `input` de texto com formatação em
real, por exemplo `R$ 25,00`; não usarão `type=number` nem os controles de
incremento/decremento do navegador. A quantidade permanece numérica.

## Dados e planilha

A aba `Orçamentos` continuará tendo uma única linha para cada orçamento. Seus
campos de subtotal, desconto e total serão recalculados a partir dos itens.

A aba `Itens do Orçamento` usará as colunas atuais:

`ID do orçamento | descrição | quantidade | valor unitário | subtotal`.

Ao carregar os orçamentos, o repositório buscará também essa aba e associará
os itens a cada orçamento pelo ID. Ao salvar:

1. grava a linha consolidada do orçamento;
2. atualiza as linhas de itens existentes daquele ID;
3. cria linhas apenas para itens novos;
4. limpa somente as células das linhas excedentes que antes pertenciam ao
   mesmo ID, para que produtos removidos não continuem sendo carregados.

Não serão apagadas linhas inteiras nem alterados itens de outros orçamentos.

## Regras e falhas

- É obrigatório haver pelo menos um item com descrição, quantidade positiva e
  valor válido.
- O último item não pode ser removido; o usuário deve preenchê-lo ou cancelar
  a edição.
- Valores monetários vazios serão tratados como zero durante a digitação e
  validados no salvamento.
- Se o carregamento ou salvamento falhar, o formulário permanece intacto e uma
  mensagem explicativa é exibida.

## Testes

- domínio: subtotal e total para múltiplos itens;
- repositório: carregar itens por ID, criar itens, editar sem duplicar e limpar
  os itens removidos sem tocar em linhas de outros orçamentos;
- interface: adicionar/remover linha, subtotal por linha, total geral,
  formatação e conversão de valores em real.
