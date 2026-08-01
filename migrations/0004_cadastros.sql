-- 0004 — Cadastros: clientes, produtos, fornecedores e tabelas de preço.
--
-- Primeira migration de negócio. Além das tabelas, ela instala duas peças que
-- todas as etapas seguintes reusam — numeração por empresa e `atualizado_em`
-- automático — para que vendas, contas e movimentos não reinventem cada uma.

-- ============================================================ peças comuns

-- ------------------------------------------------------------- numeração
-- O usuário da JM lê o cliente como `0002 - DANIEL`, e vai continuar lendo.
-- Um `uuid` é a chave real; o `codigo` é o que ele fala no telefone.
--
-- Sequence do Postgres não serve: ela é global, e o cliente nº 1 de cada
-- distribuidora precisa ser o nº 1 dela — não o 4.812 porque outro tenant
-- cadastrou antes. Daí um contador por (empresa, entidade).
create table if not exists sequencias (
  company_id  uuid not null references companies(id) on delete restrict,
  nome        text not null,
  valor       bigint not null default 0,
  primary key (company_id, nome)
);

-- `on conflict do update ... returning` resolve a corrida sem lock explícito:
-- o Postgres serializa as escritas na mesma linha, e cada chamador enxerga o
-- próprio incremento. Duas operadoras cadastrando ao mesmo tempo não colidem.
create or replace function proximo_codigo(p_company_id uuid, p_nome text)
returns bigint
language sql
as $$
  insert into sequencias (company_id, nome, valor)
       values (p_company_id, p_nome, 1)
  on conflict (company_id, nome)
    do update set valor = sequencias.valor + 1
    returning valor;
$$;

comment on function proximo_codigo(uuid, text) is
  'Próximo código sequencial da entidade dentro da empresa. Atômico.';

-- --------------------------------------------------------- atualizado_em
-- Em trigger e não em `default`: `default` só vale no insert, e o que interessa
-- é justamente saber quando a linha mudou pela última vez.
create or replace function touch_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

-- ============================================================ tabelas de preço

