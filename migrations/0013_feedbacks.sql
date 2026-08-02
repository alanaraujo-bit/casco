-- 0013 — Feedback: bug, melhoria e sugestão, relatados de dentro do sistema.
--
-- A pessoa relata sem sair da tela onde travou. O registro fica no banco —
-- por empresa, com RLS igual a qualquer tabela de negócio — e a aplicação
-- também avisa a Aionix fora do banco (webhook), para o relato chegar a
-- quem vai agir sem depender de alguém abrir um painel para descobrir.

create table if not exists feedbacks (
  id          uuid primary key,
  company_id  uuid not null references companies(id) on delete restrict,
  -- Sem FK "not null": quem relata pode ser um admin da Aionix operando
  -- dentro da empresa, e esse id não existe em `users` (ver
  -- `autorDoLancamento` em `src/lib/sessao.ts`). NULL aqui tem o mesmo
  -- significado que já tem em `vasilhame_movimentos.usuario_id`.
  usuario_id  uuid references users(id) on delete set null,

  tipo        text not null check (tipo in ('bug', 'melhoria', 'sugestao')),
  -- Só bug e melhoria pedem prioridade — sugestão não tem urgência por
  -- definição. NULL para sugestão, obrigatória para os outros dois.
  prioridade  text check (prioridade in ('baixa', 'media', 'alta', 'critica')),

  titulo      text not null,
  descricao   text not null,
  -- Rota onde a pessoa estava ao relatar, capturada pela tela — não digitada.
  rota        text,
  -- Código de `Falha` (src/lib/erros.ts), quando o relato nasce a partir de
  -- uma tela de erro. Sem FK: é um rótulo curto ("VAS-SINAL"), não um registro.
  codigo_erro text,

  status      text not null default 'novo'
              check (status in ('novo', 'visto', 'em_andamento', 'resolvido')),

  -- Se o aviso à Aionix (webhook) saiu no ato do relato. `false` não é erro
  -- do relato em si — o registro já está gravado e é a fonte de verdade;
  -- é só o que decide se vale reprocessar o aviso depois.
  avisado     boolean not null default false,

  criado_em   timestamptz not null default now(),

  constraint feedbacks_prioridade_por_tipo check (
    (tipo = 'sugestao' and prioridade is null) or
    (tipo <> 'sugestao' and prioridade is not null)
  )
);

create index if not exists feedbacks_company_idx on feedbacks (company_id, criado_em desc);
create index if not exists feedbacks_status_idx on feedbacks (company_id, status);

alter table feedbacks enable row level security;
alter table feedbacks force  row level security;

drop policy if exists tenant_isolation on feedbacks;
create policy tenant_isolation on feedbacks
  using (company_id = app_current_company());

comment on table feedbacks is
  'Bug, melhoria e sugestão relatados de dentro do sistema. Isolado por empresa; o aviso à Aionix sai por webhook, fora do banco.';
