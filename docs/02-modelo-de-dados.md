# Modelo de dados — núcleo

Postgres. Toda tabela de negócio tem `company_id` e RLS ligada. IDs são `uuid v7`
(ordenáveis por tempo) para que o app do entregador possa gerá-los offline sem colisão.

---

## Tenancy e acesso

```sql
create table companies (
  id            uuid primary key,
  nome          text not null,
  documento     text,                    -- CNPJ/CPF, opcional
  telefone      text,
  plano         text not null default 'basico',
  criado_em     timestamptz not null default now()
);

create table users (
  id            uuid primary key,        -- = auth.users.id do Supabase
  company_id    uuid not null references companies(id),
  nome          text not null,
  papel         text not null,           -- dono | operador | entregador
  ativo         boolean not null default true
);
```

`papel` é grosseiro de propósito. Distribuidora pequena não tem organograma; permissão
granular vira tela de configuração que ninguém usa. Se um cliente pedir, viramos tabela
de permissões depois — não antes.

---

## Cadastros

```sql
create table clientes (
  id            uuid primary key,
  company_id    uuid not null references companies(id),
  nome          text not null,
  telefone      text,
  documento     text,
  tipo          text not null default 'varejo',   -- varejo | comercio | condominio
  -- endereço desnormalizado: o entregador precisa disso offline, sem join
  cep           text, logradouro text, numero text, complemento text,
  bairro        text, cidade text, uf text,
  lat           double precision, lng double precision,
  ponto_referencia text,
  tabela_preco_id  uuid references tabelas_preco(id),
  limite_credito   numeric(12,2) not null default 0,
  observacoes   text,
  ativo         boolean not null default true,
  criado_em     timestamptz not null default now()
);

create index on clientes (company_id, nome);
```

**Preço por cliente, não por produto.** Distribuidora cobra diferente de casa, de comércio
e de condomínio pelo mesmo galão. O legado força um preço só — é uma das reclamações
prováveis. Por isso `tabelas_preco`:

```sql
create table tabelas_preco (
  id uuid primary key, company_id uuid not null, nome text not null, padrao boolean default false
);
create table precos (
  tabela_id uuid not null references tabelas_preco(id),
  produto_id uuid not null references produtos(id),
  preco numeric(12,2) not null,
  primary key (tabela_id, produto_id)
);
```

```sql
create table produtos (
  id            uuid primary key,
  company_id    uuid not null references companies(id),
  nome          text not null,
  sku           text,
  unidade       text not null default 'un',
  preco_padrao  numeric(12,2) not null default 0,
  custo         numeric(12,2) not null default 0,
  -- vasilhame: o coração do negócio, e o que o legado não tem
  retornavel    boolean not null default false,
  vasilhame_id  uuid references produtos(id),   -- galão vazio correspondente
  controla_estoque boolean not null default true,
  ativo         boolean not null default true
);
```

---

## Vasilhame (comodato) — o diferencial

Cada cliente tem um **saldo de vasilhames em poder dele**. Não é estoque: é um empréstimo
que precisa voltar.

```sql
create table vasilhame_saldos (
  company_id  uuid not null,
  cliente_id  uuid not null references clientes(id),
  produto_id  uuid not null references produtos(id),  -- o vasilhame vazio
  quantidade  integer not null default 0,             -- quantos ele está devendo
  primary key (cliente_id, produto_id)
);

create table vasilhame_movimentos (
  id          uuid primary key,
  company_id  uuid not null,
  cliente_id  uuid,                      -- null = movimento interno (fábrica, caminhão)
  produto_id  uuid not null,
  quantidade  integer not null,          -- + saiu da empresa, − voltou para a empresa
  motivo      text not null,             -- ver lista abaixo
  origem      text,                      -- venda | rota | ajuste | inventario
  origem_id   uuid,
  usuario_id  uuid references users(id), -- quem lançou (responsabilização)
  observacao  text,
  criado_em   timestamptz not null default now()
);
```

**`motivo` é o campo que não existe no legado** — e a falta dele é a causa raiz das vendas
falsas de centavos:

| motivo | efeito |
|---|---|
| `entregue` | cliente fica devendo o vasilhame |
| `devolvido` | cliente quita o vasilhame |
| `quebrado` | perda — sai do ativo, **não gera receita** |
| `trincado` | perda parcial — retirado de circulação |
| `perdido` | cliente não devolveu; opcionalmente vira cobrança |
| `enviado_fabrica` | transferência interna (o caso `BETO LEVOU PARA A FABRICA`) |
| `retornou_fabrica` | volta do envase |
| `ajuste_inventario` | acerto de contagem |

Regra de ouro do módulo: **baixa de galão é evento de estoque, jamais uma venda.**
Nenhum motivo desta tabela toca `vendas`, `pagamentos` ou `contas_receber`. É exatamente
essa separação que conserta o DRE do cliente.

