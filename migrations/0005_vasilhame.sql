-- 0005 — Vasilhame em comodato: movimentos, saldo por cliente e custo da perda.
--
-- É o motivo pelo qual a JM está trocando de sistema. O Fature Gestão não tem
-- onde lançar galão quebrado, então a operadora registra uma venda de R$ 0,13
-- para dar baixa (auditoria §5). O faturamento vira ficção e o DRE não fecha.
--
-- Regra de ouro deste arquivo, e do produto inteiro:
--   BAIXA DE VASILHAME É EVENTO DE ESTOQUE, JAMAIS UMA VENDA.
-- Nenhuma tabela daqui referencia `vendas`, `pagamentos` ou `contas_receber`.

-- ============================================================ movimentos

-- Convenção do sinal de `quantidade`, e ela é o arquivo inteiro:
--
--   > 0  o vasilhame SAIU da empresa   (o cliente passa a dever mais)
--   < 0  o vasilhame VOLTOU à empresa  (o cliente deve menos)
--
-- Com `cliente_id`, o sinal é o efeito no saldo daquele cliente.
-- Sem `cliente_id`, é movimento interno — depósito, caminhão, fábrica.
create table if not exists vasilhame_movimentos (
  id            uuid primary key,
  company_id    uuid not null references companies(id) on delete restrict,

  -- null = movimento interno (fábrica, depósito). Não é dado faltando: é o que
  -- distingue "o cliente devolveu quebrado" de "quebrou no nosso depósito".
  cliente_id    uuid references clientes(id) on delete restrict,
  produto_id    uuid not null references produtos(id) on delete restrict,

  quantidade    integer not null check (quantidade <> 0),

  motivo        text not null check (motivo in (
                  'entregue', 'devolvido', 'quebrado', 'trincado', 'perdido',
                  'enviado_fabrica', 'retornou_fabrica', 'ajuste_inventario'
                )),

  origem        text check (origem in ('venda', 'rota', 'balcao', 'ajuste', 'inventario')),
  origem_id     uuid,

  -- Custo de reposição no momento do lançamento, congelado na linha.
  -- Congelado e não calculado na leitura de propósito: o preço do galão sobe,
  -- e um relatório de maio não pode mudar de valor porque o fornecedor
  -- reajustou em agosto.
  custo_unitario numeric(12,2) not null default 0 check (custo_unitario >= 0),

  -- Quem lançou. Baixa de patrimônio sem responsável é convite a sumiço.
  usuario_id    uuid references users(id) on delete restrict,
  observacao    text,
  criado_em     timestamptz not null default now(),

  -- Entregar, devolver e perder são sempre com um cliente: é a dívida dele que
  -- muda. Sem esta trava, uma entrega sem cliente vira galão que sumiu do
  -- controle sem ninguém dever por ele.
  constraint vasilhame_mov_exige_cliente check (
    motivo not in ('entregue', 'devolvido', 'perdido') or cliente_id is not null
  ),
  -- Fábrica é transferência interna entre locais da empresa. Cliente aqui seria
  -- o caso `BETO LEVOU PARA A FABRICA` virando dívida de um cliente chamado Beto.
  constraint vasilhame_mov_fabrica_sem_cliente check (
    motivo not in ('enviado_fabrica', 'retornou_fabrica') or cliente_id is null
  ),
  -- O sinal não é livre onde o significado é único. `entregue` com quantidade
  -- negativa é a mesma classe de erro que a venda de R$ 0,13: o dado entra, a
  -- tela mostra um número, e ninguém descobre até o inventário não bater.
  constraint vasilhame_mov_sinal_coerente check (
    case motivo
      when 'entregue'  then quantidade > 0
      when 'devolvido' then quantidade < 0
      when 'quebrado'  then quantidade < 0
      when 'trincado'  then quantidade < 0
      when 'perdido'   then quantidade < 0
      else true  -- fábrica e ajuste de inventário vão nos dois sentidos
    end
  )
);

create index if not exists vasilhame_mov_company_idx
  on vasilhame_movimentos (company_id, criado_em desc);

-- O extrato do cliente, auditável galão a galão — é a query que responde
-- "por que eu estou devendo 12 galões?" quando o cliente reclama no balcão.
create index if not exists vasilhame_mov_cliente_idx
  on vasilhame_movimentos (company_id, cliente_id, criado_em desc);

-- Relatório de perdas por motivo e período.
create index if not exists vasilhame_mov_perda_idx
  on vasilhame_movimentos (company_id, motivo, criado_em desc)
  where motivo in ('quebrado', 'trincado', 'perdido');

comment on table vasilhame_movimentos is
  'Razão do comodato de vasilhame. Nunca gera receita — perda aqui é custo.';

