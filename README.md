# Preço Certo

Site para cadastrar produtos, somar os custos e calcular o preço de venda.
Feito com HTML, CSS e JavaScript, sem frameworks.

## Como usar

Entre com seu e-mail e senha e com o nome do negócio. Clique em **Novo produto**
e preencha os itens de custo, o preço e o estoque.

## Como os produtos são salvos

Ao editar um produto com os campos obrigatórios preenchidos, o site envia as
alterações para a API da Vercel. O botão **Salvar produto** envia na hora. A API
grava os dados no PostgreSQL do Supabase, vinculados à conta e ao nome do negócio.
Use a mesma conta e o mesmo nome para abrir o cadastro em outro dispositivo.

## Publicação na Vercel

1. Importe o repositório com o preset **Other** e o diretório raiz `./`.
2. Conecte um projeto [Supabase](https://vercel.com/marketplace/supabase) à Vercel.
3. No SQL Editor do Supabase, execute
   [a migração do banco](supabase/migrations/20261123000000_negocios.sql).
   Em **Authentication → Users**, crie o usuário que vai acessar o site.
4. Confira as variáveis `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` na Vercel.
   A integração também pode adicioná-las com o prefixo `NEXT_PUBLIC_`.
5. Faça o deploy. O `vercel.json` define o build e a pasta de saída.

Os dados de versões anteriores só aparecem no Supabase após uma migração.

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
