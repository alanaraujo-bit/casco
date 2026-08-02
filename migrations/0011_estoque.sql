-- 0011 — Estoque ganha os dois lados que faltavam: como o produto entra, e como
-- se conserta uma entrada errada.
--
-- A 0006 criou `estoque_movimentos` e o saldo por trigger, mas só a saída tinha
-- quem a escrevesse: o PDV. O resultado é um estoque que só sabe descer — depois
-- de algumas vendas o saldo fica negativo e o alerta de "abaixo do mínimo"
-- dispara para sempre, sem nenhum caminho pela tela para dar entrada.
--
-- A JM é fábrica de água, não revenda (auditoria §1). Então o produto entra por
-- dois caminhos diferentes, e chamar os dois de "entrada" apagaria justamente a
-- distinção que o DRE vai precisar:
--
--   `producao` — o galão foi envasado. Não há fornecedor e não há nota; o custo
--                é de insumo e envase, e não deve nada a ninguém.
--   `compra`   — chegou mercadoria de fora, com fornecedor e documento, e pode
--                virar título em Contas a Pagar.
--
-- Um `tipo = 'entrada'` genérico obrigaria a decidir qual dos dois era, meses
-- depois, olhando se o campo fornecedor está preenchido. Nenhuma linha usa esse
-- valor hoje (só o PDV escreve, e escreve `venda`), então a troca é limpa — e se
-- alguma linha existisse, o `alter` abaixo falharia alto, que é o certo.

-- ============================================================ os tipos

alter table estoque_movimentos drop constraint if exists estoque_movimentos_tipo_check;
alter table estoque_movimentos add constraint estoque_movimentos_tipo_check
  check (tipo in ('compra', 'producao', 'venda', 'devolucao', 'perda', 'ajuste'));

-- ============================================================ a compra

-- Só a compra tem fornecedor e documento. As outras entradas não têm de quem
-- cobrar nem o que arquivar, e um campo opcional que "às vezes vale" é como se
-- descobre, no fim do ano, que metade das produções foi lançada como compra.
alter table estoque_movimentos
  add column if not exists fornecedor_id uuid references fornecedores(id) on delete restrict,
  add column if not exists documento     text;

create index if not exists estoque_mov_fornecedor_idx
  on estoque_movimentos (company_id, fornecedor_id) where fornecedor_id is not null;

comment on column estoque_movimentos.documento is
  'Número da nota ou do romaneio que originou a compra. Livre: nem todo fornecedor da JM emite nota.';

-- ============================================================ o estorno

-- O caminho de volta. Sem ele, "produzi 8000" no lugar de "800" fica gravado
-- para sempre, e a operadora conserta com um ajuste de inventário — um
-- lançamento cuja descrição não diz o que aconteceu, que é exatamente o defeito
-- do sistema que estamos substituindo.
--
-- Ajuste serve para corrigir o mundo (contei e tinha menos). Estorno serve para
-- corrigir o registro (o mundo estava certo, eu que digitei errado). Confundir
-- os dois é como o inventário deixa de ser auditável.
--
-- A coluna vem antes dos check constraints porque os dois abrem exceção para
-- ela: estorno tem o sinal invertido e herda o fornecedor do original.
alter table estoque_movimentos
  add column if not exists estorno_de uuid references estoque_movimentos(id) on delete restrict;

-- Um movimento se estorna uma vez só: dois cliques no botão, ou dois operadores
-- na mesma tela, dobrariam a correção e o saldo erraria para o outro lado —
-- agora sem ninguém desconfiando.
create unique index if not exists estoque_mov_estorno_unico
  on estoque_movimentos (estorno_de) where estorno_de is not null;

comment on column estoque_movimentos.estorno_de is
  'Movimento que esta linha desfaz. Mantém tipo e custo do original, inverte o sinal.';

-- ============================================================ o sinal

