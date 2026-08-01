-- 0007 — Estorno de movimento de vasilhame.
--
-- A 0005 tornou movimento imutável: sem update, sem delete, "se estorna com um
-- movimento contrário". A regra está certa — movimento é lançamento contábil, e
-- apagar histórico é como o saldo materializado descola do extrato que deveria
-- explicá-lo. Faltava o outro lado dela: o caminho para de fato estornar.
--
-- Sem isso, a operadora digita `50` no lugar de `5` às sete da manhã e o número
-- errado fica gravado para sempre. Ela então "conserta" com um ajuste de
-- inventário — e chegamos de novo ao problema que originou o projeto: um
-- lançamento cuja descrição não diz o que aconteceu de verdade.

-- ============================================================ o vínculo

-- `estorno_de` aponta para o movimento que está sendo desfeito. É o que
-- distingue "o cliente devolveu 5" de "eu errei o 5 de ontem": no extrato as
-- duas linhas têm o mesmo motivo e sinais opostos, e só esta coluna separa
-- correção de fato novo.
alter table vasilhame_movimentos
  add column if not exists estorno_de uuid references vasilhame_movimentos(id) on delete restrict;

-- Um movimento se estorna uma vez só. Sem esta trava, dois cliques no botão —
-- ou dois operadores na mesma tela — dobram a correção, e o saldo fica errado
-- para o outro lado, agora sem ninguém desconfiando.
create unique index if not exists vasilhame_mov_estorno_unico
  on vasilhame_movimentos (estorno_de) where estorno_de is not null;

comment on column vasilhame_movimentos.estorno_de is
  'Movimento que esta linha desfaz. Estorno mantém o motivo original e inverte o sinal.';

-- ============================================================ o sinal

-- O estorno precisa violar a coerência de sinal, e isso é o ponto dele: o
-- contrário de `entregue +5` é `entregue -5`. Sem a exceção, estornar uma
-- entrega exigiria gravá-la como `devolvido` — e aí o extrato passaria a
-- afirmar que o cliente trouxe o galão de volta, quando ninguém trouxe nada.
--
-- A exceção é estreita de propósito: só vale com `estorno_de` preenchido, que
-- por sua vez exige um movimento real do outro lado.
alter table vasilhame_movimentos drop constraint if exists vasilhame_mov_sinal_coerente;
alter table vasilhame_movimentos add constraint vasilhame_mov_sinal_coerente check (
  estorno_de is not null or
  case motivo
    when 'entregue'  then quantidade > 0
    when 'devolvido' then quantidade < 0
    when 'quebrado'  then quantidade < 0
    when 'trincado'  then quantidade < 0
    when 'perdido'   then quantidade < 0
    else true  -- fábrica e ajuste de inventário vão nos dois sentidos
  end
);

-- ============================================================ a perda

-- **A razão de esta migration existir e não ser só uma coluna.**
--
-- A view alimenta o custo de perda do DRE. Se ela ignorasse o estorno, um
-- `quebrado 50` digitado por engano deixaria o custo de 50 galões no resultado
-- do mês para sempre — e a linha de estorno, logo abaixo, ainda somaria mais.
-- Trocaríamos a receita inflada do sistema antigo por um custo inflado no
-- nosso, que é o mesmo erro com o sinal virado.
--
-- Duas exclusões, e as duas são necessárias: a linha de estorno não é perda, e
-- a linha estornada deixou de ser.
create or replace view vasilhame_perdas as
  select m.company_id,
         date_trunc('month', m.criado_em) as mes,
         m.motivo,
         sum(-m.quantidade)                    as unidades,
         sum(-m.quantidade * m.custo_unitario) as custo
    from vasilhame_movimentos m
   where m.motivo in ('quebrado', 'trincado', 'perdido')
     and m.estorno_de is null
     and not exists (
           select 1 from vasilhame_movimentos e where e.estorno_de = m.id
         )
   group by m.company_id, date_trunc('month', m.criado_em), m.motivo;

comment on view vasilhame_perdas is
  'Perda de vasilhame como custo não-caixa, para o DRE. Ignora estorno e estornado. Nunca toca o fluxo de caixa.';

alter view vasilhame_perdas set (security_invoker = true);
grant select on vasilhame_perdas to casco_app;

-- ============================================================ integridade

-- O estorno tem que espelhar o movimento que desfaz. Deixar a aplicação como
-- única guardiã disso significaria que um script rodado fora dela pode gravar
-- um "estorno" apontando para o movimento de outro cliente — e o saldo dos dois
-- ficaria errado, com o extrato de ambos parecendo correto isoladamente.
create or replace function vasilhame_validar_estorno()
returns trigger
language plpgsql
as $$
declare original vasilhame_movimentos%rowtype;
begin
  if new.estorno_de is null then
    return new;
  end if;

  select * into original from vasilhame_movimentos where id = new.estorno_de;

  if not found then
    raise exception 'Movimento a estornar não encontrado.';
  end if;

  if original.estorno_de is not null then
    raise exception 'Não se estorna um estorno — lance o movimento correto.';
  end if;

  if original.company_id  is distinct from new.company_id
     or original.cliente_id is distinct from new.cliente_id
     or original.produto_id is distinct from new.produto_id
     or original.motivo     is distinct from new.motivo then
    raise exception 'Estorno tem que espelhar o movimento original.';
  end if;

  if new.quantidade <> -original.quantidade then
    raise exception 'Estorno tem que ter a quantidade oposta à do original (esperado %).',
      -original.quantidade;
  end if;

  -- O custo congelado vem do original e não do produto hoje: senão o estorno de
  -- uma perda de maio devolveria o custo de agosto, e o mês fecharia com sobra
  -- ou falta do reajuste.
  new.custo_unitario := original.custo_unitario;

  return new;
end;
$$;

drop trigger if exists vasilhame_mov_valida_estorno on vasilhame_movimentos;
create trigger vasilhame_mov_valida_estorno before insert on vasilhame_movimentos
  for each row execute function vasilhame_validar_estorno();
