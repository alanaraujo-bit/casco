-- 0015 — Exclusão de entrada de estoque, com histórico.
--
-- A 0006 tornou `estoque_movimentos` imutável de propósito: nem `update` nem
-- `delete` passam, porque um lançamento apagado sem rastro é um saldo que
-- ninguém mais consegue explicar. Isso continua valendo — a diferença é que
-- agora existe uma única exceção, controlada pelo próprio banco: marcar a
-- linha como excluída. A linha nunca sai da tabela; só o efeito dela no saldo
-- é desfeito, e o detalhe financeiro deixa de aparecer na aba Entradas — o
-- que resta ali é só o registro de que a exclusão aconteceu, quando e por quem.

alter table estoque_movimentos
  add column if not exists excluido_em  timestamptz,
  add column if not exists excluido_por uuid references users(id) on delete restrict;

comment on column estoque_movimentos.excluido_em is
  'Quando a operadora excluiu este lançamento pela tela. Nulo enquanto o lançamento vale.';
comment on column estoque_movimentos.excluido_por is
  'Quem excluiu. A linha permanece no banco — a tela é que para de mostrar o detalhe financeiro dela.';

-- ============================================================ a imutabilidade, com uma exceção

-- Mesma função de antes, com uma porta estreita: `update` só passa se a única
-- mudança for `excluido_em`/`excluido_por` saindo de nulo, com todo o resto da
-- linha idêntico. Qualquer outra tentativa de editar continua caindo na
-- mesma exceção de sempre. `delete` continua proibido sem exceção nenhuma —
-- excluir pela tela nunca apaga a linha, só marca.
create or replace function estoque_mov_imutavel()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    raise exception
      'Movimento de estoque não pode ser apagado do banco — use a exclusão da tela.';
  end if;

  if old.excluido_em is not null then
    raise exception 'Este movimento já foi excluído.';
  end if;

  if new.excluido_em is null
     or new.id             is distinct from old.id
     or new.company_id     is distinct from old.company_id
     or new.produto_id     is distinct from old.produto_id
     or new.quantidade     is distinct from old.quantidade
     or new.tipo           is distinct from old.tipo
     or new.custo_unitario is distinct from old.custo_unitario
     or new.fornecedor_id  is distinct from old.fornecedor_id
     or new.documento      is distinct from old.documento
     or new.origem         is distinct from old.origem
     or new.origem_id      is distinct from old.origem_id
     or new.usuario_id     is distinct from old.usuario_id
     or new.observacao     is distinct from old.observacao
     or new.estorno_de     is distinct from old.estorno_de
     or new.criado_em      is distinct from old.criado_em
  then
    raise exception
      'Movimento de estoque não pode ser alterado — lance um movimento de ajuste.';
  end if;

  return new;
end;
$$;

-- ============================================================ o saldo, recalculado

-- Excluir não é o espelho do estorno: o estorno soma uma linha nova ao saldo
-- corrente, isto tira uma linha do cálculo. Não dá para só subtrair a
-- quantidade — o custo médio ponderado depende da ordem em que as entradas
-- aconteceram, e tirar uma do meio muda a média de todas as que vieram
-- depois. Por isso o saldo é refeito do zero a partir do que sobrou, na mesma
-- lógica incremental de `estoque_aplicar_saldo`, e não ajustado por diferença.
create or replace function estoque_recalcular_saldo(p_produto_id uuid, p_company_id uuid)
returns void
language plpgsql
as $$
declare
  m record;
  saldo_atual numeric(12,3) := 0;
  custo_atual numeric(12,4) := 0;
  saldo_novo  numeric(12,3);
begin
  for m in
    select quantidade, custo_unitario
      from estoque_movimentos
     where produto_id = p_produto_id
       and excluido_em is null
     order by criado_em, id
  loop
    saldo_novo := saldo_atual + m.quantidade;

    if m.quantidade > 0 and saldo_novo > 0 then
      custo_atual := ((greatest(saldo_atual, 0) * custo_atual)
                      + (m.quantidade * m.custo_unitario))
                     / (greatest(saldo_atual, 0) + m.quantidade);
    end if;

    saldo_atual := saldo_novo;
  end loop;

  insert into estoque_saldos (company_id, produto_id, quantidade, custo_medio)
       values (p_company_id, p_produto_id, saldo_atual, custo_atual)
  on conflict (produto_id) do update
     set quantidade    = saldo_atual,
         custo_medio   = custo_atual,
         atualizado_em = now();
end;
$$;

create or replace function estoque_mov_saldo_exclusao()
returns trigger
language plpgsql
as $$
begin
  perform estoque_recalcular_saldo(new.produto_id, new.company_id);
  return new;
end;
$$;

drop trigger if exists estoque_mov_saldo_exclusao on estoque_movimentos;
create trigger estoque_mov_saldo_exclusao after update of excluido_em on estoque_movimentos
  for each row
  when (new.excluido_em is not null and old.excluido_em is null)
  execute function estoque_mov_saldo_exclusao();
