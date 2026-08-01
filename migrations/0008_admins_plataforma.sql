-- 0008 — Administradores da plataforma (Aionix).
--
-- Quem opera o Casco por dentro não é usuário de distribuidora nenhuma.
--
-- A tentação era gravar Alan e Rafael em `users` com um papel novo, tipo
-- 'admin'. Isso quebraria a única invariante que o sistema inteiro se apoia:
-- `users.company_id` é NOT NULL e a RLS filtra por ele. Um admin precisaria de
-- `company_id` nulo — e política de RLS com coluna anulável é exatamente o
-- buraco por onde um tenant enxerga o outro. Ou então inventaríamos uma empresa
-- fantasma "Aionix" no meio da lista de distribuidoras, que apareceria em
-- relatório e em combo pelo resto da vida.
--
-- Tabela separada, sem `company_id`, fora do modelo de tenancy. O admin não
-- "é" de uma distribuidora: ele **entra** em uma, e o que ele ganha ao entrar é
-- uma sessão de trabalho comum, com o `company_id` daquela empresa. Toda a RLS
-- continua valendo sem exceção — inclusive para nós.

create table if not exists plataforma_admins (
  id                uuid primary key,
  nome              text not null,
  email             text not null,
  senha_hash        text not null,
  -- Senha entregue pelo provisionamento, que só serve para o primeiro acesso.
  -- Enquanto for true, o sistema não deixa navegar para lugar nenhum além da
  -- tela de troca. Não é aviso amarelo pedindo para trocar: é porta fechada.
  senha_provisoria  boolean not null default true,
  ativo             boolean not null default true,
  criado_em         timestamptz not null default now(),
  ultimo_acesso_em  timestamptz
);

create unique index if not exists plataforma_admins_email_key
  on plataforma_admins (lower(email));

-- ---------------------------------------------------------------- blindagem
--
-- A tabela é invisível para a aplicação. Duas travas, pelo mesmo motivo de
-- sempre: uma sozinha falha em silêncio.
--
-- 1. `revoke` desfaz o grant que a 0002 deixou valendo para toda tabela futura
--    (`alter default privileges`). Sem isto, `plataforma_admins` nasceria
--    legível por `casco_app` só porque foi criada depois.
-- 2. RLS ligada e **nenhuma política**. Política ausente nega tudo. Se um dia
--    alguém reconceder o grant sem pensar, a leitura continua voltando vazia.
--
-- O acesso legítimo passa pelas funções `security definer` abaixo — mesma
-- porta estreita que a 0001 abriu para o login. Elas devolvem só as colunas
-- necessárias, e o `select * from plataforma_admins` de alguém distraído no
-- futuro não devolve linha nenhuma.
alter table plataforma_admins enable row level security;
alter table plataforma_admins force  row level security;
revoke all on plataforma_admins from casco_app;

-- ------------------------------------------------------------------ login
create or replace function admin_find(p_email text)
returns table (
  id                uuid,
  nome              text,
  email             text,
  senha_hash        text,
  senha_provisoria  boolean
)
language sql
security definer
set search_path = public
as $$
  select a.id, a.nome, a.email, a.senha_hash, a.senha_provisoria
    from plataforma_admins a
   where lower(a.email) = lower(p_email)
     and a.ativo
   limit 1;
$$;

-- ------------------------------------------------------- troca obrigatória
--
-- Devolve boolean e não void para que a action saiba distinguir "trocou" de
-- "esse admin não existe mais". Admin desativado enquanto a aba ficou aberta
-- não pode sair da tela de senha achando que gravou.
create or replace function admin_trocar_senha(p_id uuid, p_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  afetadas int;
begin
  update plataforma_admins
     set senha_hash = p_hash,
         senha_provisoria = false
   where id = p_id
     and ativo;
  get diagnostics afetadas = row_count;
  return afetadas = 1;
end;
$$;

create or replace function admin_registrar_acesso(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update plataforma_admins set ultimo_acesso_em = now() where id = p_id;
$$;

-- ------------------------------------------------------ lista de empresas
--
-- `companies` tem RLS por `id = app_current_company()`: fora de um tenant a
-- consulta volta vazia, que é o comportamento certo para o app e o errado para
-- o painel de admin, cujo trabalho é justamente ver todas.
--
-- `security definer` roda como dono do banco, que ignora RLS. Isso é poder de
-- verdade, e por isso a função devolve um resumo, não `select *`: nome, plano,
-- e as contagens que dizem se a distribuidora está viva. Nenhum dado de
-- operação — nada de faturamento, cliente ou lançamento. Para ver isso o admin
-- entra na empresa, e aí passa pela RLS como qualquer um.
--
-- Quem garante que só admin chama isto é a aplicação (`exigirAdmin()`), como
-- já acontece com `auth_find_user`. A função é a porta; a tranca fica um andar
-- acima, no servidor.
create or replace function admin_listar_empresas()
returns table (
  id         uuid,
  nome       text,
  documento  text,
  plano      text,
  ativo      boolean,
  criado_em  timestamptz,
  usuarios   int,
  clientes   int
)
language sql
security definer
set search_path = public
as $$
  select c.id,
         c.nome,
         c.documento,
         c.plano,
         c.ativo,
         c.criado_em,
         (select count(*)::int from users    u where u.company_id = c.id and u.ativo),
         (select count(*)::int from clientes k where k.company_id = c.id)
    from companies c
   order by c.nome;
$$;

-- Confere que a empresa existe e está ativa antes de o admin entrar nela.
-- Sem isto, o id viria de um `<form>` e viraria `company_id` de sessão sem
-- ninguém ter olhado — sessão apontando para empresa desativada ou inexistente
-- renderiza tela vazia sem explicar nada.
create or replace function admin_empresa(p_id uuid)
returns table (id uuid, nome text)
language sql
security definer
set search_path = public
as $$
  select c.id, c.nome from companies c where c.id = p_id and c.ativo;
$$;

grant execute on function admin_find(text)                to casco_app;
grant execute on function admin_trocar_senha(uuid, text)  to casco_app;
grant execute on function admin_registrar_acesso(uuid)    to casco_app;
grant execute on function admin_listar_empresas()         to casco_app;
grant execute on function admin_empresa(uuid)             to casco_app;
