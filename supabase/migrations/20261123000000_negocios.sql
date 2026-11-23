create table public.negocios (
  dono uuid not null default auth.uid() references auth.users(id) on delete cascade,
  chave text not null check (char_length(chave) between 1 and 60),
  nome text not null check (char_length(nome) between 1 and 60),
  produtos jsonb not null default '[]' check (jsonb_typeof(produtos) = 'array'),
  versao integer not null default 0 check (versao >= 0),
  primary key (dono, chave)
);

alter table public.negocios enable row level security;
revoke all on public.negocios from public, anon, authenticated;
grant select on public.negocios to authenticated;
grant insert (chave, nome) on public.negocios to authenticated;
grant update (produtos, versao) on public.negocios to authenticated;

create policy negocios_leitura on public.negocios for select to authenticated
  using (dono = (select auth.uid()));
create policy negocios_criacao on public.negocios for insert to authenticated
  with check (dono = (select auth.uid()));
create policy negocios_edicao on public.negocios for update to authenticated
  using (dono = (select auth.uid()))
  with check (dono = (select auth.uid()));
