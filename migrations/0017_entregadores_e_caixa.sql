-- 0017 — Entregador na venda, e abertura de caixa com fundo de troco.
--
-- Duas features sem precedente no legado (Fature Gestão) nem vocabulário a
-- herdar — ver docs/00-auditoria-sistema-legado.md.

-- ============================================================ entregadores

-- Cadastro simples, sem login: quem entrega hoje é o nome que o dono passa no
-- balcão, não uma conta de acesso. `users.papel = 'entregador'` já existe no
-- schema, mas é o login do futuro app de campo (Etapa 7, adiada) — exigir
-- e-mail e senha para só marcar quem levou a água nesta venda seria atrito
-- que a distribuidora não pediu.
create table if not exists entregadores (
  id            uuid primary key,
  company_id    uuid not null references companies(id) on delete restrict,
  codigo        bigint,
  nome          text not null,
  telefone      text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists entregadores_company_idx on entregadores (company_id, nome);
create unique index if not exists entregadores_codigo_unico on entregadores (company_id, codigo);

drop trigger if exists entregadores_codigo on entregadores;
create trigger entregadores_codigo before insert on entregadores
  for each row execute function atribuir_codigo('entregadores');

drop trigger if exists entregadores_touch on entregadores;
create trigger entregadores_touch before update on entregadores
  for each row execute function touch_atualizado_em();

-- ============================================================ entregador na venda

-- Ao lado de vendedor_id: quem vendeu e quem entregou nem sempre são a mesma
-- pessoa no balcão. Opcional — nem toda venda tem entrega, e exigir aqui
-- travaria a venda avulsa por um dado que às vezes não existe.
alter table vendas add column if not exists entregador_id uuid references entregadores(id) on delete restrict;

-- ============================================================ abertura de caixa

-- Só o registro do que a operadora contou ao abrir o turno — não trava o PDV.
-- `fundo_troco` é sempre um recorte do `valor_abertura`, nunca um valor à
-- parte: não dá para reservar para troco mais dinheiro do que se tem na mão.
create table if not exists caixa_aberturas (
  id             uuid primary key,
  company_id     uuid not null references companies(id) on delete restrict,
  conta_id       uuid not null references contas_bancarias(id) on delete restrict,
  valor_abertura numeric(12,2) not null default 0 check (valor_abertura >= 0),
  fundo_troco    numeric(12,2) not null default 0 check (fundo_troco >= 0),
  observacao     text,
  usuario_id     uuid references users(id) on delete restrict,
  aberta_em      timestamptz not null default now(),

  constraint caixa_aberturas_troco_no_limite check (fundo_troco <= valor_abertura)
);

create index if not exists caixa_aberturas_company_idx on caixa_aberturas (company_id, aberta_em desc);
create index if not exists caixa_aberturas_conta_idx on caixa_aberturas (company_id, conta_id, aberta_em desc);

-- ============================================================ isolamento

do $$
declare t text;
begin
  foreach t in array array['entregadores', 'caixa_aberturas'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force  row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format(
      'create policy tenant_isolation on %I using (company_id = app_current_company())', t
    );
  end loop;
end $$;
