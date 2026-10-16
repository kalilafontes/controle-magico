# Lançamentos de Comissão

## Objetivo

Criar uma aba Comissão que registre pagamentos de comissão por item de orçamento, usando o preço de venda unitário já salvo no orçamento e um custo-base unitário informado pela usuária.

## Fluxo

Na tela Comissão, a pessoa escolhe um orçamento e um item. O sistema preenche cliente, produto, quantidade e valor de venda unitário. A pessoa informa o custo-base unitário e salva um lançamento inicialmente marcado como `Não pago`. A lista permite alternar o status para `Pago` e separa os totais a pagar e pagos.

## Cálculos

- venda total = quantidade × valor de venda unitário
- custo total = quantidade × custo-base unitário
- lucro = custo total × 50%
- comissão = (lucro × 20%) + ((venda total − custo total) × 50%)

Os valores calculados e os dados de origem são salvos como uma fotografia do momento do lançamento. Editar um orçamento depois não altera uma comissão existente.

## Persistência

A aba existente `Comissões` conterá uma linha por lançamento com as colunas: `ID`, `ID orçamento`, `Cliente`, `ID item`, `Produto`, `Quantidade`, `Valor venda unitário`, `Custo-base unitário`, `Venda total`, `Custo total`, `Lucro`, `Comissão`, `Status`, `Criado em`.

O Apps Script inicializa os cabeçalhos se a aba estiver vazia e informa um erro claro caso uma aba já preenchida tenha cabeçalhos incompatíveis. As operações autenticadas serão listar, salvar e atualizar o status.

## Limites

Não há alteração das estruturas de Orçamentos, Itens do Orçamento ou Planejamento. Não haverá exclusão nem edição de lançamento nesta primeira versão; um lançamento só muda de status após criado.

## Verificação

Testes unitários cobrirão os cálculos, incluindo quantidade, custo-base e valor de venda. Testes de interface cobrirão o acesso à aba, o formulário de inclusão e a apresentação dos totais por status. A compilação TypeScript verificará a integração da interface e dos repositórios.
