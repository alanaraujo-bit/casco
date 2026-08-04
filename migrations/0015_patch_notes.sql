-- 0015 — Patch Notes: o que mudou no Casco, para quem usa.
--
-- Conteúdo do produto, não de uma distribuidora — toda empresa que usa o Casco
-- lê a mesma novidade. Mesmo desenho de `plataforma_admins`/`plataforma_config`
-- (0008/0014) pelo mesmo motivo: sem `company_id`, RLS ligada e sem nenhuma
-- política (nega tudo a `casco_app`), acesso só pelas funções `security
-- definer` abaixo. Isto vale inclusive para a leitura pública — não existe
-- usuário "sem tenant" lendo direto a tabela; mesmo quem só quer ver o que foi
-- publicado passa pela função.
--
-- Quem reagiu e quem já leu, ao contrário, é dado por empresa — cada login é
-- de uma distribuidora, e uma reação pertence a quem clicou. Essas duas ficam
-- no molde comum de tabela de negócio (`feedbacks`, 0013): `company_id not
-- null`, política `tenant_isolation`.

create table if not exists patch_notes (
  id              uuid primary key,
  slug            text not null,
  titulo          text not null,
  resumo          text not null,
  corpo           text not null,
  categoria       text not null
                  check (categoria in ('novo', 'melhoria', 'correcao', 'desempenho', 'seguranca', 'interface')),
  status          text not null default 'rascunho'
                  check (status in ('rascunho', 'publicado', 'arquivado')),
  -- Hashes curtos, só rastro de auditoria — não é FK, o commit pode não
  -- existir mais localmente (squash, rebase) sem que isso invalide a nota.
  commits_origem  text[] not null default '{}',
  publicado_em    timestamptz,
  criado_por      uuid references plataforma_admins(id),
  aprovado_por    uuid references plataforma_admins(id),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now()
);

create unique index if not exists patch_notes_slug_key on patch_notes (slug);

-- É a query mais comum (lista pública, mais recente primeiro) e o índice
-- parcial evita indexar rascunho, que nunca é lido por este caminho.
create index if not exists patch_notes_publicados_idx
  on patch_notes (publicado_em desc)
  where status = 'publicado';

alter table patch_notes enable row level security;
alter table patch_notes force  row level security;
revoke all on patch_notes from casco_app;

create table if not exists patch_notes_reacoes (
  id             uuid primary key,
  company_id     uuid not null references companies(id) on delete restrict,
  patch_note_id  uuid not null references patch_notes(id) on delete cascade,
  usuario_id     uuid not null references users(id) on delete cascade,
  tipo           text not null check (tipo in ('like', 'dislike')),
  criado_em      timestamptz not null default now(),
  unique (patch_note_id, usuario_id)
);

create index if not exists patch_notes_reacoes_nota_idx on patch_notes_reacoes (patch_note_id);

alter table patch_notes_reacoes enable row level security;
alter table patch_notes_reacoes force  row level security;

drop policy if exists tenant_isolation on patch_notes_reacoes;
create policy tenant_isolation on patch_notes_reacoes
  using (company_id = app_current_company());

create table if not exists patch_notes_leituras (
  id             uuid primary key,
  company_id     uuid not null references companies(id) on delete restrict,
  patch_note_id  uuid not null references patch_notes(id) on delete cascade,
  usuario_id     uuid not null references users(id) on delete cascade,
  lido_em        timestamptz not null default now(),
  unique (patch_note_id, usuario_id)
);

create index if not exists patch_notes_leituras_usuario_idx on patch_notes_leituras (company_id, usuario_id);

alter table patch_notes_leituras enable row level security;
alter table patch_notes_leituras force  row level security;

drop policy if exists tenant_isolation on patch_notes_leituras;
create policy tenant_isolation on patch_notes_leituras
  using (company_id = app_current_company());

comment on table patch_notes is
  'Novidades do Casco, para todo cliente. Fora do modelo de tenancy; acesso só pelas funções security definer.';
comment on table patch_notes_reacoes is
  'Curtir/não curtir uma novidade, por usuário. Isolado por empresa.';
comment on table patch_notes_leituras is
  '"Visto" por usuário — sustenta o contador de não lidos. Isolado por empresa.';

