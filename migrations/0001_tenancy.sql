-- 0001 — Fundação de tenancy: empresas, usuários e o isolamento por RLS.
--
-- Este arquivo é a peça mais importante do sistema em termos de segurança.
-- Se o isolamento falhar aqui, uma distribuidora vê o faturamento da outra.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- empresas
create table if not exists companies (
  id          uuid primary key,
  nome        text not null,
  documento   text,
  telefone    text,
  plano       text not null default 'basico',
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- ---------------------------------------------------------------- usuários
create table if not exists users (
  id          uuid primary key,
  company_id  uuid not null references companies(id) on delete restrict,
  nome        text not null,
  email       text not null,
  senha_hash  text not null,
  papel       text not null check (papel in ('dono', 'operador', 'entregador')),
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- E-mail é global, não por empresa: é a chave de login e precisa ser única
-- no sistema inteiro, senão dois tenants criam o mesmo login e a autenticação
-- fica ambígua.
create unique index if not exists users_email_key on users (lower(email));
create index if not exists users_company_idx on users (company_id);

-- ------------------------------------------------------------- isolamento
-- `force` é obrigatório e não opcional: sem ele, o dono da tabela (que é
-- justamente o usuário que a Railway entrega) ignora RLS silenciosamente.
-- A política existiria, pareceria correta, e não filtraria nada.
alter table companies enable row level security;
alter table companies force  row level security;
alter table users     enable row level security;
alter table users     force  row level security;

drop policy if exists tenant_isolation on companies;
create policy tenant_isolation on companies
  using (id = current_setting('app.company_id', true)::uuid);

drop policy if exists tenant_isolation on users;
create policy tenant_isolation on users
  using (company_id = current_setting('app.company_id', true)::uuid);

-- Quando `app.company_id` não está definido, `current_setting(..., true)`
-- devolve null, a comparação vira null, e a política nega tudo.
-- Ou seja: query sem tenant definido não retorna linha nenhuma. É o padrão
-- seguro — falha fechada, não aberta.

-- ------------------------------------------------------- login (exceção)
-- O login é o único momento em que precisamos ler `users` sem saber ainda a
-- qual empresa o usuário pertence — é justamente isso que estamos descobrindo.
-- Em vez de afrouxar a política, abrimos uma porta estreita e explícita:
-- uma função `security definer` que devolve só o necessário para autenticar,
-- e nada mais.
create or replace function auth_find_user(p_email text)
returns table (
  id          uuid,
  company_id  uuid,
  nome        text,
  email       text,
  senha_hash  text,
  papel       text,
  ativo       boolean
)
language sql
security definer
set search_path = public
as $$
  select u.id, u.company_id, u.nome, u.email, u.senha_hash, u.papel, u.ativo
    from users u
   where lower(u.email) = lower(p_email)
     and u.ativo
     and exists (select 1 from companies c where c.id = u.company_id and c.ativo)
   limit 1;
$$;