-- Revenda, mercadinho e consumidor final pagam preços diferentes pelo mesmo
-- galão. O sistema antigo força um preço só — a operadora corrige na mão, a
-- cada venda, e erra. Por isso o preço é do cliente, não do produto.
create table if not exists tabelas_preco (
  id            uuid primary key,
  company_id    uuid not null references companies(id) on delete restrict,
  nome          text not null,
  padrao        boolean not null default false,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists tabelas_preco_company_idx on tabelas_preco (company_id, nome);

-- Uma tabela padrão por empresa, garantido pelo banco. Sem isso, um cliente sem
-- tabela definida pode cair em duas regras diferentes conforme a ordem da query.
create unique index if not exists tabelas_preco_padrao_unica
  on tabelas_preco (company_id) where padrao;

-- ============================================================ produtos

create table if not exists produtos (
  id            uuid primary key,
  company_id    uuid not null references companies(id) on delete restrict,
  codigo        bigint,
  nome          text not null,
  sku           text,
  categoria     text,
  unidade       text not null default 'un',
  preco_padrao  numeric(12,2) not null default 0,
  custo         numeric(12,2) not null default 0,

  -- O coração do negócio, e o que o legado não tem.
  -- `retornavel` marca o produto vendido (Água 20L); `vasilhame_id` aponta para
  -- o galão vazio correspondente, que é o item de comodato que precisa voltar.
  retornavel    boolean not null default false,
  vasilhame_id  uuid references produtos(id) on delete set null,

  controla_estoque boolean not null default true,
  estoque_minimo   numeric(12,3) not null default 0,
  estoque_maximo   numeric(12,3) not null default 0,
  ncm           text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  -- Produto que se aponta como o próprio vasilhame gera saldo circular no
  -- comodato: entregar 1 galão passaria a dever 1 galão de si mesmo.
  constraint produtos_vasilhame_nao_circular check (vasilhame_id is distinct from id),
  -- Retornável sem vasilhame apontado é o estado que faz a baixa de galão não
  -- ter onde cair — exatamente o buraco que estamos consertando.
  constraint produtos_retornavel_tem_vasilhame
    check (not retornavel or vasilhame_id is not null)
);

create index if not exists produtos_company_idx on produtos (company_id, nome);
create unique index if not exists produtos_codigo_unico on produtos (company_id, codigo);
create unique index if not exists produtos_sku_unico
  on produtos (company_id, lower(sku)) where sku is not null;

-- ============================================================ preços

create table if not exists precos (
  company_id  uuid not null references companies(id) on delete restrict,
  tabela_id   uuid not null references tabelas_preco(id) on delete cascade,
  produto_id  uuid not null references produtos(id) on delete cascade,
  preco       numeric(12,2) not null check (preco >= 0),
  primary key (tabela_id, produto_id)
);

-- `company_id` é redundante com o da tabela de preço, e está aqui de propósito:
-- permite que a política de RLS filtre sem join. Política que depende de join
-- fica cara e, pior, fica fácil de escrever errado.
create index if not exists precos_company_idx on precos (company_id, produto_id);

-- ============================================================ clientes

create table if not exists clientes (
  id            uuid primary key,
  company_id    uuid not null references companies(id) on delete restrict,
  codigo        bigint,
  nome          text not null,
  documento     text,
  telefone      text,
  email         text,

  -- revenda e mercado compram no atacado; restaurante e consumidor no varejo.
  tipo          text not null default 'consumidor'
                check (tipo in ('revenda', 'mercado', 'restaurante', 'consumidor')),

  -- Endereço desnormalizado, sem tabela separada: o entregador vai precisar
  -- disso offline, sem join, quando a Etapa 7 sair da gaveta. Manter assim
  -- agora não custa nada; desnormalizar depois custaria uma migration de dados.
  cep           text,
  logradouro    text,
  numero        text,
  complemento   text,
  bairro        text,
  cidade        text,
  uf            text,
  lat           double precision,
  lng           double precision,
  ponto_referencia text,

  tabela_preco_id uuid references tabelas_preco(id) on delete set null,
  limite_credito  numeric(12,2) not null default 0,
  observacoes     text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists clientes_company_idx on clientes (company_id, nome);
create unique index if not exists clientes_codigo_unico on clientes (company_id, codigo);

-- Documento é único por empresa quando existe. A auditoria achou 5 clientes sem
-- CPF/CNPJ no sistema deles — cadastro incompleto é realidade, então o campo é
-- opcional; o que não pode é o mesmo documento em dois cadastros, que é o que
-- gera cobrança duplicada.
create unique index if not exists clientes_documento_unico
  on clientes (company_id, documento) where documento is not null and documento <> '';

-- Busca por nome sem diferenciar acento/caixa. `pg_trgm` deixa o `ilike '%...%'`
-- usar índice — a operadora digita "bom preço" no meio do nome, não no começo.
create extension if not exists pg_trgm;
create index if not exists clientes_nome_busca on clientes using gin (nome gin_trgm_ops);

-- ============================================================ fornecedores

create table if not exists fornecedores (
  id            uuid primary key,
  company_id    uuid not null references companies(id) on delete restrict,
  codigo        bigint,
  nome          text not null,
  documento     text,
  telefone      text,
  email         text,
  cidade        text,
  uf            text,
  observacoes   text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists fornecedores_company_idx on fornecedores (company_id, nome);
create unique index if not exists fornecedores_codigo_unico on fornecedores (company_id, codigo);

-- ============================================================ numeração automática

create or replace function atribuir_codigo()
returns trigger
language plpgsql
as $$
begin
  if new.codigo is null then
    new.codigo := proximo_codigo(new.company_id, tg_argv[0]);
  end if;
  return new;
end;
$$;

drop trigger if exists produtos_codigo on produtos;
create trigger produtos_codigo before insert on produtos
  for each row execute function atribuir_codigo('produtos');

drop trigger if exists clientes_codigo on clientes;
create trigger clientes_codigo before insert on clientes
  for each row execute function atribuir_codigo('clientes');

drop trigger if exists fornecedores_codigo on fornecedores;
create trigger fornecedores_codigo before insert on fornecedores
  for each row execute function atribuir_codigo('fornecedores');

-- ============================================================ atualizado_em

drop trigger if exists tabelas_preco_touch on tabelas_preco;
create trigger tabelas_preco_touch before update on tabelas_preco
  for each row execute function touch_atualizado_em();

drop trigger if exists produtos_touch on produtos;
create trigger produtos_touch before update on produtos
  for each row execute function touch_atualizado_em();

drop trigger if exists clientes_touch on clientes;
create trigger clientes_touch before update on clientes
  for each row execute function touch_atualizado_em();

drop trigger if exists fornecedores_touch on fornecedores;
create trigger fornecedores_touch before update on fornecedores
  for each row execute function touch_atualizado_em();

-- ============================================================ isolamento
--
-- Mesmo par `enable` + `force` da 0001, pelo mesmo motivo: sem `force`, o dono
-- da tabela ignora a política em silêncio.
--
-- A política é declarada sem `with check`: no Postgres, quando ela é omitida, o
-- `using` também vale para o insert. Ou seja, gravar linha com o `company_id` de
-- outra empresa é rejeitado pelo banco, não só a leitura.

do $$
declare t text;
begin
  foreach t in array array[
    'sequencias', 'tabelas_preco', 'produtos', 'precos', 'clientes', 'fornecedores'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force  row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
    execute format(
      'create policy tenant_isolation on %I using (company_id = app_current_company())', t
    );
  end loop;
end $$;

-- ============================================================ privilégios
--
-- As tabelas já nascem acessíveis pelo `alter default privileges` da 0002.
-- Funções não entram nesse default — precisam de grant explícito.
grant execute on function proximo_codigo(uuid, text) to casco_app;
