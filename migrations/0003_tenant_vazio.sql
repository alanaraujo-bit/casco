-- 0003 — Correção do isolamento: `app.company_id` vazio precisa negar, não explodir.
--
-- A 0001 assumiu que `current_setting('app.company_id', true)` devolve NULL
-- quando o tenant não foi definido, e que a comparação viraria NULL e negaria
-- tudo. A prova de isolamento do build mostrou que não é bem assim:
--
--     invalid input syntax for type uuid: ""
--
-- O Postgres devolve NULL só enquanto o parâmetro nunca existiu na sessão.
-- Depois do primeiro `set_config(..., true)`, o placeholder passa a existir; ao
-- fim da transação ele não some, volta para **string vazia**. E `''::uuid`
-- levanta exceção.
--
-- Na prática isso é pior do que parece: em produção as conexões são reusadas.
-- A primeira requisição da conexão funcionaria e as seguintes quebrariam fora
-- de transação — um erro que não aparece em teste e aparece com carga.
--
-- Correção: `nullif(..., '')` antes do cast, encapsulado numa função para que
-- as ~15 tabelas de negócio que ainda vão nascer não repitam a expressão (nem
-- o erro).

create or replace function app_current_company()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.company_id', true), '')::uuid;
$$;

comment on function app_current_company() is
  'Tenant da transação atual, ou NULL se não definido. Toda política de RLS usa esta função.';

drop policy if exists tenant_isolation on companies;
create policy tenant_isolation on companies
  using (id = app_current_company());

drop policy if exists tenant_isolation on users;
create policy tenant_isolation on users
  using (company_id = app_current_company());

-- Sem tenant, `app_current_company()` é NULL, a comparação é NULL, a política
-- nega. Falha fechada — agora de verdade, e provado a cada deploy.