-- Mesma escolha do vasilhame, e pelo mesmo motivo: a operadora digita quantos,
-- sempre positivo, e o significado do lançamento decide o sinal. Aqui isso vira
-- a última linha de defesa — a tela não deveria chegar perto.
--
-- `ajuste` fica de fora porque é o único que vai nos dois sentidos: a contagem
-- física tanto acha item a mais quanto a menos.
alter table estoque_movimentos drop constraint if exists estoque_mov_sinal_coerente;
alter table estoque_movimentos add constraint estoque_mov_sinal_coerente check (
  estorno_de is not null or
  case tipo
    when 'compra'    then quantidade > 0
    when 'producao'  then quantidade > 0
    when 'devolucao' then quantidade > 0
    when 'venda'     then quantidade < 0
    when 'perda'     then quantidade < 0
    else true  -- ajuste de inventário
  end
);

-- Fornecedor só na compra. A exceção do estorno é obrigatória: o estorno de uma
-- compra espelha o original, fornecedor incluído, e tem quantidade negativa.
alter table estoque_movimentos drop constraint if exists estoque_mov_fornecedor_so_compra;
alter table estoque_movimentos add constraint estoque_mov_fornecedor_so_compra check (
  fornecedor_id is null or tipo = 'compra'
);

-- ============================================================ o custo omitido

-- Nem toda entrada tem custo para digitar, e a que não tem **não vale zero**.
--
-- Dois casos reais: a contagem física achou 3 galões a mais, e o cliente
-- devolveu um produto. Em nenhum dos dois existe nota, e obrigar a operadora a
-- inventar um número seria pior do que não perguntar. Mas gravar `0` faz o
-- trigger de saldo tratar essas unidades como brinde e diluir o custo médio de
-- todo o estoque: 147 galões a R$ 4,50 mais 3 achados "a R$ 0" viram 150 a
-- R$ 4,41. O estoque não ficou mais barato — nós é que registramos errado, e o
-- CMV do mês sai junto.
--
-- Entrada sem custo informado entra ao custo médio vigente, que é o valor que
-- ela de fato tem. O número gravado é o efetivo, não o digitado, para o extrato
-- continuar explicando o saldo linha a linha meses depois.
--
-- Roda antes de `estoque_mov_valida_estorno` porque o Postgres dispara triggers
-- de mesmo evento em ordem alfabética, e `custo_padrao` < `valida_estorno`: o
-- estorno precisa da última palavra, já que herda o custo congelado do original.
create or replace function estoque_custo_padrao()
returns trigger
language plpgsql
as $$
declare vigente numeric(12,4);
begin
  if new.estorno_de is not null or new.quantidade <= 0 or new.custo_unitario <> 0 then
    return new;
  end if;

  select custo_medio into vigente from estoque_saldos where produto_id = new.produto_id;
  if found and vigente > 0 then
    new.custo_unitario := vigente;
  end if;

  return new;
end;
$$;

drop trigger if exists estoque_mov_custo_padrao on estoque_movimentos;
create trigger estoque_mov_custo_padrao before insert on estoque_movimentos
  for each row execute function estoque_custo_padrao();

-- ============================================================ o espelhamento

-- Deixar a aplicação como única guardiã do estorno significaria que um script
-- rodado fora dela pode gravar um "estorno" apontando para o movimento de outro
-- produto — e os dois saldos ficariam errados, com cada extrato parecendo
-- correto isoladamente.
create or replace function estoque_validar_estorno()
returns trigger
language plpgsql
as $$
declare original estoque_movimentos%rowtype;
begin
  if new.estorno_de is null then
    return new;
  end if;

  select * into original from estoque_movimentos where id = new.estorno_de;

  if not found then
    raise exception 'Movimento a estornar não encontrado.';
  end if;

  if original.estorno_de is not null then
    raise exception 'Não se estorna um estorno — lance o movimento correto.';
  end if;

  if original.company_id    is distinct from new.company_id
     or original.produto_id    is distinct from new.produto_id
     or original.tipo          is distinct from new.tipo
     or original.fornecedor_id is distinct from new.fornecedor_id then
    raise exception 'Estorno tem que espelhar o movimento original.';
  end if;

  if new.quantidade <> -original.quantidade then
    raise exception 'Estorno tem que ter a quantidade oposta à do original (esperado %).',
      -original.quantidade;
  end if;

  -- Custo do original, não o de hoje. É o que faz o estorno devolver ao custo
  -- médio exatamente a camada que a entrada colocou — ver `estoque_aplicar_saldo`
  -- logo abaixo, que depende disto para a conta fechar.
  new.custo_unitario := original.custo_unitario;

  return new;
