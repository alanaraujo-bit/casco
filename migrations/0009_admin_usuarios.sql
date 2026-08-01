-- 0009 — Gestão de acessos das distribuidoras pelo painel da Aionix.
--
-- Até aqui, criar o login do dono era `npm run empresa:criar`: script, terminal,
-- e a empresa nascia junto com um usuário. Isso amarra duas coisas que não têm
-- o mesmo ciclo de vida — a distribuidora é criada uma vez, os acessos mudam
-- sempre que alguém entra ou sai do balcão — e obriga um desenvolvedor com a
-- URL do banco na mão para cada troca de funcionário.
--
-- Quem cria acesso continua sendo só a Aionix. O que muda é o lugar: sai do
-- terminal, entra no painel. Não existe tela de "convidar usuário" do lado da
-- distribuidora, e isso é decisão, não etapa faltando — o dono que cria login
-- sozinho é o mesmo que liga dizendo que o sistema deixou o entregador ver o
-- faturamento.
--
-- Mesmo desenho da 0008: `users` tem RLS por tenant e o painel não está dentro
-- de tenant nenhum, então o acesso vai por função `security definer`, que roda
-- como dono do banco e ignora a RLS. Duas consequências que moldam tudo abaixo:
--
-- 1. **Toda função recebe `p_company` e filtra por ele.** O id do usuário vem
--    de um `<form>`, logo é entrada hostil. Sem esse filtro, um id trocado na
--    mão desativaria o dono de outra distribuidora — a RLS, que normalmente
--    pegaria isso, está justamente desligada aqui dentro.
-- 2. **Nenhuma delas devolve `senha_hash`.** A listagem é para a tela; hash não
--    tem por que trafegar até o servidor de aplicação, muito menos até o React.
--
-- Quem garante que só admin chama isto é a aplicação (`exigirAdmin()`), como já
-- vale para `admin_listar_empresas`. A função é a porta; a tranca fica um andar
-- acima.

-- --------------------------------------------------------------- listagem
create or replace function admin_listar_usuarios(p_company uuid)
returns table (
  id         uuid,
  nome       text,
  email      text,
  papel      text,
  ativo      boolean,
  criado_em  timestamptz
)
language sql
security definer
set search_path = public
as $$
  select u.id, u.nome, u.email, u.papel, u.ativo, u.criado_em
    from users u
   where u.company_id = p_company
   -- Ativos primeiro, e dentro de cada grupo o mais novo por último: a tela é
   -- lida de cima para baixo procurando quem ainda entra no sistema.
   order by u.ativo desc, u.criado_em;
$$;

-- ---------------------------------------------------------------- criação
--
-- Devolve um código de resultado em vez de estourar exceção. A action precisa
-- transformar "e-mail repetido" num erro embaixo do campo de e-mail, e ler isso
-- de uma mensagem de constraint é frágil — o texto muda com a versão do
-- Postgres e com o idioma do servidor.
--
--   'ok'       criado
--   'empresa'  a distribuidora não existe ou está desativada
--   'email'    o e-mail já é login de alguém, aqui ou em outra empresa
--
-- Sobre 'email' não dizer de quem é: o índice `users_email_key` é global, então
-- o conflito pode ser com usuário de outra distribuidora. Um admin da Aionix
-- teria direito de ver isso, mas a função não é o lugar de decidir — ela
-- responde a mesma coisa nos dois casos e a tela fala em "já está em uso".
create or replace function admin_criar_usuario(
  p_id       uuid,
  p_company  uuid,
  p_nome     text,
  p_email    text,
  p_hash     text,
  p_papel    text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from companies c where c.id = p_company and c.ativo) then
    return 'empresa';
  end if;

  if exists (select 1 from users u where lower(u.email) = lower(p_email)) then
    return 'email';
  end if;

  insert into users (id, company_id, nome, email, senha_hash, papel)
       values (p_id, p_company, p_nome, lower(p_email), p_hash, p_papel);

  return 'ok';
exception
  -- Duas criações no mesmo instante passam as duas pelo `exists` acima e uma
  -- delas bate no índice. Cai aqui e vira o mesmo 'email' de sempre, em vez de
  -- um 500 na cara do admin.
  when unique_violation then
    return 'email';
end;
$$;

-- ------------------------------------------------------ desativar / reativar
--
-- Desativa, não apaga. `vendas.vendedor_id` e os movimentos de vasilhame
-- referenciam `users` com `on delete restrict`: apagar quem já vendeu é
-- impossível por construção, e é a construção certa — extrato sem autor é
-- extrato que ninguém consegue auditar depois.
create or replace function admin_definir_ativo(p_id uuid, p_company uuid, p_ativo boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  afetadas int;
begin
  update users
     set ativo = p_ativo
   where id = p_id
     and company_id = p_company;
  get diagnostics afetadas = row_count;
  return afetadas = 1;
end;
$$;

-- ------------------------------------------------------------ redefinir senha
--
-- O caminho de "esqueci minha senha" enquanto não existe recuperação por
-- e-mail: a operadora liga, o admin define uma nova e repassa.
create or replace function admin_redefinir_senha(p_id uuid, p_company uuid, p_hash text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  afetadas int;
begin
  update users
     set senha_hash = p_hash
   where id = p_id
     and company_id = p_company;
  get diagnostics afetadas = row_count;
  return afetadas = 1;
end;
$$;

grant execute on function admin_listar_usuarios(uuid)                           to casco_app;
grant execute on function admin_criar_usuario(uuid, uuid, text, text, text, text) to casco_app;
grant execute on function admin_definir_ativo(uuid, uuid, boolean)              to casco_app;
grant execute on function admin_redefinir_senha(uuid, uuid, text)               to casco_app;