-- ============================================================ saldo por cliente

-- Derivado dos movimentos, materializado por trigger.
--
-- Materializado porque "quem está devendo galão" é a pergunta mais frequente do
-- balcão, e somar o histórico inteiro a cada consulta fica caro depois de um ano.
-- Por trigger e não pela aplicação porque saldo mantido em código descola do
-- histórico no primeiro caminho de erro — e aí ninguém mais confia no número.
--
-- Só clientes. O estoque interno (depósito, fábrica) é agregado direto dos
-- movimentos na leitura: são poucas linhas por produto, e sempre exato.
create table if not exists vasilhame_saldos (
  company_id    uuid not null references companies(id) on delete restrict,
  cliente_id    uuid not null references clientes(id) on delete cascade,
  produto_id    uuid not null references produtos(id) on delete restrict,
  quantidade    integer not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (cliente_id, produto_id)
);

create index if not exists vasilhame_saldos_company_idx
  on vasilhame_saldos (company_id, produto_id);

-- Quem está devendo, ordenado pelo que dói mais. Índice parcial: saldo zerado é
-- a maioria das linhas e não interessa a essa pergunta.
create index if not exists vasilhame_saldos_devendo_idx
  on vasilhame_saldos (company_id, quantidade desc) where quantidade <> 0;

create or replace function vasilhame_aplicar_saldo()
returns trigger
language plpgsql
as $$
begin
  -- Movimento interno não mexe em saldo de cliente.
  if new.cliente_id is null then
    return new;
  end if;

  insert into vasilhame_saldos (company_id, cliente_id, produto_id, quantidade)
       values (new.company_id, new.cliente_id, new.produto_id, new.quantidade)
  on conflict (cliente_id, produto_id) do update
     set quantidade    = vasilhame_saldos.quantidade + excluded.quantidade,
         atualizado_em = now();

  return new;
end;
$$;

drop trigger if exists vasilhame_mov_saldo on vasilhame_movimentos;
create trigger vasilhame_mov_saldo after insert on vasilhame_movimentos
  for each row execute function vasilhame_aplicar_saldo();

-- Movimento é lançamento contábil: não se edita nem se apaga, se estorna com um
-- movimento contrário. Sem isso o saldo materializado sairia do lugar em
-- silêncio, e o extrato deixaria de explicar o número que ele mesmo mostra.
create or replace function vasilhame_mov_imutavel()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Movimento de vasilhame não pode ser % — lance um movimento de estorno.',
    lower(tg_op);
end;
$$;

drop trigger if exists vasilhame_mov_sem_update on vasilhame_movimentos;
create trigger vasilhame_mov_sem_update before update or delete on vasilhame_movimentos
  for each row execute function vasilhame_mov_imutavel();

-- ============================================================ perda como custo
--
-- **Divergência consciente do `docs/02-modelo-de-dados.md`.**
--
-- O modelo previa lançar a perda em `caixa_movimentos`, como saída na categoria
-- "Perda de vasilhame". Não vamos fazer isso: quando um galão quebra, nenhum
-- dinheiro sai do caixa. Jogar a perda no fluxo de caixa erraria o saldo do dia
-- exatamente como a venda de R$ 0,13 erra o faturamento — trocaríamos um número
-- falso por outro.
--
-- Perda é custo não-caixa. Ela aparece no DRE, lida daqui pelo `motivo`, com o
-- custo já congelado na linha. Uma fonte, auditável galão a galão, sem
-- duplicação para sair de sincronia.
create or replace view vasilhame_perdas as
  select company_id,
         date_trunc('month', criado_em) as mes,
         motivo,
         sum(-quantidade)                  as unidades,
         sum(-quantidade * custo_unitario) as custo
    from vasilhame_movimentos
   where motivo in ('quebrado', 'trincado', 'perdido')
   group by company_id, date_trunc('month', criado_em), motivo;

comment on view vasilhame_perdas is
  'Perda de vasilhame como custo não-caixa, para o DRE. Nunca toca o fluxo de caixa.';

-- ============================================================ isolamento

do $$
declare t text;
begin
  foreach t in array array['vasilhame_movimentos', 'vasilhame_saldos'] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force  row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format(
      'create policy tenant_isolation on %I using (company_id = app_current_company())', t
    );
  end loop;
end $$;

-- A view herda a RLS das tabelas que lê, porque roda com os privilégios de quem
-- consulta (`security_invoker`). Sem isso ela seria uma porta lateral: um select
-- na view devolveria a perda de todas as distribuidoras.
alter view vasilhame_perdas set (security_invoker = true);

grant select on vasilhame_perdas to casco_app;
