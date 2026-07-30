-- 0006 — Vendas, financeiro e estoque.
--
-- As colunas saem das listagens reais do Fature Gestão levantadas na auditoria
-- (§3, "Colunas reais"). Não estamos inventando um modelo melhor: a operadora
-- lê essas telas todo dia e vai continuar lendo na mesma ordem.
--
-- Ressalva registrada: não tivemos acesso ao PDV do sistema atual ("Acesso
-- negado"). O que está aqui é o **armazenamento** de uma venda — cabeçalho,
-- itens e pagamentos — que não é controverso. O fluxo de tela do PDV continua
-- pendente de validação com o cliente antes da Etapa 3.

-- ============================================================ meios de recebimento

-- O legado guarda "Banco" e "Forma Pgto" como texto solto nas listagens. Vira
-- tabela aqui por um motivo concreto: a taxa. Cartão de débito come 1,49% e o
-- sistema deles não desconta em lugar nenhum — o dono acha que recebeu o valor
-- cheio até conciliar o extrato.
create table if not exists contas_bancarias (
  id            uuid primary key,
  company_id    uuid not null references companies(id) on delete restrict,
  nome          text not null,               -- 'Caixa Loja', 'PIX Sicoob'
  tipo          text not null default 'banco' check (tipo in ('caixa', 'banco')),
  saldo_inicial numeric(12,2) not null default 0,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists contas_bancarias_company_idx on contas_bancarias (company_id, nome);

create table if not exists formas_pagamento (
  id            uuid primary key,
  company_id    uuid not null references companies(id) on delete restrict,
  nome          text not null,               -- 'Dinheiro', 'PIX', 'Cartão Débito'
  -- `fiado` é o que separa venda recebida de venda a receber. Distribuidora vive
  -- disso: o mercadinho paga no fim do mês.
  tipo          text not null check (tipo in ('dinheiro', 'pix', 'debito', 'credito', 'boleto', 'fiado')),
  taxa_percentual numeric(6,4) not null default 0 check (taxa_percentual >= 0),
  prazo_dias    integer not null default 0 check (prazo_dias >= 0),
  conta_id      uuid references contas_bancarias(id) on delete set null,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists formas_pagamento_company_idx on formas_pagamento (company_id, nome);

-- ============================================================ vendas

create table if not exists vendas (
  id            uuid primary key,
  company_id    uuid not null references companies(id) on delete restrict,
  codigo        bigint,

  -- "Operação" na listagem deles: de onde a venda veio.
  origem        text not null default 'balcao'
                check (origem in ('balcao', 'pdv', 'entrega', 'whatsapp')),

  -- null = venda avulsa de balcão, sem cliente identificado. É o caso mais
  -- comum na loja e não pode exigir cadastro: travar a venda para cadastrar
  -- CPF é o tipo de atrito que faz a operadora voltar para o sistema antigo.
  cliente_id    uuid references clientes(id) on delete restrict,
  vendedor_id   uuid references users(id) on delete restrict,

  status        text not null default 'confirmada'
                check (status in ('orcamento', 'confirmada', 'cancelada')),

  subtotal      numeric(12,2) not null default 0,
  desconto      numeric(12,2) not null default 0 check (desconto >= 0),
  total         numeric(12,2) not null default 0,
  taxas         numeric(12,2) not null default 0 check (taxas >= 0),
  comissao      numeric(12,2) not null default 0 check (comissao >= 0),
  parcelas      integer not null default 1 check (parcelas >= 1),

  observacao    text,
  orcamento_numero bigint,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists vendas_company_idx on vendas (company_id, criado_em desc);
create index if not exists vendas_cliente_idx on vendas (company_id, cliente_id, criado_em desc);
create unique index if not exists vendas_codigo_unico on vendas (company_id, codigo);

create table if not exists venda_itens (
  id            uuid primary key,
  company_id    uuid not null references companies(id) on delete restrict,
  venda_id      uuid not null references vendas(id) on delete cascade,
  produto_id    uuid not null references produtos(id) on delete restrict,
  quantidade    numeric(12,3) not null check (quantidade > 0),
  preco_unitario numeric(12,2) not null check (preco_unitario >= 0),
  total         numeric(12,2) not null,

  -- Quantos galões vazios o cliente entregou junto com a compra. Fica no item
  -- porque é por produto: ele pode trocar 10 galões de 20L e nenhum de 10L.
  vasilhame_devolvido integer not null default 0 check (vasilhame_devolvido >= 0)
);

create index if not exists venda_itens_venda_idx on venda_itens (venda_id);
create index if not exists venda_itens_produto_idx on venda_itens (company_id, produto_id);

create table if not exists pagamentos (
  id            uuid primary key,
  company_id    uuid not null references companies(id) on delete restrict,
  venda_id      uuid references vendas(id) on delete cascade,
  forma_id      uuid references formas_pagamento(id) on delete restrict,
  conta_id      uuid references contas_bancarias(id) on delete restrict,
  valor         numeric(12,2) not null check (valor > 0),
  taxa          numeric(12,2) not null default 0 check (taxa >= 0),
  recebido_em   timestamptz not null default now()
);

create index if not exists pagamentos_company_idx on pagamentos (company_id, recebido_em desc);
create index if not exists pagamentos_venda_idx on pagamentos (venda_id);

-- ============================================================ contas a receber

-- Colunas na ordem da listagem deles: Origem · Código · Cliente · Emissão ·
-- Valor Total · Parcela · Valor Parcela · Vencimento · Recebido? · Banco ·
-- Forma Pgto · Taxas · Data Pagamento · Valor Pago.
create table if not exists contas_receber (
  id            uuid primary key,
  company_id    uuid not null references companies(id) on delete restrict,

  -- Texto e uuid soltos em vez de FK: o legado mostra "PDV" e "Venda de
  -- Produtos" como origem, e vai existir lançamento manual sem venda nenhuma.
  origem        text not null default 'manual',
  venda_id      uuid references vendas(id) on delete set null,

  codigo        bigint,
  cliente_id    uuid references clientes(id) on delete restrict,
  descricao     text,

  emissao       date not null default current_date,
  valor_total   numeric(12,2) not null check (valor_total >= 0),
  parcela_numero  integer not null default 1 check (parcela_numero >= 1),
  parcela_total   integer not null default 1 check (parcela_total >= 1),
  valor_parcela numeric(12,2) not null check (valor_parcela >= 0),
  vencimento    date not null,

  -- Situação é derivada de `pago_em` + `vencimento`, nunca digitada. No sistema
  -- deles dá para ver linha marcada "Vencido" com vencimento no mês que vem.
  pago_em       date,
  valor_pago    numeric(12,2),
  conta_id      uuid references contas_bancarias(id) on delete restrict,
  forma_id      uuid references formas_pagamento(id) on delete restrict,
  taxas         numeric(12,2) not null default 0 check (taxas >= 0),

  observacao    text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint contas_receber_parcela_valida check (parcela_numero <= parcela_total),
  -- Baixa pela metade é o estado que trava a conciliação: o relatório soma o
  -- que foi pago, mas não sabe quando. Ou tem as duas coisas, ou não tem baixa.
  constraint contas_receber_baixa_completa check (
    (pago_em is null and valor_pago is null) or
    (pago_em is not null and valor_pago is not null)
  )
);

create index if not exists contas_receber_company_idx
  on contas_receber (company_id, vencimento);
create index if not exists contas_receber_cliente_idx
  on contas_receber (company_id, cliente_id, vencimento);

-- "O que vence esta semana e ainda não entrou" — a pergunta do dono na
-- segunda-feira. Índice parcial: conta paga não interessa a essa consulta e é a
-- maior parte da tabela com o tempo.
create index if not exists contas_receber_aberto_idx
  on contas_receber (company_id, vencimento) where pago_em is null;

-- ============================================================ contas a pagar

-- Colunas deles: Parcela · Descrição · Despesa/Custos · Categoria · Tipo ·
-- Vencimento · Valor Previsto · Data Pagamento · Valor Pagamento · Status ·
-- Forma Pagamento · Saída Dinheiro · Observação.
create table if not exists contas_pagar (
  id            uuid primary key,
  company_id    uuid not null references companies(id) on delete restrict,
  codigo        bigint,
  fornecedor_id uuid references fornecedores(id) on delete restrict,
  descricao     text not null,

  -- A separação que faz o DRE fechar: custo entra no CMV, despesa entra em
  -- despesa operacional. No legado as duas linhas aparecem como `NaN`.
  natureza      text not null default 'despesa' check (natureza in ('custo', 'despesa')),
  categoria     text,

  emissao       date not null default current_date,
  parcela_numero  integer not null default 1 check (parcela_numero >= 1),
  parcela_total   integer not null default 1 check (parcela_total >= 1),
  vencimento    date not null,
  valor_previsto numeric(12,2) not null check (valor_previsto >= 0),

  pago_em       date,
  valor_pago    numeric(12,2),
  conta_id      uuid references contas_bancarias(id) on delete restrict,
  forma_id      uuid references formas_pagamento(id) on delete restrict,

  observacao    text,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint contas_pagar_parcela_valida check (parcela_numero <= parcela_total),
  constraint contas_pagar_baixa_completa check (
    (pago_em is null and valor_pago is null) or
    (pago_em is not null and valor_pago is not null)
  )
);

create index if not exists contas_pagar_company_idx on contas_pagar (company_id, vencimento);
create index if not exists contas_pagar_aberto_idx
  on contas_pagar (company_id, vencimento) where pago_em is null;

-- ============================================================ caixa

-- Só dinheiro que entrou ou saiu de fato. É o que separa este relatório do DRE.
--
-- Perda de vasilhame NÃO entra aqui, e essa ausência é deliberada: galão
-- quebrado é custo, mas nenhum real sai do caixa quando ele quebra. Ver a nota
-- na 0005 — a perda vive em `vasilhame_perdas` e aparece no DRE.
create table if not exists caixa_movimentos (
  id            uuid primary key,
  company_id    uuid not null references companies(id) on delete restrict,
  conta_id      uuid not null references contas_bancarias(id) on delete restrict,
  data          date not null default current_date,
  sentido       text not null check (sentido in ('entrada', 'saida')),
  valor         numeric(12,2) not null check (valor > 0),
  categoria     text,
  descricao     text,

  origem        text check (origem in ('venda', 'receber', 'pagar', 'manual', 'transferencia')),
  origem_id     uuid,
  usuario_id    uuid references users(id) on delete restrict,
  criado_em     timestamptz not null default now()
);

create index if not exists caixa_company_idx on caixa_movimentos (company_id, data desc);
create index if not exists caixa_conta_idx on caixa_movimentos (company_id, conta_id, data desc);

-- ============================================================ estoque

create table if not exists estoque_movimentos (
  id            uuid primary key,
  company_id    uuid not null references companies(id) on delete restrict,
  produto_id    uuid not null references produtos(id) on delete restrict,

  -- > 0 entrou no estoque, < 0 saiu. Mesma convenção de sinal do vasilhame,
  -- de propósito: duas convenções diferentes no mesmo sistema garantem que
  -- alguém vai inverter uma delas.
  quantidade    numeric(12,3) not null check (quantidade <> 0),
  tipo          text not null check (tipo in ('entrada', 'venda', 'ajuste', 'perda', 'devolucao')),
  custo_unitario numeric(12,2) not null default 0 check (custo_unitario >= 0),

  origem        text,
  origem_id     uuid,
  usuario_id    uuid references users(id) on delete restrict,
  observacao    text,
  criado_em     timestamptz not null default now()
);

create index if not exists estoque_mov_company_idx
  on estoque_movimentos (company_id, criado_em desc);
create index if not exists estoque_mov_produto_idx
  on estoque_movimentos (company_id, produto_id, criado_em desc);

create table if not exists estoque_saldos (
  company_id    uuid not null references companies(id) on delete restrict,
  produto_id    uuid not null references produtos(id) on delete cascade,
  quantidade    numeric(12,3) not null default 0,
  custo_medio   numeric(12,4) not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (produto_id)
);

create index if not exists estoque_saldos_company_idx on estoque_saldos (company_id);

-- Custo médio móvel ponderado — a coluna "Custo Médio Unit." da listagem deles.
--
-- Recalculado só na entrada: saída consome ao custo médio vigente e não deve
-- movê-lo. Recalcular na saída faria o custo subir sozinho quando o estoque
-- baixasse, e o CMV do mês sairia errado sem ninguém entender por quê.
create or replace function estoque_aplicar_saldo()
returns trigger
language plpgsql
as $$
declare
  saldo_atual numeric(12,3);
  custo_atual numeric(12,4);
  saldo_novo  numeric(12,3);
begin
  select quantidade, custo_medio into saldo_atual, custo_atual
    from estoque_saldos where produto_id = new.produto_id;

  if not found then
    saldo_atual := 0;
    custo_atual := 0;
  end if;

  saldo_novo := saldo_atual + new.quantidade;

  if new.quantidade > 0 and saldo_novo > 0 then
    -- Estoque negativo entrando no denominador daria custo médio negativo.
    custo_atual := ((greatest(saldo_atual, 0) * custo_atual)
                    + (new.quantidade * new.custo_unitario))
                   / (greatest(saldo_atual, 0) + new.quantidade);
  end if;

  insert into estoque_saldos (company_id, produto_id, quantidade, custo_medio)
       values (new.company_id, new.produto_id, saldo_novo, custo_atual)
  on conflict (produto_id) do update
     set quantidade    = saldo_novo,
         custo_medio   = custo_atual,
         atualizado_em = now();

  return new;
end;
$$;

drop trigger if exists estoque_mov_saldo on estoque_movimentos;
create trigger estoque_mov_saldo after insert on estoque_movimentos
  for each row execute function estoque_aplicar_saldo();

-- Mesma regra do vasilhame: movimento não se edita, se estorna. Função própria
-- e não a `vasilhame_mov_imutavel()` só pela mensagem — operadora que tenta
-- corrigir uma entrada de estoque precisa ler "estoque", não "vasilhame".
create or replace function estoque_mov_imutavel()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Movimento de estoque não pode ser % — lance um movimento de ajuste.',
    lower(tg_op);
end;
$$;

drop trigger if exists estoque_mov_sem_update on estoque_movimentos;
create trigger estoque_mov_sem_update before update or delete on estoque_movimentos
  for each row execute function estoque_mov_imutavel();

-- ============================================================ numeração

drop trigger if exists vendas_codigo on vendas;
create trigger vendas_codigo before insert on vendas
  for each row execute function atribuir_codigo('vendas');

drop trigger if exists contas_receber_codigo on contas_receber;
create trigger contas_receber_codigo before insert on contas_receber
  for each row execute function atribuir_codigo('contas_receber');

drop trigger if exists contas_pagar_codigo on contas_pagar;
create trigger contas_pagar_codigo before insert on contas_pagar
  for each row execute function atribuir_codigo('contas_pagar');

-- ============================================================ atualizado_em

do $$
declare t text;
begin
  foreach t in array array[
    'contas_bancarias', 'formas_pagamento', 'vendas', 'contas_receber', 'contas_pagar'
  ] loop
    execute format('drop trigger if exists %I on %I', t || '_touch', t);
    execute format(
      'create trigger %I before update on %I for each row execute function touch_atualizado_em()',
      t || '_touch', t
    );
  end loop;
end $$;

-- ============================================================ isolamento

do $$
declare t text;
begin
  foreach t in array array[
    'contas_bancarias', 'formas_pagamento', 'vendas', 'venda_itens', 'pagamentos',
    'contas_receber', 'contas_pagar', 'caixa_movimentos',
    'estoque_movimentos', 'estoque_saldos'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force  row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format(
      'create policy tenant_isolation on %I using (company_id = app_current_company())', t
    );
  end loop;
end $$;
