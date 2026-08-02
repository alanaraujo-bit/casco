-- 0014 — Configuração da plataforma: hoje só o webhook de feedback do Discord.
--
-- Mesmo desenho da 0008 para `plataforma_admins`, pelo mesmo motivo: isto não é
-- dado de uma distribuidora, é dado de quem opera o Casco. RLS ligada e sem
-- política nega tudo a `casco_app`; o acesso passa pelas funções abaixo,
-- `security definer`, a mesma porta estreita do login e da lista de empresas.
--
-- Linha única, garantida pelo truque do `id boolean` com `check (id)`: só existe
-- `true` como chave possível, então só pode existir uma linha. Editar é sempre
-- `update`, nunca `insert` — não tem "qual configuração" para escolher errado.

create table if not exists plataforma_config (
  id                        boolean primary key default true,
  discord_webhook_feedback  text,
  atualizado_em             timestamptz not null default now(),
  constraint plataforma_config_singleton check (id)
);

insert into plataforma_config (id) values (true) on conflict (id) do nothing;

alter table plataforma_config enable row level security;
alter table plataforma_config force  row level security;
revoke all on plataforma_config from casco_app;

create or replace function plataforma_config_ler()
returns table (discord_webhook_feedback text)
language sql
security definer
set search_path = public
as $$
  select discord_webhook_feedback from plataforma_config where id;
$$;

-- `null` limpa a configuração — é assim que se desliga o aviso no Discord sem
-- apagar a linha nem inventar um segundo estado para "vazio".
create or replace function plataforma_config_salvar(p_discord_webhook_feedback text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update plataforma_config
     set discord_webhook_feedback = nullif(trim(p_discord_webhook_feedback), ''),
         atualizado_em = now()
   where id;
end;
$$;

grant execute on function plataforma_config_ler()      to casco_app;
grant execute on function plataforma_config_salvar(text) to casco_app;

comment on table plataforma_config is
  'Configuração da plataforma Aionix, fora do modelo de tenancy. Linha única; acesso só pelas funções security definer.';
