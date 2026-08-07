-- 0020 — Marcador de sincronização entre telas.
--
-- Uma linha por empresa, com o instante do último lançamento. As telas de
-- negócio (Painel, Estoque, Vasilhame, Financeiro, Vendas) fazem *poll* curto
-- neste marcador e chamam `router.refresh()` quando ele avança — é o que faz
-- uma venda fechada no PDV aparecer sozinha em qualquer outra aba ou
-- dispositivo aberto na mesma distribuidora, sem F5.
--
-- Não é fila de eventos nem replica o que mudou: só "algo mudou, quando".
-- Suficiente para decidir se vale re-buscar a página, e simples o bastante
-- para não precisar de LISTEN/NOTIFY (que exigiria conexão fora do pool do
-- PgBouncer) nem de WebSocket (que a Vercel serverless não sustenta).
create table if not exists company_sync (
  company_id    uuid primary key references companies(id) on delete restrict,
  atualizado_em timestamptz not null default now()
);

alter table company_sync enable row level security;
alter table company_sync force  row level security;

drop policy if exists tenant_isolation on company_sync;
create policy tenant_isolation on company_sync
  using (company_id = app_current_company());