end;
$$;

drop trigger if exists estoque_mov_valida_estorno on estoque_movimentos;
create trigger estoque_mov_valida_estorno before insert on estoque_movimentos
  for each row execute function estoque_validar_estorno();

-- ============================================================ o custo médio

-- Reescrita da função da 0006 para um caso que ela não previa: o estorno de uma
-- entrada.
--
-- A regra original — "só a entrada mexe no custo médio, a saída consome ao custo
-- vigente" — continua de pé e continua certa. Mas o estorno de uma compra é uma
-- quantidade negativa que **precisa** mexer, e caía no ramo da saída: o saldo
-- voltava ao lugar e o custo médio ficava onde a entrada errada o deixou. Uma
-- compra de 800 a R$ 50 lançada por engano num estoque de 800 a R$ 2 dobraria o
-- custo médio, e o estorno devolveria a quantidade deixando o CMV do mês
-- multiplicado por treze, sem nenhuma linha visível explicando por quê.
--
-- A correção é remover a camada em valor, não em média: o estoque vale
-- `quantidade × custo_médio`, tira-se `quantidade_estornada × custo_do_original`,
-- e o que sobra dividido pelo saldo novo é o custo médio de volta. Como o
-- estorno carrega o custo do original (garantido pelo trigger acima), a conta é
-- exata quando nada foi consumido no meio — que é o caso real, já que se estorna
-- o engano em minutos.
create or replace function estoque_aplicar_saldo()
returns trigger
language plpgsql
as $$
declare
  saldo_atual numeric(12,3);
  custo_atual numeric(12,4);
  saldo_novo  numeric(12,3);
  valor_novo  numeric;
begin
  select quantidade, custo_medio into saldo_atual, custo_atual
    from estoque_saldos where produto_id = new.produto_id;

  if not found then
    saldo_atual := 0;
    custo_atual := 0;
  end if;

  saldo_novo := saldo_atual + new.quantidade;

  if new.estorno_de is not null and new.quantidade < 0 then
    -- Desfazendo uma entrada: retira a camada que ela somou.
    -- `new.quantidade` já é negativo, então a soma abaixo subtrai.
    valor_novo := (greatest(saldo_atual, 0) * custo_atual)
                  + (new.quantidade * new.custo_unitario);
    if saldo_novo > 0 then
      -- O `greatest` cobre o caso de já ter havido saída no meio, em que a
      -- camada removida vale mais do que o estoque restante. Custo negativo
      -- viraria receita no DRE; zero é errado por menos.
      custo_atual := greatest(valor_novo, 0) / saldo_novo;
    else
      custo_atual := 0;
    end if;

  elsif new.quantidade > 0 and saldo_novo > 0 then
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

-- ============================================================ a perda

-- O mesmo desenho de `vasilhame_perdas`, e pelo mesmo motivo: perda é custo, e
-- custo estornado deixou de existir. Sem as duas exclusões, um `perda 500`
-- digitado errado ficaria custando no DRE para sempre, e a linha do estorno
-- somaria mais em cima.
--
-- A Etapa 6 lê daqui e de `vasilhame_perdas`, e de mais lugar nenhum.
create or replace view estoque_perdas as
  select m.company_id,
         date_trunc('month', m.criado_em) as mes,
         m.produto_id,
         sum(-m.quantidade)                    as unidades,
         sum(-m.quantidade * m.custo_unitario) as custo
    from estoque_movimentos m
   where m.tipo = 'perda'
     and m.estorno_de is null
     and not exists (
           select 1 from estoque_movimentos e where e.estorno_de = m.id
         )
   group by m.company_id, date_trunc('month', m.criado_em), m.produto_id;

comment on view estoque_perdas is
  'Perda de produto como custo, para o DRE. Ignora estorno e estornado.';

alter view estoque_perdas set (security_invoker = true);
grant select on estoque_perdas to casco_app;
