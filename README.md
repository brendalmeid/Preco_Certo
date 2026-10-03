# Preço Certo

Site para cadastrar produtos, somar os custos e calcular o preço de venda.
Feito com HTML, CSS e JavaScript, sem frameworks.

## Como usar

Abra `index.html` no navegador e informe o nome do seu negócio.
Depois, clique em "Novo produto" e preencha os itens de custo.

Se esquecer o código, informe o nome do negócio e clique em "Esqueci meu código".
Confirme a redefinição e digite o novo código duas vezes; deixe vazio para entrar
sem código. Os produtos são mantidos. Essa recuperação funciona apenas neste
navegador e não verifica identidade, pois o cadastro é uma simulação local.

As alterações são salvas automaticamente, com um aviso abaixo do botão.
Você também pode clicar em "Salvar produto" para salvar na hora e ver a confirmação.

Na parte 2, informe nome, categoria, unidade, quantidade usada, quantidade na embalagem fechada e preço pago pela embalagem. Use a mesma unidade nas duas quantidades (kg com kg ou g com g).

## Arquivos

- `index.html`: telas de entrada, lista de produtos e formulário.
- `style.css`: cores, tamanhos e organização da página.
- `script.js`: cadastro, cálculos, estoque e salvamento dos dados.
- `assets/logo-uemg.png`: logo da universidade.

## O que dá para fazer

- Cadastrar e editar vários produtos.
- Calcular o custo dos materiais a partir da quantidade usada e dos dados da embalagem fechada.
- Calcular o preço usando um percentual sobre o custo ou digitar um preço.
- Acompanhar o estoque e definir uma quantidade mínima.
- Ver avisos de prejuízo, margem abaixo de 15% e estoque baixo.

Os dados ficam no `localStorage` do navegador. O nome do negócio e o
código de acesso opcional servem para separar os cadastros. Esse login é
uma simulação local e não oferece autenticação segura.

## Cálculos

O subtotal de cada item é calculado assim:

`subtotal = (quantidade usada / quantidade na embalagem) × preço da embalagem`

Exemplo: macarrão em embalagem de 1 kg por R$ 10,00, com uso de 2,5 kg,
gera custo de R$ 25,00. Uma embalagem de 500 g por R$ 10,00, com uso de
250 g, gera custo de R$ 5,00. As duas quantidades usam a mesma unidade.

A quantidade na embalagem deve ser maior que zero. A quantidade usada e o
preço podem ser zero. Campos incompletos impedem o salvamento. O custo total
é a soma dos subtotais proporcionais ao consumo, sem arredondar o número de
embalagens compradas.

Itens antigos recebem quantidade de referência 1 na embalagem para preservar
os custos anteriores. Ao editar, ajuste a quantidade e o preço aos dados reais
da embalagem comprada.

Quando você informa o percentual desejado, o preço é calculado assim:

`preço = custo × (1 + percentual / 100)`

Esse percentual é aplicado sobre o custo (markup). A margem exibida no
resumo é calculada sobre o preço de venda:

`lucro = preço - custo`

`margem real = lucro / preço × 100`

## Visual

A página usa tons de azul e a logo da UEMG no topo. Em telas pequenas,
a tabela mostra os campos de cada item um abaixo do outro.
