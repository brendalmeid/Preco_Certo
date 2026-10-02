# Preço Certo

Site para cadastrar produtos, somar os custos e calcular o preço de venda.
Feito com HTML, CSS e JavaScript, sem frameworks.

## Como usar

Abra `index.html` no navegador e informe o nome do seu negócio.
Depois, clique em "Novo produto" e preencha os itens de custo.

As alterações são salvas automaticamente, com um aviso abaixo do botão.
Você também pode clicar em "Salvar produto" para salvar na hora e ver a confirmação.

As colunas da tabela se organizam automaticamente. Basta preencher os campos de quantidade e valor unitário.

## Arquivos

- `index.html`: telas de entrada, lista de produtos e formulário.
- `style.css`: cores, tamanhos e organização da página.
- `script.js`: cadastro, cálculos, estoque e salvamento dos dados.
- `assets/logo-uemg.png`: logo da universidade.

## O que dá para fazer

- Cadastrar e editar vários produtos.
- Informar os materiais, as quantidades e os valores de cada item.
- Calcular o preço usando um percentual sobre o custo ou digitar um preço.
- Acompanhar o estoque e definir uma quantidade mínima.
- Ver avisos de prejuízo, margem abaixo de 15% e estoque baixo.

Os dados ficam no `localStorage` do navegador. O nome do negócio e o
código de acesso opcional servem para separar os cadastros. Esse login é
uma simulação local e não oferece autenticação segura.

## Cálculos

O custo total é a soma de quantidade × valor unitário de cada item.
Quando você informa o percentual desejado, o preço é calculado assim:

`preço = custo × (1 + percentual / 100)`

Esse percentual é aplicado sobre o custo (markup). A margem exibida no
resumo é calculada sobre o preço de venda:

`lucro = preço - custo`

`margem real = lucro / preço × 100`

## Visual

A página usa tons de azul e a logo da UEMG no topo. Em telas pequenas,
a tabela mostra os campos de cada item um abaixo do outro.