-- ------------------------------------------------------------ leitura pública
--
-- Qualquer usuário autenticado (dono, operador, entregador) lê o que está
-- publicado. Não devolve `criado_por`/`aprovado_por`/`commits_origem` — rastro
-- de quem escreveu e de onde veio não é da conta de quem só quer saber o que
-- mudou.
create or replace function patch_notes_listar_publicados()
returns table (
  id            uuid,
  slug          text,
  titulo        text,
  resumo        text,
  corpo         text,
  categoria     text,
  publicado_em  timestamptz
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.slug, p.titulo, p.resumo, p.corpo, p.categoria, p.publicado_em
    from patch_notes p
   where p.status = 'publicado'
   order by p.publicado_em desc;
$$;

-- ------------------------------------------------------------ contador de não lidos
--
-- Cruza a tabela global (patch_notes) com a por-tenant (patch_notes_leituras).
-- `security definer` roda como dono, que ignora RLS — por isso o filtro por
-- empresa e usuário é explícito nos parâmetros, e não delegado à política de
-- `patch_notes_leituras` como aconteceria numa consulta comum da aplicação.
create or replace function patch_notes_contar_nao_lidos(p_company_id uuid, p_usuario_id uuid)
returns int
language sql
security definer
set search_path = public
as $$
  select count(*)::int
    from patch_notes p
   where p.status = 'publicado'
     and not exists (
       select 1 from patch_notes_leituras l
        where l.patch_note_id = p.id
          and l.company_id = p_company_id
          and l.usuario_id = p_usuario_id
     );
$$;

-- ------------------------------------------------------------------ administração
--
-- Quem garante que só admin chama estas quatro é a aplicação (`exigirAdmin()`),
-- o mesmo desenho já aceito em `admin_listar_empresas()` (0008): a função é a
-- porta, a tranca fica um andar acima, no servidor.

create or replace function patch_notes_admin_listar()
returns setof patch_notes
language sql
security definer
set search_path = public
as $$
  select * from patch_notes order by atualizado_em desc;
$$;

create or replace function patch_notes_admin_criar(
  p_id uuid,
  p_slug text,
  p_titulo text,
  p_resumo text,
  p_corpo text,
  p_categoria text,
  p_commits_origem text[],
  p_admin_id uuid
)
returns uuid
language sql
security definer
set search_path = public
as $$
  insert into patch_notes (id, slug, titulo, resumo, corpo, categoria, commits_origem, criado_por)
  values (p_id, p_slug, p_titulo, p_resumo, p_corpo, p_categoria, coalesce(p_commits_origem, '{}'), p_admin_id)
  returning id;
$$;

create or replace function patch_notes_admin_atualizar(
  p_id uuid,
  p_titulo text,
  p_resumo text,
  p_corpo text,
  p_categoria text,
  p_commits_origem text[]
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  afetadas int;
begin
  update patch_notes
     set titulo = p_titulo,
         resumo = p_resumo,
         corpo = p_corpo,
         categoria = p_categoria,
         commits_origem = coalesce(p_commits_origem, '{}'),
         atualizado_em = now()
   where id = p_id;
  get diagnostics afetadas = row_count;
  return afetadas = 1;
end;
$$;

-- `rascunho -> publicado` grava `publicado_em` e `aprovado_por` na mesma
-- chamada. `publicado -> arquivado` some da lista pública sem apagar a linha
-- (rastro de auditoria, e dá para reverter). A transição inválida (ex.
-- arquivado -> publicado) não é bloqueada aqui — quem decide o que é válido é
-- a Server Action, para a regra ficar num lugar só; a função só grava o que
-- mandarem.
create or replace function patch_notes_admin_mudar_status(p_id uuid, p_status text, p_admin_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  afetadas int;
begin
  update patch_notes
     set status = p_status,
         publicado_em = case when p_status = 'publicado' then now() else publicado_em end,
         aprovado_por = case when p_status = 'publicado' then p_admin_id else aprovado_por end,
         atualizado_em = now()
   where id = p_id;
  get diagnostics afetadas = row_count;
  return afetadas = 1;
end;
$$;

grant execute on function patch_notes_listar_publicados()                                      to casco_app;
grant execute on function patch_notes_contar_nao_lidos(uuid, uuid)                              to casco_app;
grant execute on function patch_notes_admin_listar()                                            to casco_app;
grant execute on function patch_notes_admin_criar(uuid, text, text, text, text, text, text[], uuid) to casco_app;
grant execute on function patch_notes_admin_atualizar(uuid, text, text, text, text, text[])     to casco_app;
grant execute on function patch_notes_admin_mudar_status(uuid, text, uuid)                       to casco_app;
