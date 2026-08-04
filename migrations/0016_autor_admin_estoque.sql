-- 0016 — Autor de suporte visível no extrato de estoque.
--
-- `autorDoLancamento` (src/lib/sessao.ts) grava `usuario_id = null` quando
-- quem lançou foi suporte Aionix pelo "Acesso" — sessão sem linha em `users`.
-- Era um trade-off consciente e documentado ali: o extrato perdia o nome de
-- quem lançou, e a correção ficava para quando o suporte passasse a lançar
-- com frequência. Chegou a hora.
--
-- A saída não é inventar uma linha em `users` para o admin — isso colocaria a
-- Aionix na lista de usuários da distribuidora, com senha e papel, só para
-- resolver auditoria. A saída é uma coluna paralela, e uma função própria
-- para ler o nome: `plataforma_admins` tem RLS sem política e nenhum grant
-- para `casco_app` (ver 0008), de propósito — um join direto do papel da
-- aplicação voltaria sempre vazio, e a tela mostraria "—" para sempre,
-- silenciosamente.

alter table estoque_movimentos
  add column if not exists admin_id              uuid references plataforma_admins(id),
  add column if not exists excluido_por_admin_id  uuid references plataforma_admins(id);

comment on column estoque_movimentos.admin_id is
  'Preenchido quando quem lançou foi suporte Aionix (sessão sem usuario_id). Nunca junto com usuario_id.';
comment on column estoque_movimentos.excluido_por_admin_id is
  'Mesma ideia de admin_id, para quem excluiu a linha pela tela — paralelo a excluido_por.';

-- A mesma porta estreita da 0008: função security definer que devolve só
-- id e nome, para um conjunto de ids. Em lote, e não um id por vez, porque a
-- listagem de movimentos resolve o nome de uma página inteira numa consulta
-- só, não uma por linha.
create or replace function admin_nomes(p_ids uuid[])
returns table (id uuid, nome text)
language sql
security definer
set search_path = public
as $$
  select a.id, a.nome from plataforma_admins a where a.id = any(p_ids);
$$;

grant execute on function admin_nomes(uuid[]) to casco_app;
