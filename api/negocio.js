function json(body, status = 200) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function handle(request) {
  if (request.method !== 'POST') return json({ erro: 'Método inválido.' }, 405);
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    return json({ erro: 'Origem inválida.' }, 403);
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 900_000) return json({ erro: 'O cadastro excedeu o limite de armazenamento.' }, 413);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ erro: 'Dados inválidos.' }, 400);
  }

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return json({ erro: 'A conexão com o banco ainda precisa ser configurada.' }, 503);
  const headers = { apikey: key, 'Content-Type': 'application/json' };

  if (body?.acao === 'criar-conta') {
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const senha = body.senha;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
        typeof senha !== 'string' || senha.length < 8) {
      return json({ erro: 'Informe um e-mail válido e uma senha com pelo menos 8 caracteres.' }, 400);
    }
    const response = await fetch(new URL('/auth/v1/signup', url), {
      method: 'POST', headers, body: JSON.stringify({ email, password: senha }),
    });
    if (response.status === 429) return json({ erro: 'Muitas tentativas. Aguarde e tente novamente.' }, 429);
    const result = await response.json();
    const codigo = result.error_code ?? result.code;
    if (codigo === 'signup_disabled') {
      return json({ erro: 'A criação de contas está desativada no momento.' }, 403);
    }
    if (codigo === 'weak_password') {
      return json({ erro: 'Escolha uma senha mais forte.' }, 400);
    }
    if (!response.ok && !['user_already_exists', 'email_exists'].includes(codigo)) {
      return json({ erro: 'Não foi possível criar a conta. Tente novamente mais tarde.' }, 502);
    }
    return json({
      mensagem: result.access_token
        ? 'Conta criada. Informe sua senha e clique em Entrar.'
        : 'Confira seu e-mail para confirmar a conta. Se já tiver cadastro, clique em Entrar.',
    });
  }

  if (body?.acao === 'entrar' || body?.acao === 'renovar') {
    const login = body.acao === 'entrar';
    const credentials = login ? { email: body.email, password: body.senha } : { refresh_token: body.renovacao };
    if (!Object.values(credentials).every((value) => typeof value === 'string' && value)) {
      return json({ erro: 'Preencha os dados de acesso.' }, 400);
    }
    const response = await fetch(new URL('/auth/v1/token?grant_type=' + (login ? 'password' : 'refresh_token'), url), {
      method: 'POST', headers, body: JSON.stringify(credentials),
    });
    if (response.status === 429) return json({ erro: 'Muitas tentativas. Aguarde e tente novamente.' }, 429);
    if (response.status >= 500) throw new Error('Supabase Auth indisponível');
    if (!response.ok) return json({ erro: login ? 'E-mail ou senha inválidos.' : 'Sua sessão expirou. Entre novamente.' }, 401);
    const { access_token, refresh_token } = await response.json();
    return json({ acesso: access_token, renovacao: refresh_token });
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json({ erro: 'Entre com sua conta.' }, 401);
  headers.Authorization = authorization;
  const nome = typeof body?.nome === 'string' ? body.nome.trim() : '';
  const chave = nome.toLowerCase();
  if (!nome || chave.length > 60) return json({ erro: 'Informe um nome válido.' }, 400);
  const table = new URL('/rest/v1/negocios', url);

  let response;
  if (body.acao === 'abrir') {
    table.searchParams.set('on_conflict', 'dono,chave');
    response = await fetch(table, {
      method: 'POST', headers: { ...headers, Prefer: 'resolution=ignore-duplicates' },
      body: JSON.stringify({ chave, nome }),
    });
    if (response.ok) {
      table.searchParams.delete('on_conflict');
      table.searchParams.set('chave', 'eq.' + chave);
      table.searchParams.set('select', 'nome,produtos,versao');
      response = await fetch(table, { headers });
      if (response.ok) {
        const [row] = await response.json();
        if (row) return json({ nomeExibicao: row.nome, produtos: row.produtos, versao: row.versao });
      }
    }
  } else if (body.acao === 'salvar' && Number.isInteger(body.versao) && body.versao >= 0 &&
      body.versao < 2147483647 && Array.isArray(body.produtos) && body.produtos.every((p) =>
        typeof p?.id === 'string' && typeof p.nome === 'string' &&
        Array.isArray(p.itens) && p.itens.every((item) => item && typeof item === 'object' && !Array.isArray(item)))) {
    table.searchParams.set('chave', 'eq.' + chave);
    table.searchParams.set('versao', 'eq.' + body.versao);
    table.searchParams.set('select', 'versao');
    response = await fetch(table, {
      method: 'PATCH', headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ produtos: body.produtos, versao: body.versao + 1 }),
    });
    if (response.ok) {
      const [row] = await response.json();
      return row ? json(row) : json({ erro: 'O cadastro mudou em outro dispositivo. Reabra o negócio para atualizá-lo.' }, 409);
    }
  } else {
    return json({ erro: 'Dados de produtos inválidos.' }, 400);
  }

  if (response?.status === 401) return json({ erro: 'Sua sessão expirou.' }, 401);
  throw new Error('Falha no banco (' + response?.status + ')');
}

export default {
  async fetch(request) {
    try {
      return await handle(request);
    } catch (error) {
      console.error(error.message);
      return json({ erro: 'Falha ao acessar o banco de dados. Tente novamente.' }, 500);
    }
  },
};
