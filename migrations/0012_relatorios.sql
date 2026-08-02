-- 0012 — Duas coisas que o DRE precisa e que o banco ainda não dava.
--
-- O DRE do sistema antigo exibe `NaN` nas linhas de custo e despesa (auditoria
-- §4a). Não é um bug de formatação: é o que acontece quando o relatório soma
-- colunas que ninguém garantiu que existem. Aqui as duas garantias moram no
-- banco, antes de qualquer tela.
--
--   1. De onde veio a Conta a Pagar — senão a compra é contada duas vezes.
--   2. Em que mês a perda caiu — senão a de 31/07 às 21h vira agosto.

-- ============================================================ 1. a origem

-- **O CMV vem do estoque, não das Contas a Pagar.**
--
-- Uma compra de mercadoria gera duas linhas na mesma transação (ver 0011): o
-- movimento de entrada e o título a pagar. Se o DRE somasse o custo das saídas
-- de estoque *e* as contas a pagar de natureza `custo`, a mesma mercadoria
-- entraria no resultado duas vezes — uma quando chega, outra quando sai — e o
-- lucro apareceria menor do que é. O dono confere um mês contra o extrato,
-- erra, e a partir daí não acredita em mais nenhum número da tela.
--
-- O critério de exclusão precisa ser um dado, não uma dedução. Dava para
-- filtrar por `categoria = 'Compra de mercadoria'`, que é a string que a tela
-- de estoque grava hoje — e aí o dia em que alguém traduzir esse rótulo, ou
-- digitar um título com a mesma categoria à mão, o DRE muda de resposta sem
-- ninguém tocar no relatório. `origem` é o mesmo desenho que `contas_receber`
-- já usa, e é a coluna que diz quem escreveu a linha.
alter table contas_pagar
  add column if not exists origem text not null default 'manual';

alter table contas_pagar drop constraint if exists contas_pagar_origem_check;
alter table contas_pagar add constraint contas_pagar_origem_check
  check (origem in ('manual', 'estoque'));

comment on column contas_pagar.origem is
  'Quem criou o título. `estoque` = compra de mercadoria, já contada no CMV pela saída — o DRE a ignora para não somar a mesma compra duas vezes.';

-- Backfill do que já foi lançado pela tela de estoque. É o único lugar que
-- grava essa categoria, e a partir desta migration ele grava `origem` também.
update contas_pagar
   set origem = 'estoque'
 where origem = 'manual'
   and categoria = 'Compra de mercadoria';

-- ============================================================ 2. o mês

-- **`date_trunc` num `timestamptz` fecha o mês no fuso da sessão, que é UTC.**
--
-- É a mesma classe de bug que a `src/lib/formatos.ts` documenta do lado da
-- tela, e ela não aparece em desenvolvimento porque ali servidor e navegador
-- são a mesma máquina no mesmo fuso. Aqui o estrago é pior que um texto
-- desalinhado: um galão quebrado às 21h de 31 de julho em Tucumã é 00h de 1º de
-- agosto em UTC. A perda sai do DRE de julho — que a operadora já fechou,
-- conferiu e imprimiu — e reaparece no de agosto, sozinha, sem nenhum
-- lançamento correspondente. Ninguém consegue explicar de onde veio.
--
-- `at time zone 'America/Belem'` converte o instante para a hora local antes de
-- truncar, e o mês passa a fechar às 23h59 de Tucumã. O tipo resultante é
-- `timestamp` sem fuso, que é exatamente o certo: "julho de 2026" é um rótulo
-- de calendário, não um instante.
--
-- O fuso está escrito aqui e em `formatos.ts`, e nos dois pelo mesmo motivo:
-- toda distribuidora atendida hoje está no Pará. No dia em que uma não estiver,
-- vira coluna em `companies` — e são estes dois lugares que mudam.

-- `create or replace view` recusa mudar o tipo de uma coluna existente, e o tipo
-- muda: `mes` era `timestamptz` (o instante truncado em UTC) e passa a ser
-- `timestamp` (o mês como rótulo de calendário). Então a view cai e nasce de
-- novo. Ninguém depende dela em `pg_depend` — só a aplicação consulta — e as
-- duas operações estão na mesma transação do runner, então não existe janela em
-- que a view não exista.
drop view if exists vasilhame_perdas;

create view vasilhame_perdas as
  select m.company_id,
         date_trunc('month', m.criado_em at time zone 'America/Belem') as mes,
         m.motivo,
         sum(-m.quantidade)                    as unidades,
         sum(-m.quantidade * m.custo_unitario) as custo
    from vasilhame_movimentos m
   where m.motivo in ('quebrado', 'trincado', 'perdido')
     and m.estorno_de is null
     and not exists (
           select 1 from vasilhame_movimentos e where e.estorno_de = m.id
         )
   group by m.company_id, date_trunc('month', m.criado_em at time zone 'America/Belem'), m.motivo;

comment on view vasilhame_perdas is
  'Perda de vasilhame como custo não-caixa, para o DRE. Mês fechado no fuso da loja. Ignora estorno e estornado. Nunca toca o fluxo de caixa.';

alter view vasilhame_perdas set (security_invoker = true);
grant select on vasilhame_perdas to casco_app;

drop view if exists estoque_perdas;

create view estoque_perdas as
  select m.company_id,
         date_trunc('month', m.criado_em at time zone 'America/Belem') as mes,
         m.produto_id,
         sum(-m.quantidade)                    as unidades,
         sum(-m.quantidade * m.custo_unitario) as custo
    from estoque_movimentos m
   where m.tipo = 'perda'
     and m.estorno_de is null
     and not exists (
           select 1 from estoque_movimentos e where e.estorno_de = m.id
         )
   group by m.company_id, date_trunc('month', m.criado_em at time zone 'America/Belem'), m.produto_id;

comment on view estoque_perdas is
  'Perda de produto como custo, para o DRE. Mês fechado no fuso da loja. Ignora estorno e estornado.';

alter view estoque_perdas set (security_invoker = true);
grant select on estoque_perdas to casco_app;

-- ============================================================ 3. o CMV

-- **O custo da mercadoria vendida, mês a mês, numa fonte só.**
--
-- Sai da saída de estoque e não do preço de compra: é o custo médio móvel
-- congelado na linha do movimento, no instante da venda (ver 0011). Comprar
-- mais barato no fim do mês não reescreve o custo do que já saiu.
--
-- As duas exclusões de estorno são as mesmas das views de perda. A tela não
-- oferece estorno de baixa de venda hoje — desfazer uma venda é cancelar a
-- venda — mas o dia em que o cancelamento existir, ele vai gravar o par por
-- aqui, e o CMV precisa já estar preparado para não contar os dois lados.
create or replace view estoque_cmv as
  select m.company_id,
         date_trunc('month', m.criado_em at time zone 'America/Belem') as mes,
         sum(-m.quantidade)                    as unidades,
         sum(-m.quantidade * m.custo_unitario) as custo
    from estoque_movimentos m
   where m.tipo = 'venda'
     and m.estorno_de is null
     and not exists (
           select 1 from estoque_movimentos e where e.estorno_de = m.id
         )
   group by m.company_id, date_trunc('month', m.criado_em at time zone 'America/Belem');

comment on view estoque_cmv is
  'Custo das mercadorias vendidas, ao custo médio congelado na saída. Mês fechado no fuso da loja.';

alter view estoque_cmv set (security_invoker = true);
grant select on estoque_cmv to casco_app;