Perdas viram custo pelo custo médio do vasilhame, visível no DRE como custo — que é onde
deveria estar desde sempre.

> **Correção do plano original, aplicada na migration 0005.** A primeira versão deste
> documento mandava lançar a perda em `caixa_movimentos`, como saída na categoria "Perda
> de vasilhame". Isso está errado: quando um galão quebra, **nenhum dinheiro sai do
> caixa**. Jogar a perda no fluxo de caixa erraria o saldo do dia exatamente como a venda
> de R$ 0,13 erra o faturamento — trocaríamos um número falso por outro, e o Fluxo de
> Caixa Diário deixaria de bater com o dinheiro na gaveta.
>
> Perda é **custo não-caixa**. Ela vive em `vasilhame_movimentos`, com o custo unitário
> congelado na linha, e o DRE a lê pela view `vasilhame_perdas`. Uma fonte só, auditável
> galão a galão, sem duplicação para sair de sincronia.

O saldo é **derivado** dos movimentos, mas materializado na tabela de saldo para leitura
rápida no caminhão. Um trigger mantém as duas em sincronia — assim o saldo nunca "descola"
por bug de aplicação, e ainda dá para auditar galão por galão quando o cliente reclamar.

---

## Vendas

```sql
create table vendas (
  id            uuid primary key,        -- gerado no dispositivo (offline)
  company_id    uuid not null,
  cliente_id    uuid references clientes(id),   -- null = venda de balcão avulsa
  origem        text not null,           -- pdv | entrega | whatsapp
  status        text not null,           -- rascunho | confirmada | cancelada
  subtotal      numeric(12,2) not null default 0,
  desconto      numeric(12,2) not null default 0,
  total         numeric(12,2) not null default 0,
  vendedor_id   uuid references users(id),
  criado_em     timestamptz not null default now(),
  sincronizado_em timestamptz            -- null enquanto só existe no celular
);

create table venda_itens (
  id uuid primary key, venda_id uuid not null references vendas(id) on delete cascade,
  produto_id uuid not null, quantidade numeric(12,3) not null,
  preco_unitario numeric(12,2) not null, total numeric(12,2) not null,
  vasilhame_devolvido integer not null default 0
);

create table pagamentos (
  id uuid primary key, company_id uuid not null,
  venda_id uuid references vendas(id),
  forma text not null,                   -- dinheiro | pix | credito | debito | a_prazo
  valor numeric(12,2) not null,
  recebido_em timestamptz not null default now()
);
```

Nota sobre **a prazo**: é forma de pagamento *e* gera conta a receber. Distribuidora vive
disso — cliente de condomínio paga no fim do mês. Um `pagamento` com `forma='a_prazo'`
dispara a criação da linha em `contas_receber`.

---

## Entrega e rotas — inexistente no legado

```sql
create table rotas (
  id uuid primary key, company_id uuid not null,
  data date not null, entregador_id uuid references users(id),
  status text not null default 'planejada',   -- planejada | em_curso | concluida
  veiculo text
);

create table rota_paradas (
  id uuid primary key, rota_id uuid not null references rotas(id) on delete cascade,
  cliente_id uuid not null, ordem integer not null,
  status text not null default 'pendente',    -- pendente | entregue | ausente | recusado
  venda_id uuid references vendas(id),
  chegou_em timestamptz, concluido_em timestamptz,
  lat double precision, lng double precision, -- onde a entrega foi confirmada
  foto_url text, observacao text
);
```

`lat/lng` da confirmação é prova de entrega barata e resolve a discussão
"o entregador passou lá?" sem custo de hardware.

---

## Financeiro

```sql
create table contas_receber (
  id uuid primary key, company_id uuid not null,
  cliente_id uuid references clientes(id), venda_id uuid references vendas(id),
  descricao text, valor numeric(12,2) not null,
  vencimento date not null, pago_em timestamptz, valor_pago numeric(12,2) default 0
);

create table contas_pagar (
  id uuid primary key, company_id uuid not null,
  fornecedor_id uuid references fornecedores(id), categoria_id uuid references categorias(id),
  descricao text, valor numeric(12,2) not null,
  vencimento date not null, pago_em timestamptz
);

create table caixa_movimentos (
  id uuid primary key, company_id uuid not null,
  tipo text not null,                    -- entrada | saida
  valor numeric(12,2) not null, categoria_id uuid,
  origem text, origem_id uuid,
  criado_em timestamptz not null default now()
);
```

---

## Sincronização offline

```sql
create table sync_outbox_log (
  id           uuid primary key,         -- id da operação, gerado no dispositivo
  company_id   uuid not null,
  device_id    text not null,
  entidade     text not null,
  aplicado_em  timestamptz not null default now()
);
```

O servidor grava aqui todo `id` de operação já aplicado. Reenvio da mesma operação bate no
`on conflict (id) do nothing` e é descartado silenciosamente. É isso que torna a fila do
entregador segura para retry agressivo em rede ruim.
