-- 0002 — Privilégios do papel da aplicação.
--
-- O papel em si é criado pelo runner (scripts/migrate.mjs), porque a senha vem
-- de variável de ambiente e não pode morar num arquivo versionado. Aqui ficam
-- só os privilégios, que são públicos e devem ser revisáveis no diff.
--
-- Por que existe um papel separado: no Railway a conexão padrão é o usuário
-- `postgres`, que é SUPERUSUÁRIO — e superusuário ignora RLS por completo,
-- inclusive com FORCE. Se a aplicação conectasse com ele, as políticas de
-- isolamento existiriam, pareceriam corretas em revisão de código, e não
-- filtrariam absolutamente nada. Migration precisa de poder para criar tabela;
-- a aplicação não pode ter esse poder.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'casco_app') then
    raise exception
      'O papel casco_app não existe. Ele é criado pelo runner de migrations; '
      'verifique se APP_DB_PASSWORD está definida no ambiente.';
  end if;
end $$;

grant usage on schema public to casco_app;

grant select, insert, update, delete on companies to casco_app;
grant select, insert, update, delete on users to casco_app;
grant execute on function auth_find_user(text) to casco_app;

-- Tabelas futuras já nascem acessíveis, sem depender de alguém lembrar.
alter default privileges in schema public
  grant select, insert, update, delete on tables to casco_app;
alter default privileges in schema public
  grant usage, select on sequences to casco_app;

-- Nunca. Se a aplicação precisar de DDL, a modelagem está errada.
revoke create on schema public from casco_app;
