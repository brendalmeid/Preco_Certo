(() => {
  'use strict';

  const CHAVE_SESSAO = 'preco-certo:sessao';
  const PREFIXO_USUARIO = 'preco-certo:usuario:';
  const MARGEM_BAIXA_LIMITE = 15; // %

  const formatarMoeda = (valor) =>
    (isFinite(valor) ? valor : 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const formatarPercentual = (valor) =>
    `${(isFinite(valor) ? valor : 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;

  let sequenciaId = 1;
  const novoId = (prefixo) => `${prefixo}-${Date.now().toString(36)}-${sequenciaId++}`;

  const buscarElemento = (seletor, raiz = document) => raiz.querySelector(seletor);
  const buscarElementos = (seletor, raiz = document) => Array.from(raiz.querySelectorAll(seletor));

  // elementos: login
  const viewLogin = buscarElemento('#view-login');
  const viewApp = buscarElemento('#view-app');
  const loginNome = buscarElemento('#login-nome');
  const loginSenha = buscarElemento('#login-senha');
  const btnEntrar = buscarElemento('#btn-entrar');
  const btnEsqueciCodigo = buscarElemento('#btn-esqueci-codigo');
  const erroLogin = buscarElemento('#erro-login');
  const btnSair = buscarElemento('#btn-sair');
  const usuarioLogadoNome = buscarElemento('#usuario-logado-nome');

  // elementos: dashboard
  const viewDashboard = buscarElemento('#view-dashboard');
  const viewProduto = buscarElemento('#view-produto');
  const gradeProdutos = buscarElemento('#grade-produtos');
  const dashboardVazio = buscarElemento('#dashboard-vazio');
  const btnNovoProdutoDash = buscarElemento('#btn-novo-produto-dash');
  const alertasGerais = buscarElemento('#alertas-gerais');
  const templateCardProduto = buscarElemento('#template-card-produto');
  const btnVoltarDashboard = buscarElemento('#btn-voltar-dashboard');

  // elementos: produto
  const elNome = buscarElemento('#produto-nome');
  const elDescricao = buscarElemento('#produto-descricao');
  const corpoTabela = buscarElemento('#corpo-tabela-custos');
  const custoTotalTabela = buscarElemento('#custo-total-tabela');
  const btnAddItem = buscarElemento('#btn-add-item');
  const erroProdutoNome = buscarElemento('#erro-produto-nome');
  const erroCustos = buscarElemento('#erro-custos');
  const erroMargem = buscarElemento('#erro-margem');
  const erroPreco = buscarElemento('#erro-preco');
  const radiosModo = buscarElementos('input[name="modo-preco"]');
  const blocoMargem = buscarElemento('#bloco-margem');
  const blocoPreco = buscarElemento('#bloco-preco');
  const inputMargem = buscarElemento('#margem-desejada');
  const inputPrecoVenda = buscarElemento('#preco-venda-input');
  const inputEstoqueAtual = buscarElemento('#estoque-atual');
  const inputEstoqueMinimo = buscarElemento('#estoque-minimo');
  const templateLinhaCusto = buscarElemento('#template-linha-custo');
  const btnExcluirProduto = buscarElemento('#btn-excluir-produto');
  const btnSalvarProduto = buscarElemento('#btn-salvar-produto');
  const statusSalvamento = buscarElemento('#status-salvamento');

  const resProduto = buscarElemento('#titulo-resumo');
  const resCustoTotal = buscarElemento('#res-custo-total');
  const resLabelPreco = buscarElemento('#res-label-preco');
  const resPrecoVenda = buscarElemento('#res-preco-venda');
  const resLucro = buscarElemento('#res-lucro');
  const resMargemReal = buscarElemento('#res-margem-real');
  const resumoNota = buscarElemento('#resumo-nota');
  const resumoAlertas = buscarElemento('#resumo-alertas');

  // estado em memoria
  let chaveUsuarioAtual = null;
  let registro = null;       // { nomeexibicao, senha, produtos: [...] }
  let produtoAtualId = null; // id do produto em edicao

  // persistencia
  function normalizarChave(nome) {
    return nome.trim().toLowerCase();
  }

  function carregarRegistro(chave) {
    try {
      const bruto = localStorage.getItem(PREFIXO_USUARIO + chave);
      return bruto ? JSON.parse(bruto) : null;
    } catch (e) {
      return null;
    }
  }

  let salvarTimer = null;
  function salvarRegistro(imediato = false) {
    if (!chaveUsuarioAtual || !registro) return false;
    clearTimeout(salvarTimer);
    salvarTimer = null;
    if (produtoAtualId && !validarFormularioProduto()) {
      statusSalvamento.textContent = 'Revise os campos obrigatórios antes de salvar';
      statusSalvamento.classList.add('status-salvamento--erro');
      return false;
    }
    statusSalvamento.textContent = 'Salvando…';
    statusSalvamento.classList.remove('status-salvamento--erro');

    function gravar() {
      salvarTimer = null;
      if (produtoAtualId && !validarFormularioProduto()) return false;
      try {
        const anteriores = carregarRegistro(chaveUsuarioAtual)?.produtos || [];
        const produtos = registro.produtos.flatMap((produto) => {
          if (produtoCompleto(produto)) return [produto];
          const anterior = anteriores.find((p) => p.id === produto.id);
          return anterior ? [anterior] : [];
        });
        localStorage.setItem(PREFIXO_USUARIO + chaveUsuarioAtual, JSON.stringify({ ...registro, produtos }));
        statusSalvamento.textContent = 'Alterações salvas';
        return true;
      } catch (e) {
        statusSalvamento.textContent = 'Não foi possível salvar. Tente novamente.';
        statusSalvamento.classList.add('status-salvamento--erro');
        console.warn('Não foi possível salvar:', e);
        return false;
      }
    }

    if (imediato) return gravar();
    salvarTimer = setTimeout(gravar, 250);
  }

  // calculo
  function subtotalValido(item) {
    const qtd = parseFloat(item.qtd);
    const valor = parseFloat(item.valor);
    const qtdEmbalagem = parseFloat(item.qtdEmbalagem ?? 1);
    if (![qtd, valor, qtdEmbalagem].every(Number.isFinite) || qtd < 0 || valor < 0 || qtdEmbalagem <= 0) return null;
    const subtotal = (qtd / qtdEmbalagem) * valor;
    return Number.isFinite(subtotal) ? subtotal : null;
  }

  function custoTotalDe(produto) {
    return produto.itens.reduce((soma, item) => soma + (subtotalValido(item) || 0), 0);
  }

  // preco por markup sobre o custo; margem real sempre = lucro / preco de venda.
  function calcularProduto(produto) {
    const custo = custoTotalDe(produto);
    let preco = 0;

    if (produto.modoPreco === 'margem') {
      const margem = parseFloat(produto.margem);
      if (!isNaN(margem) && margem >= 0) preco = custo * (1 + margem / 100);
    } else {
      const pv = parseFloat(produto.precoVenda);
      if (!isNaN(pv) && pv >= 0) preco = pv;
    }

    const lucro = preco - custo;
    const margemReal = preco > 0 ? (lucro / preco) * 100 : 0;
    return { custo, preco, lucro, margemReal };
  }

  function estoqueStatus(produto) {
    const atual = produto.estoqueAtual === '' || produto.estoqueAtual == null ? null : Number(produto.estoqueAtual);
    const minimo = produto.estoqueMinimo === '' || produto.estoqueMinimo == null ? null : Number(produto.estoqueMinimo);
    if (atual === null) return { texto: 'Estoque: —', classe: '' };
    const baixo = minimo !== null && minimo > 0 && atual <= minimo;
    return { texto: `Estoque: ${atual}`, classe: baixo ? 'chip--estoque-baixo' : 'chip--estoque-ok', baixo };
  }

  function alertasDoProduto(produto) {
    const { lucro, margemReal, preco } = calcularProduto(produto);
    const lista = [];
    if (preco > 0 && lucro < 0) {
      lista.push('Esse preço está dando prejuízo neste produto.');
    } else if (preco > 0 && margemReal > 0 && margemReal < MARGEM_BAIXA_LIMITE) {
      lista.push(`Margem apertada: abaixo de ${MARGEM_BAIXA_LIMITE}%.`);
    }
    const estoque = estoqueStatus(produto);
    if (estoque.baixo) lista.push('Estoque baixo — hora de repor.');
    return lista;
  }

  // login
  function tentarEntrar() {
    const nome = loginNome.value;
    const senha = loginSenha.value;

    if (nome.trim() === '') {
      erroLogin.textContent = 'Informe o nome do seu negócio.';
      loginNome.focus();
      return;
    }

    const chave = normalizarChave(nome);
    let dados = carregarRegistro(chave);

    if (dados) {
      if (dados.senha && dados.senha !== senha) {
        erroLogin.textContent = 'Código de acesso incorreto para esse nome.';
        loginSenha.focus();
        return;
      }
    } else {
      dados = { nomeExibicao: nome.trim(), senha: senha || '', produtos: [] };
      localStorage.setItem(PREFIXO_USUARIO + chave, JSON.stringify(dados));
    }

    erroLogin.textContent = '';
    localStorage.setItem(CHAVE_SESSAO, chave);
    abrirApp(chave, dados);
  }

  function redefinirCodigo() {
    const nome = loginNome.value.trim();
    erroLogin.textContent = '';
    if (!nome) {
      erroLogin.textContent = 'Informe o nome do seu negócio para redefinir o código.';
      loginNome.focus();
      return;
    }

    const chave = normalizarChave(nome);
    const dados = carregarRegistro(chave);
    if (!dados) {
      erroLogin.textContent = 'Nenhum cadastro encontrado com esse nome neste navegador.';
      loginNome.focus();
      return;
    }

    if (!window.confirm(`Redefinir o código de "${dados.nomeExibicao}" neste navegador? Seus produtos serão mantidos. Como este é um cadastro local, qualquer pessoa com acesso a este navegador pode redefinir o código.`)) return;
    const novoCodigo = window.prompt('Digite o novo código de acesso. Deixe vazio para entrar sem código.');
    if (novoCodigo === null) return;
    const confirmacao = window.prompt('Digite novamente o novo código para confirmar.');
    if (confirmacao === null) return;
    if (novoCodigo !== confirmacao) {
      erroLogin.textContent = 'Os códigos não coincidem. Clique em "Esqueci meu código" para tentar novamente.';
      btnEsqueciCodigo.focus();
      return;
    }

    try {
      localStorage.setItem(PREFIXO_USUARIO + chave, JSON.stringify({ ...dados, senha: novoCodigo }));
    } catch (e) {
      erroLogin.textContent = 'Não foi possível redefinir o código. Tente novamente.';
      return;
    }
    loginSenha.value = '';
    loginSenha.focus();
    mostrarToast('Código redefinido. Informe o novo código e clique em Entrar.');
  }

  function sair() {
    if (salvarTimer !== null && !salvarRegistro(true)) {
      mostrarToast('Não foi possível salvar. Tente salvar antes de sair.');
      return;
    }
    localStorage.removeItem(CHAVE_SESSAO);
    chaveUsuarioAtual = null;
    registro = null;
    loginNome.value = '';
    loginSenha.value = '';
    erroLogin.textContent = '';
    viewApp.hidden = true;
    viewLogin.hidden = false;
    loginNome.focus();
  }

  function abrirApp(chave, dados) {
    chaveUsuarioAtual = chave;
    registro = dados;
    // Uma embalagem de referência com quantidade 1 preserva o custo antigo por unidade.
    registro.produtos.forEach((produto) => produto.itens.forEach((item) => {
      if (item.qtdEmbalagem === undefined) item.qtdEmbalagem = 1;
    }));
    usuarioLogadoNome.textContent = dados.nomeExibicao;
    viewLogin.hidden = true;
    viewApp.hidden = false;
    mostrarDashboard();
  }

  btnEntrar.addEventListener('click', tentarEntrar);
  btnEsqueciCodigo.addEventListener('click', redefinirCodigo);
  loginSenha.addEventListener('keydown', (e) => { if (e.key === 'Enter') tentarEntrar(); });
  loginNome.addEventListener('keydown', (e) => { if (e.key === 'Enter') tentarEntrar(); });
  btnSair.addEventListener('click', sair);

  // dashboard
  function mostrarDashboard() {
    produtoAtualId = null;
    viewProduto.hidden = true;
    viewDashboard.hidden = false;
    renderDashboard();
  }

  function renderDashboard() {
    gradeProdutos.innerHTML = '';
    const produtos = registro.produtos;

    dashboardVazio.hidden = produtos.length > 0;

    let produtosComPrejuizo = 0;
    let produtosComMargemBaixa = 0;
    let produtosComEstoqueBaixo = 0;

    produtos.forEach((produto) => {
      const { custo, preco, margemReal, lucro } = calcularProduto(produto);
      const estoque = estoqueStatus(produto);
      const alertas = alertasDoProduto(produto);

      if (preco > 0 && lucro < 0) produtosComPrejuizo++;
      else if (preco > 0 && margemReal > 0 && margemReal < MARGEM_BAIXA_LIMITE) produtosComMargemBaixa++;
      if (estoque.baixo) produtosComEstoqueBaixo++;

      const fragmento = templateCardProduto.content.cloneNode(true);
      fragmento.querySelector('.card-produto__nome').textContent = produto.nome.trim() || 'Produto sem nome';

      const chipEstoque = fragmento.querySelector('.chip--estoque');
      chipEstoque.textContent = estoque.texto;
      if (estoque.classe) chipEstoque.classList.add(estoque.classe);

      fragmento.querySelector('.cp-custo').textContent = formatarMoeda(custo);
      fragmento.querySelector('.cp-preco').textContent = preco > 0 ? formatarMoeda(preco) : '—';
      fragmento.querySelector('.cp-margem').textContent = preco > 0 ? formatarPercentual(margemReal) : '—';

      const elAlertas = fragmento.querySelector('.card-produto__alertas');
      alertas.slice(0, 2).forEach((texto) => {
        const span = document.createElement('span');
        span.textContent = texto;
        elAlertas.appendChild(span);
      });

      fragmento.querySelector('.btn-abrir-produto').addEventListener('click', () => abrirProduto(produto.id));
      gradeProdutos.appendChild(fragmento);
    });

    alertasGerais.innerHTML = '';
    const linhas = [];
    if (produtosComPrejuizo > 0) linhas.push({ texto: `${produtosComPrejuizo} produto(s) vendendo com prejuízo.`, tipo: 'erro' });
    if (produtosComEstoqueBaixo > 0) linhas.push({ texto: `${produtosComEstoqueBaixo} produto(s) com estoque baixo.`, tipo: 'ambar' });
    if (produtosComMargemBaixa > 0) linhas.push({ texto: `${produtosComMargemBaixa} produto(s) com margem apertada (abaixo de ${MARGEM_BAIXA_LIMITE}%).`, tipo: 'ambar' });

    alertasGerais.hidden = linhas.length === 0;
    linhas.forEach(({ texto, tipo }) => {
      const div = document.createElement('div');
      div.className = `alerta-linha alerta-linha--${tipo}`;
      div.textContent = texto;
      alertasGerais.appendChild(div);
    });
  }

  function criarProdutoVazio() {
    return {
      id: novoId('produto'),
      nome: '',
      descricao: '',
      itens: [{ id: novoId('item'), nome: '', categoria: 'Matéria-prima', qtd: '', unidade: '', qtdEmbalagem: '', valor: '' }],
      modoPreco: 'margem',
      margem: '',
      precoVenda: '',
      estoqueAtual: '',
      estoqueMinimo: '',
    };
  }

  btnNovoProdutoDash.addEventListener('click', () => {
    const produto = criarProdutoVazio();
    registro.produtos.push(produto);
    abrirProduto(produto.id);
  });

  btnVoltarDashboard.addEventListener('click', mostrarDashboard);

  // edicao de produto
  function produtoAtual() {
    return registro.produtos.find((p) => p.id === produtoAtualId) || null;
  }

  function abrirProduto(id) {
    produtoAtualId = id;
    viewDashboard.hidden = true;
    viewProduto.hidden = false;
    renderFormularioProduto();
  }

  function renderFormularioProduto() {
    const produto = produtoAtual();
    if (!produto) { mostrarDashboard(); return; }

    elNome.value = produto.nome;
    elDescricao.value = produto.descricao;
    inputMargem.value = produto.margem;
    inputPrecoVenda.value = produto.precoVenda;
    inputEstoqueAtual.value = produto.estoqueAtual;
    inputEstoqueMinimo.value = produto.estoqueMinimo;

    document.querySelector(`input[name="modo-preco"][value="${produto.modoPreco}"]`).checked = true;
    blocoMargem.hidden = produto.modoPreco !== 'margem';
    blocoPreco.hidden = produto.modoPreco !== 'preco';

    if (produto.itens.length === 0) {
      produto.itens.push({ id: novoId('item'), nome: '', categoria: 'Matéria-prima', qtd: '', unidade: '', qtdEmbalagem: '', valor: '' });
    }

    nomeFoiTocado = false;
    renderLinhasCusto(produto);
    validarNomeProduto();
    recalcularTudo();
  }

  function renderLinhasCusto(produto) {
    corpoTabela.innerHTML = '';

    if (produto.itens.length === 0) {
      const tr = document.createElement('tr');
      tr.className = 'linha-vazia';
      tr.innerHTML = `<td colspan="8">Nenhum item de custo adicionado ainda. Clique em "Adicionar item de custo" para começar.</td>`;
      corpoTabela.appendChild(tr);
      return;
    }

    produto.itens.forEach((item) => {
      const fragmento = templateLinhaCusto.content.cloneNode(true);
      const tr = fragmento.querySelector('.linha-custo');
      tr.dataset.id = item.id;

      const campoNome = tr.querySelector('.input-nome-item');
      const campoCategoria = tr.querySelector('.input-categoria');
      const campoQuantidade = tr.querySelector('.input-qtd');
      const campoUnidade = tr.querySelector('.input-unidade');
      const campoOutraUnidade = tr.querySelector('.input-unidade-outro');
      const campoValor = tr.querySelector('.input-valor');
      const campoEmbalagem = tr.querySelector('.input-qtd-embalagem');
      const btnRemover = tr.querySelector('.btn-remover');

      campoNome.value = item.nome || '';
      campoCategoria.value = item.categoria || 'Matéria-prima';
      campoQuantidade.value = item.qtd ?? '';
      campoValor.value = item.valor ?? '';
      campoEmbalagem.value = item.qtdEmbalagem ?? 1;

      const unidadesPadrao = ['kg', 'g', 'L', 'ml', 'un', 'dz', 'pacote', 'cx', 'm', 'cm', 'fatia', 'porcao'];
      if (item.unidade && !unidadesPadrao.includes(item.unidade)) {
        campoUnidade.value = 'outro';
        campoOutraUnidade.hidden = false;
        campoOutraUnidade.value = item.unidade;
      } else {
        campoUnidade.value = item.unidade || '';
        campoOutraUnidade.hidden = true;
      }

      const atualizar = (campo, valor) => { item[campo] = valor; recalcularTudo(); };

      function atualizarUnidadeDaQuantidade() {
        const unidade = item.unidade === 'porcao' ? 'porção' : (item.unidade || '').trim();
        const descricao = unidade ? `Quantidade usada (${unidade})` : 'Quantidade usada';
        const exemplo = ['kg', 'L', 'm'].includes(unidade) ? 'Ex: 0,5' : 'Ex: 2';

        tr.querySelector('.quantidade-unidade').textContent = unidade ? descricao : '';
        campoQuantidade.closest('td').dataset.label = descricao;
        campoQuantidade.setAttribute('aria-label', descricao);
        campoQuantidade.placeholder = exemplo;
        const descricaoEmbalagem = unidade ? `Quantidade na embalagem (${unidade})` : 'Quantidade na embalagem';
        tr.querySelector('.embalagem-unidade').textContent = unidade ? descricaoEmbalagem : '';
        campoEmbalagem.closest('td').dataset.label = descricaoEmbalagem;
        campoEmbalagem.setAttribute('aria-label', descricaoEmbalagem);
      }

      atualizarUnidadeDaQuantidade();

      campoNome.addEventListener('input', () => atualizar('nome', campoNome.value));
      campoCategoria.addEventListener('change', () => atualizar('categoria', campoCategoria.value));

      campoUnidade.addEventListener('change', () => {
        if (campoUnidade.value === 'outro') {
          campoOutraUnidade.hidden = false;
          campoOutraUnidade.focus();
          atualizar('unidade', campoOutraUnidade.value);
        } else {
          campoOutraUnidade.hidden = true;
          atualizar('unidade', campoUnidade.value);
        }
        atualizarUnidadeDaQuantidade();
      });
      campoOutraUnidade.addEventListener('input', () => {
        atualizar('unidade', campoOutraUnidade.value);
        atualizarUnidadeDaQuantidade();
      });

      campoQuantidade.addEventListener('input', () => {
        if (campoQuantidade.value !== '' && Number(campoQuantidade.value) < 0) campoQuantidade.value = 0;
        atualizar('qtd', campoQuantidade.value);
      });
      campoEmbalagem.addEventListener('input', () => atualizar('qtdEmbalagem', campoEmbalagem.value));
      campoValor.addEventListener('input', () => {
        if (campoValor.value !== '' && Number(campoValor.value) < 0) campoValor.value = 0;
        atualizar('valor', campoValor.value);
      });

      btnRemover.addEventListener('click', () => {
        const produtoAgora = produtoAtual();
        const nomeItem = item.nome && item.nome.trim() ? item.nome.trim() : 'este item';
        if (!window.confirm(`Remover "${nomeItem}"? Essa ação não pode ser desfeita.`)) return;
        produtoAgora.itens = produtoAgora.itens.filter((i) => i.id !== item.id);
        renderLinhasCusto(produtoAgora);
        recalcularTudo();
        mostrarToast(`"${nomeItem}" removido.`);
      });

      const celulaSubtotal = tr.querySelector('.celula-subtotal');
      celulaSubtotal.dataset.id = item.id;
      corpoTabela.appendChild(fragmento);
    });
  }

  function atualizarSubtotaisNaTela(produto) {
    let algumIncompleto = false;
    produto.itens.forEach((item) => {
      const sub = subtotalValido(item);
      const celula = corpoTabela.querySelector(`.celula-subtotal[data-id="${item.id}"]`);
      if (!celula) return;
      if (sub === null) {
        const tocado = item.nome || item.qtd !== '' || item.valor !== '' || item.qtdEmbalagem !== '';
        celula.textContent = tocado ? '— incompleto' : 'R$ 0,00';
        if (tocado) algumIncompleto = true;
      } else {
        celula.textContent = formatarMoeda(sub);
      }
    });
    erroCustos.textContent = algumIncompleto
      ? 'Preencha quantidade usada, quantidade na embalagem e preço da embalagem. A quantidade na embalagem deve ser maior que zero; os demais valores podem ser zero.'
      : '';
  }

  function pulsar(el) {
    el.classList.remove('pulso');
    void el.offsetWidth;
    el.classList.add('pulso');
    clearTimeout(el._pulsoTimer);
    el._pulsoTimer = setTimeout(() => el.classList.remove('pulso'), 220);
  }

  function renderResumo(produto) {
    const { custo, preco, lucro, margemReal } = calcularProduto(produto);

    resProduto.textContent = produto.nome.trim() || 'Seu produto';
    resLabelPreco.textContent = produto.modoPreco === 'margem' ? 'Preço de venda sugerido' : 'Preço de venda informado';

    const antes = { c: resCustoTotal.textContent, p: resPrecoVenda.textContent, l: resLucro.textContent };

    resCustoTotal.textContent = formatarMoeda(custo);
    resPrecoVenda.textContent = formatarMoeda(preco);
    resLucro.textContent = formatarMoeda(lucro);
    resMargemReal.textContent = formatarPercentual(margemReal);

    if (antes.c !== resCustoTotal.textContent) pulsar(resCustoTotal);
    if (antes.p !== resPrecoVenda.textContent) pulsar(resPrecoVenda);
    if (antes.l !== resLucro.textContent) pulsar(resLucro);

    resLucro.style.color = lucro < 0 ? '#C4281E' : '';

    const temItensValidos = produto.itens.some((i) => subtotalValido(i) !== null);
    if (!temItensValidos) {
      resumoNota.textContent = 'Adicione ao menos um item de custo válido para começar a simulação.';
    } else if (preco <= 0) {
      resumoNota.textContent = produto.modoPreco === 'margem'
        ? 'Informe uma margem de lucro para calcular o preço de venda.'
        : 'Informe um preço de venda pretendido.';
    } else {
      resumoNota.textContent = 'Valores recalculados automaticamente a cada alteração.';
    }

    custoTotalTabela.textContent = formatarMoeda(custo);

    const alertas = alertasDoProduto(produto);
    resumoAlertas.innerHTML = '';
    resumoAlertas.hidden = alertas.length === 0;
    alertas.forEach((texto) => {
      const p = document.createElement('p');
      p.textContent = `⚠ ${texto}`;
      resumoAlertas.appendChild(p);
    });
  }

  const contextoMedidaNome = document.createElement('canvas').getContext('2d');

  function ajustarLarguraNomeItem() {
    const campos = buscarElementos('.input-nome-item', corpoTabela);
    if (!contextoMedidaNome || campos.length === 0) return;
    contextoMedidaNome.font = window.getComputedStyle(campos[0]).font;
    const larguraTexto = Math.max(...campos.map((campo) => contextoMedidaNome.measureText(campo.value).width));
    const largura = Math.min(420, Math.max(110, Math.ceil(larguraTexto + 40)));
    corpoTabela.closest('table').style.setProperty('--largura-nome-item', `${largura}px`);
  }

  function recalcularTudo() {
    const produto = produtoAtual();
    if (!produto) return;
    ajustarLarguraNomeItem();
    atualizarSubtotaisNaTela(produto);
    renderResumo(produto);
    salvarRegistro();
  }

  // validacao
  function produtoCompleto(produto) {
    const texto = (valor) => typeof valor === 'string' && valor.trim() !== '';
    const numero = (valor) => valor !== '' && valor != null &&
      String(valor).trim() !== '' && Number.isFinite(Number(valor)) && Number(valor) >= 0;
    return texto(produto.nome) && produto.itens.every((item) =>
      texto(item.nome) && texto(item.unidade) && numero(item.qtd) && numero(item.valor)) &&
      numero(produto.modoPreco === 'margem' ? produto.margem : produto.precoVenda) &&
      [produto.estoqueAtual, produto.estoqueMinimo].every((valor) => valor === '' || numero(valor));
  }

  const numeroNaoNegativo = (campo) => campo.value.trim() !== '' &&
    Number.isFinite(Number(campo.value)) && Number(campo.value) >= 0 && !campo.validity.badInput;

  function validarFormularioProduto(mostrarErros = false) {
    const produto = produtoAtual();
    if (!produto) return false;
    let primeiroInvalido = null;
    function verificar(campo, valido) {
      if (!valido && !primeiroInvalido) primeiroInvalido = campo;
      if (mostrarErros) campo.setAttribute('aria-invalid', String(!valido));
      return valido;
    }

    verificar(elNome, elNome.value.trim() !== '');
    let custosValidos = true;
    buscarElementos('.linha-custo', corpoTabela).forEach((linha) => {
      const unidade = buscarElemento('.input-unidade', linha);
      const campos = [
        buscarElemento('.input-nome-item', linha),
        unidade.value === 'outro' ? buscarElemento('.input-unidade-outro', linha) : unidade,
        buscarElemento('.input-qtd', linha),
        buscarElemento('.input-valor', linha),
        buscarElemento('.input-qtd-embalagem', linha),
      ];
      campos.forEach((campo, indice) => {
        const valido = indice < 2 ? campo.value.trim() !== '' : numeroNaoNegativo(campo) && (indice !== 4 || Number(campo.value) > 0);
        if (!verificar(campo, valido)) custosValidos = false;
      });
    });
    const campoPreco = produto.modoPreco === 'margem' ? inputMargem : inputPrecoVenda;
    verificar(campoPreco, numeroNaoNegativo(campoPreco));
    [inputEstoqueAtual, inputEstoqueMinimo].forEach((campo) => {
      verificar(campo, campo.value === '' && !campo.validity.badInput || numeroNaoNegativo(campo));
    });

    if (mostrarErros) {
      nomeFoiTocado = true;
      validarNomeProduto();
      erroCustos.textContent = custosValidos ? '' : 'Preencha nome, unidade, quantidade usada, quantidade na embalagem e preço da embalagem. A quantidade na embalagem deve ser maior que zero; os demais números podem ser zero.';
      validarMargem();
      validarPreco();
      validarEstoque();
      if (primeiroInvalido) primeiroInvalido.focus();
    }
    return primeiroInvalido === null;
  }

  let nomeFoiTocado = false;
  function validarNomeProduto() {
    const vazio = elNome.value.trim() === '';
    const mostrarErro = vazio && nomeFoiTocado;
    elNome.closest('.campo').classList.toggle('campo--erro', mostrarErro);
    erroProdutoNome.textContent = mostrarErro ? 'Informe o nome do produto.' : '';
    return !vazio;
  }

  function validarMargem() {
    const produto = produtoAtual();
    if (!produto || produto.modoPreco !== 'margem') { erroMargem.textContent = ''; return true; }
    const invalido = !numeroNaoNegativo(inputMargem);
    erroMargem.textContent = invalido ? 'Informe uma margem maior ou igual a zero.' : '';
    return !invalido;
  }

  function validarPreco() {
    const produto = produtoAtual();
    if (!produto || produto.modoPreco !== 'preco') { erroPreco.textContent = ''; return true; }
    const invalido = !numeroNaoNegativo(inputPrecoVenda);
    erroPreco.textContent = invalido ? 'Informe um preço de venda maior ou igual a zero.' : '';
    return !invalido;
  }

  function validarEstoque() {
    const a = inputEstoqueAtual.value, m = inputEstoqueMinimo.value;
    const invalido = (a !== '' && Number(a) < 0) || (m !== '' && Number(m) < 0);
    erroEstoqueEl().textContent = invalido ? 'Os valores de estoque não podem ser negativos.' : '';
    return !invalido;
  }
  const erroEstoqueEl = () => buscarElemento('#erro-estoque');

  // toast
  const toast = buscarElemento('#toast') || (() => {
    const p = document.createElement('p');
    p.id = 'toast';
    p.className = 'aviso-toast';
    p.setAttribute('role', 'status');
    p.setAttribute('aria-live', 'polite');
    document.body.appendChild(p);
    return p;
  })();
  let toastTimer = null;
  function mostrarToast(msg) {
    toast.textContent = msg;
    toast.classList.add('mostrar');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('mostrar'), 2200);
  }

  // eventos do formulario
  btnSalvarProduto.addEventListener('click', () => {
    if (!produtoAtual()) return;
    if (!validarFormularioProduto(true)) {
      clearTimeout(salvarTimer);
      salvarTimer = null;
      statusSalvamento.textContent = 'Revise os campos obrigatórios antes de salvar';
      statusSalvamento.classList.add('status-salvamento--erro');
      mostrarToast('Revise os campos obrigatórios antes de salvar');
      return;
    }
    if (salvarRegistro(true)) {
      statusSalvamento.textContent = 'Produto salvo';
      mostrarToast('Produto salvo');
    } else {
      mostrarToast('Não foi possível salvar. Tente novamente.');
    }
  });

  elNome.addEventListener('input', () => {
    produtoAtual().nome = elNome.value;
    validarNomeProduto();
    recalcularTudo();
  });
  elNome.addEventListener('blur', () => { nomeFoiTocado = true; validarNomeProduto(); });

  elDescricao.addEventListener('input', () => {
    produtoAtual().descricao = elDescricao.value;
    salvarRegistro();
  });

  btnAddItem.addEventListener('click', () => {
    const produto = produtoAtual();
    produto.itens.push({ id: novoId('item'), nome: '', categoria: 'Matéria-prima', qtd: '', unidade: '', qtdEmbalagem: '', valor: '' });
    renderLinhasCusto(produto);
    recalcularTudo();
    const campo = corpoTabela.querySelector('.linha-custo:last-child .input-nome-item');
    if (campo) campo.focus();
  });

  radiosModo.forEach((r) => r.addEventListener('change', () => {
    produtoAtual().modoPreco = document.querySelector('input[name="modo-preco"]:checked').value;
    const produto = produtoAtual();
    blocoMargem.hidden = produto.modoPreco !== 'margem';
    blocoPreco.hidden = produto.modoPreco !== 'preco';
    recalcularTudo();
  }));

  inputMargem.addEventListener('input', () => {
    if (inputMargem.value !== '' && Number(inputMargem.value) < 0) inputMargem.value = 0;
    produtoAtual().margem = inputMargem.value;
    validarMargem();
    recalcularTudo();
  });

  inputPrecoVenda.addEventListener('input', () => {
    if (inputPrecoVenda.value !== '' && Number(inputPrecoVenda.value) < 0) inputPrecoVenda.value = 0;
    produtoAtual().precoVenda = inputPrecoVenda.value;
    validarPreco();
    recalcularTudo();
  });

  inputEstoqueAtual.addEventListener('input', () => {
    if (inputEstoqueAtual.value !== '' && Number(inputEstoqueAtual.value) < 0) inputEstoqueAtual.value = 0;
    produtoAtual().estoqueAtual = inputEstoqueAtual.value;
    validarEstoque();
    recalcularTudo();
  });

  inputEstoqueMinimo.addEventListener('input', () => {
    if (inputEstoqueMinimo.value !== '' && Number(inputEstoqueMinimo.value) < 0) inputEstoqueMinimo.value = 0;
    produtoAtual().estoqueMinimo = inputEstoqueMinimo.value;
    validarEstoque();
    recalcularTudo();
  });

  btnExcluirProduto.addEventListener('click', () => {
    const produto = produtoAtual();
    const nome = produto.nome.trim() || 'este produto';
    if (!window.confirm(`Excluir "${nome}"? Essa ação não pode ser desfeita.`)) return;
    registro.produtos = registro.produtos.filter((p) => p.id !== produto.id);
    salvarRegistro();
    mostrarDashboard();
    mostrarToast(`"${nome}" excluído.`);
  });

  // inicializacao
  function iniciar() {
    const chaveSalva = localStorage.getItem(CHAVE_SESSAO);
    if (chaveSalva) {
      const dados = carregarRegistro(chaveSalva);
      if (dados) { abrirApp(chaveSalva, dados); return; }
    }
    viewLogin.hidden = false;
    viewApp.hidden = true;
    loginNome.focus();
  }

  iniciar();
})();
