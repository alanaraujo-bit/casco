/**
 * Prova empírica das regras de negócio que moram no banco.
 *
 * Irmã do teste de isolamento do `migrate.mjs`, e pelo mesmo motivo: constraint
 * e trigger são o tipo de coisa que parece certa na revisão do diff e não faz
 * nada em produção — basta um `check` com a condição invertida, um trigger
 * registrado como `before` onde precisava ser `after`, ou uma política de RLS
 * que nunca é exercitada por escrita.
 *
 * Conecta como `casco_app`, o mesmo papel restrito da aplicação, dentro de
 * transações com `app.company_id` definido — exatamente o que o `withTenant()`
 * faz. Testar como dono do banco não provaria nada: superusuário ignora RLS.
 *
 * Cria duas empresas de teste, exercita as regras e limpa tudo no fim, mesmo
 * em caso de falha.
 *
 *     npm run db:provar
 */
import postgres from 'postgres'
import { randomUUID } from 'node:crypto'

const urlDono = process.env.DIRECT_DATABASE_URL
const dono = postgres(urlDono, { max: 1, prepare: false, onnotice() {} })

const u = new URL(urlDono)
u.username = 'casco_app'
u.password = process.env.APP_DB_PASSWORD
const app = postgres(u.toString(), { max: 1, prepare: false, onnotice() {} })

const A = '00000000-0000-4000-8000-0000000000aa'
const B = '00000000-0000-4000-8000-0000000000bb'

const ok = []
const falhas = []
const check = (nome, cond, detalhe = '') =>
  cond ? ok.push(nome) : falhas.push(`${nome}${detalhe ? ' — ' + detalhe : ''}`)

/** Executa fn dentro de uma transação com o tenant aplicado (igual withTenant). */
const comTenant = (companyId, fn) =>
  app.begin(async (tx) => {
    await tx`select set_config('app.company_id', ${companyId}, true)`
    return fn(tx)
  })

/** Espera que a operação seja rejeitada pelo banco. */
async function deveFalhar(nome, fn, trechoEsperado) {
  try {
    await fn()
    falhas.push(`${nome} — foi ACEITO, deveria ter sido rejeitado`)
  } catch (err) {
    const m = err.message || ''
    check(nome, !trechoEsperado || m.includes(trechoEsperado), `erro foi: ${m.slice(0, 90)}`)
  }
}

/**
 * Movimento de vasilhame e de estoque são imutáveis por trigger — é uma das
 * regras que este arquivo prova. Isso vale inclusive para o dono do banco, então
 * a faxina precisa desligar os triggers explicitamente. `replica` é o modo que o
 * Postgres usa em réplica de streaming: os triggers de usuário não disparam.
 */
async function limpar() {
  await dono`set session_replication_role = 'replica'`
  for (const t of [
    'estoque_movimentos', 'estoque_saldos', 'vasilhame_movimentos', 'vasilhame_saldos',
    'pagamentos', 'venda_itens', 'vendas', 'contas_receber', 'contas_pagar',
    'caixa_movimentos', 'precos', 'produtos', 'clientes', 'fornecedores',
    'tabelas_preco', 'formas_pagamento', 'contas_bancarias', 'sequencias', 'feedbacks',
  ]) {
    await dono.unsafe(`delete from ${t} where company_id in ('${A}','${B}')`)
  }
  await dono`delete from companies where id in (${A}, ${B})`
  // O admin de prova não tem company_id para filtrar; o domínio reservado
  // `.invalid` (RFC 2606) é o que garante que nenhum admin de verdade case.
  await dono`delete from plataforma_admins where email like '%@exemplo.invalid'`
  await dono`set session_replication_role = 'origin'`
}

try {
  await limpar()
  await dono`insert into companies (id, nome) values (${A}, 'PROVA A'), (${B}, 'PROVA B')`

  // ---------------------------------------------------- numeração por empresa
  const c1 = randomUUID(), c2 = randomUUID(), c3 = randomUUID()
  await comTenant(A, async (tx) => {
    await tx`insert into clientes (id, company_id, nome) values (${c1}, ${A}, 'Mercado Um')`
    await tx`insert into clientes (id, company_id, nome) values (${c2}, ${A}, 'Mercado Dois')`
  })
  await comTenant(B, (tx) =>
    tx`insert into clientes (id, company_id, nome) values (${c3}, ${B}, 'Outro Tenant')`,
  )
  const cods = await dono`select id, codigo from clientes where id in (${c1}, ${c2}, ${c3})`
  const cod = (id) => Number(cods.find((r) => r.id === id).codigo)
  check('numeração começa em 1 por empresa', cod(c1) === 1, `veio ${cod(c1)}`)
  check('numeração incrementa', cod(c2) === 2, `veio ${cod(c2)}`)
  check('empresa B recomeça do 1', cod(c3) === 1, `veio ${cod(c3)}`)

  // ---------------------------------------------------------------- isolamento
  const vistos = await comTenant(A, (tx) => tx`select id from clientes`)
  check('tenant A não enxerga cliente de B', vistos.length === 2, `viu ${vistos.length}`)

  await deveFalhar(
    'gravar cliente com company_id alheio é rejeitado',
    () => comTenant(A, (tx) =>
      tx`insert into clientes (id, company_id, nome) values (${randomUUID()}, ${B}, 'Invasor')`),
    'row-level security',
  )

  // ------------------------------------------------------ produto retornável
  const galao = randomUUID(), agua = randomUUID()
  await comTenant(A, async (tx) => {
    await tx`insert into produtos (id, company_id, nome, custo)
             values (${galao}, ${A}, 'Galão 20L vazio', 38)`
    await tx`insert into produtos (id, company_id, nome, preco_padrao, retornavel, vasilhame_id)
             values (${agua}, ${A}, 'Água 20L', 6.60, true, ${galao})`
  })
  check('produto retornável com vasilhame é aceito', true)

  await deveFalhar(
    'retornável sem vasilhame é rejeitado',
    () => comTenant(A, (tx) =>
      tx`insert into produtos (id, company_id, nome, retornavel)
         values (${randomUUID()}, ${A}, 'Água solta', true)`),
    'produtos_retornavel_tem_vasilhame',
  )

  // ------------------------------------------------------------- vasilhame
  await comTenant(A, async (tx) => {
    await tx`insert into vasilhame_movimentos (id, company_id, cliente_id, produto_id, quantidade, motivo)
             values (${randomUUID()}, ${A}, ${c1}, ${galao}, 100, 'entregue')`
    await tx`insert into vasilhame_movimentos (id, company_id, cliente_id, produto_id, quantidade, motivo)
             values (${randomUUID()}, ${A}, ${c1}, ${galao}, -40, 'devolvido')`
  })
  const [saldo] = await dono`select quantidade from vasilhame_saldos
                             where cliente_id = ${c1} and produto_id = ${galao}`
  check('saldo do cliente = 100 − 40 = 60', Number(saldo.quantidade) === 60,
        `veio ${saldo?.quantidade}`)

  await deveFalhar(
    'entrega com quantidade negativa é rejeitada',
    () => comTenant(A, (tx) =>
      tx`insert into vasilhame_movimentos (id, company_id, cliente_id, produto_id, quantidade, motivo)
         values (${randomUUID()}, ${A}, ${c1}, ${galao}, -5, 'entregue')`),
    'vasilhame_mov_sinal_coerente',
  )

  await deveFalhar(
    'envio à fábrica com cliente é rejeitado',
    () => comTenant(A, (tx) =>
      tx`insert into vasilhame_movimentos (id, company_id, cliente_id, produto_id, quantidade, motivo)
         values (${randomUUID()}, ${A}, ${c1}, ${galao}, 20, 'enviado_fabrica')`),
    'vasilhame_mov_fabrica_sem_cliente',
  )

  await deveFalhar(
    'movimento de vasilhame não pode ser editado',
    () => comTenant(A, (tx) =>
      tx`update vasilhame_movimentos set quantidade = 1 where cliente_id = ${c1}`),
    'estorno',
  )

  // ------------------------------------------------- perda vira custo, não venda
  const quebra = randomUUID()
  await comTenant(A, (tx) =>
    tx`insert into vasilhame_movimentos
         (id, company_id, cliente_id, produto_id, quantidade, motivo, custo_unitario)
       values (${quebra}, ${A}, ${c1}, ${galao}, -3, 'quebrado', 38)`)
  const [perda] = await comTenant(A, (tx) =>
    tx`select sum(unidades)::int as un, sum(custo)::numeric as custo from vasilhame_perdas`)
  check('perda de 3 galões vira custo de R$ 114', Number(perda.custo) === 114,
        `veio ${perda.custo}`)
  const [aposQuebra] = await dono`select quantidade from vasilhame_saldos
                                  where cliente_id = ${c1} and produto_id = ${galao}`
  check('galão quebrado baixa a dívida do cliente (60 − 3 = 57)',
        Number(aposQuebra.quantidade) === 57, `veio ${aposQuebra.quantidade}`)

  // ---------------------------------------------------------------- estorno
  //
  // Movimento é imutável, então corrigir é lançar o contrário. O que precisa
  // ser provado aqui não é que a linha entra — é que o custo SAI do relatório.
  // Sem isso, um `quebrado 3` digitado por engano ficaria custando R$ 114 no
  // DRE para sempre — um custo inflado erra o resultado tanto quanto uma
  // receita inflada.
  await deveFalhar(
    'estorno com quantidade que não espelha o original é rejeitado',
    () => comTenant(A, (tx) =>
      tx`insert into vasilhame_movimentos
           (id, company_id, cliente_id, produto_id, quantidade, motivo, estorno_de)
         values (${randomUUID()}, ${A}, ${c1}, ${galao}, 99, 'quebrado', ${quebra})`),
    'quantidade oposta',
  )

  const estorno = randomUUID()
  await comTenant(A, (tx) =>
    tx`insert into vasilhame_movimentos
         (id, company_id, cliente_id, produto_id, quantidade, motivo, estorno_de)
       values (${estorno}, ${A}, ${c1}, ${galao}, 3, 'quebrado', ${quebra})`)

  const [semPerda] = await comTenant(A, (tx) =>
    tx`select coalesce(sum(custo), 0)::numeric as custo from vasilhame_perdas`)
  check('perda estornada sai do custo do DRE', Number(semPerda.custo) === 0,
        `veio ${semPerda.custo}`)

  const [aposEstorno] = await dono`select quantidade from vasilhame_saldos
                                   where cliente_id = ${c1} and produto_id = ${galao}`
  check('estorno devolve a dívida do cliente (57 + 3 = 60)',
        Number(aposEstorno.quantidade) === 60, `veio ${aposEstorno.quantidade}`)

  // O custo congelado vem do original, não do produto hoje: senão estornar uma
  // perda de maio devolveria o custo de agosto, e o mês fecharia com a diferença.
  const [custoEstorno] = await dono`select custo_unitario from vasilhame_movimentos
                                    where id = ${estorno}`
  check('estorno herda o custo congelado do original (R$ 38)',
        Number(custoEstorno.custo_unitario) === 38, `veio ${custoEstorno.custo_unitario}`)

  await deveFalhar(
    'estornar duas vezes o mesmo movimento é rejeitado',
    () => comTenant(A, (tx) =>
      tx`insert into vasilhame_movimentos
           (id, company_id, cliente_id, produto_id, quantidade, motivo, estorno_de)
         values (${randomUUID()}, ${A}, ${c1}, ${galao}, 3, 'quebrado', ${quebra})`),
    'vasilhame_mov_estorno_unico',
  )

  await deveFalhar(
    'estorno de estorno é rejeitado',
    () => comTenant(A, (tx) =>
      tx`insert into vasilhame_movimentos
           (id, company_id, cliente_id, produto_id, quantidade, motivo, estorno_de)
         values (${randomUUID()}, ${A}, ${c1}, ${galao}, -3, 'quebrado', ${estorno})`),
    'estorna um estorno',
  )

  // ---------------------------------------------------------- custo médio
  await comTenant(A, async (tx) => {
    await tx`insert into estoque_movimentos (id, company_id, produto_id, quantidade, tipo, custo_unitario)
             values (${randomUUID()}, ${A}, ${agua}, 100, 'producao', 4.00)`
    await tx`insert into estoque_movimentos (id, company_id, produto_id, quantidade, tipo, custo_unitario)
             values (${randomUUID()}, ${A}, ${agua}, 100, 'producao', 5.00)`
  })
  const [est] = await dono`select quantidade, custo_medio from estoque_saldos where produto_id = ${agua}`
  check('custo médio de 100@4 + 100@5 = 4,50', Number(est.custo_medio) === 4.5,
        `veio ${est.custo_medio}`)

  await comTenant(A, (tx) =>
    tx`insert into estoque_movimentos (id, company_id, produto_id, quantidade, tipo, custo_unitario)
       values (${randomUUID()}, ${A}, ${agua}, -50, 'venda', 0)`)
  const [est2] = await dono`select quantidade, custo_medio from estoque_saldos where produto_id = ${agua}`
  check('saída não mexe no custo médio', Number(est2.custo_medio) === 4.5, `veio ${est2.custo_medio}`)
  check('saída baixa a quantidade (200 − 50 = 150)', Number(est2.quantidade) === 150,
        `veio ${est2.quantidade}`)

  // -------------------------------------------------------- estoque: sinal (0011)
  await deveFalhar(
    'produção com quantidade negativa é rejeitada',
    () => comTenant(A, (tx) =>
      tx`insert into estoque_movimentos (id, company_id, produto_id, quantidade, tipo, custo_unitario)
         values (${randomUUID()}, ${A}, ${agua}, -10, 'producao', 1)`),
    'estoque_mov_sinal_coerente',
  )
  await deveFalhar(
    'venda com quantidade positiva é rejeitada',
    () => comTenant(A, (tx) =>
      tx`insert into estoque_movimentos (id, company_id, produto_id, quantidade, tipo, custo_unitario)
         values (${randomUUID()}, ${A}, ${agua}, 10, 'venda', 1)`),
    'estoque_mov_sinal_coerente',
  )

  // Ajuste é o único que vai nos dois sentidos — a contagem física tanto acha
  // item a mais quanto a menos, e travar um dos lados obrigaria a operadora a
  // inventar um tipo errado para o outro.
  await comTenant(A, (tx) =>
    tx`insert into estoque_movimentos (id, company_id, produto_id, quantidade, tipo, custo_unitario)
       values (${randomUUID()}, ${A}, ${agua}, -3, 'ajuste', 0)`)
  await comTenant(A, (tx) =>
    tx`insert into estoque_movimentos (id, company_id, produto_id, quantidade, tipo, custo_unitario)
       values (${randomUUID()}, ${A}, ${agua}, 3, 'ajuste', 0)`)
  const [est3] = await dono`select quantidade, custo_medio from estoque_saldos where produto_id = ${agua}`
  check('ajuste anda nos dois sentidos', Number(est3.quantidade) === 150, `veio ${est3.quantidade}`)

  // Achar 3 galões a mais na contagem não barateia o estoque. Sem o trigger de
  // custo padrão, os 3 entrariam a R$ 0 e o custo médio cairia para R$ 4,41 —
  // e o CMV do mês sairia junto, sem nenhuma linha explicando.
  check('ajuste sem custo entra ao custo vigente, não a zero',
        Number(est3.custo_medio) === 4.5, `veio ${est3.custo_medio}`)
  const [ajusteGravado] = await dono`
    select custo_unitario from estoque_movimentos
     where produto_id = ${agua} and tipo = 'ajuste' and quantidade > 0 limit 1`
  check('e grava no movimento o custo efetivo, não o digitado',
        Number(ajusteGravado.custo_unitario) === 4.5, `veio ${ajusteGravado.custo_unitario}`)

  // ------------------------------------------------- estoque: fornecedor (0011)
  const forn = randomUUID()
  await comTenant(A, (tx) =>
    tx`insert into fornecedores (id, company_id, nome) values (${forn}, ${A}, 'Tampas Ltda')`)

  await deveFalhar(
    'produção com fornecedor é rejeitada',
    () => comTenant(A, (tx) =>
      tx`insert into estoque_movimentos
           (id, company_id, produto_id, quantidade, tipo, custo_unitario, fornecedor_id)
         values (${randomUUID()}, ${A}, ${agua}, 10, 'producao', 1, ${forn})`),
    'estoque_mov_fornecedor_so_compra',
  )

  // ------------------------------------------- estoque: estorno desfaz custo (0011)
  //
  // O caso que motivou reescrever o trigger da 0006: uma compra cara lançada por
  // engano dobra o custo médio, e o estorno precisa devolver o custo ao lugar —
  // não só a quantidade. Sem isso o CMV do mês fica multiplicado, sem nenhuma
  // linha visível explicando por quê.
  const compraErrada = randomUUID()
  await comTenant(A, (tx) =>
    tx`insert into estoque_movimentos
         (id, company_id, produto_id, quantidade, tipo, custo_unitario, fornecedor_id)
       values (${compraErrada}, ${A}, ${agua}, 150, 'compra', 50.00, ${forn})`)
  const [inflado] = await dono`select custo_medio from estoque_saldos where produto_id = ${agua}`
  check('compra cara move o custo médio (150@4,50 + 150@50 = 27,25)',
        Number(inflado.custo_medio) === 27.25, `veio ${inflado.custo_medio}`)

  await comTenant(A, (tx) =>
    tx`insert into estoque_movimentos
         (id, company_id, produto_id, quantidade, tipo, custo_unitario, fornecedor_id, estorno_de)
       values (${randomUUID()}, ${A}, ${agua}, -150, 'compra', 50.00, ${forn}, ${compraErrada})`)
  const [voltou] = await dono`select quantidade, custo_medio from estoque_saldos where produto_id = ${agua}`
  check('estorno devolve o custo médio a 4,50', Number(voltou.custo_medio) === 4.5,
        `veio ${voltou.custo_medio}`)
  check('estorno devolve a quantidade a 150', Number(voltou.quantidade) === 150,
        `veio ${voltou.quantidade}`)

  await deveFalhar(
    'estornar o mesmo movimento duas vezes é rejeitado',
    () => comTenant(A, (tx) =>
      tx`insert into estoque_movimentos
           (id, company_id, produto_id, quantidade, tipo, custo_unitario, fornecedor_id, estorno_de)
         values (${randomUUID()}, ${A}, ${agua}, -150, 'compra', 50.00, ${forn}, ${compraErrada})`),
    'estoque_mov_estorno_unico',
  )

  await deveFalhar(
    'estorno com quantidade diferente do original é rejeitado',
    () => comTenant(A, (tx) =>
      tx`insert into estoque_movimentos
           (id, company_id, produto_id, quantidade, tipo, custo_unitario, estorno_de)
         values (${randomUUID()}, ${A}, ${agua}, -10, 'producao', 4,
                 (select id from estoque_movimentos
                   where produto_id = ${agua} and tipo = 'producao' limit 1))`),
    'quantidade oposta',
  )

  // ------------------------------------------------- estoque: perda vira custo (0011)
  const perdaErrada = randomUUID()
  await comTenant(A, async (tx) => {
    await tx`insert into estoque_movimentos (id, company_id, produto_id, quantidade, tipo, custo_unitario)
             values (${randomUUID()}, ${A}, ${agua}, -20, 'perda', 4.50)`
    await tx`insert into estoque_movimentos (id, company_id, produto_id, quantidade, tipo, custo_unitario)
             values (${perdaErrada}, ${A}, ${agua}, -500, 'perda', 4.50)`
  })
  const [perdaAntes] = await comTenant(A, (tx) =>
    tx`select coalesce(sum(unidades), 0) as unidades from estoque_perdas`)
  check('perda entra na view de custo (20 + 500)', Number(perdaAntes.unidades) === 520,
        `veio ${perdaAntes.unidades}`)

  await comTenant(A, (tx) =>
    tx`insert into estoque_movimentos
         (id, company_id, produto_id, quantidade, tipo, custo_unitario, estorno_de)
       values (${randomUUID()}, ${A}, ${agua}, 500, 'perda', 4.50, ${perdaErrada})`)
  const [perdaDepois] = await comTenant(A, (tx) =>
    tx`select coalesce(sum(unidades), 0) as unidades from estoque_perdas`)
  check('perda estornada sai da view — não custa no DRE para sempre',
        Number(perdaDepois.unidades) === 20, `veio ${perdaDepois.unidades}`)

  // --------------------------------------------------- estoque: exclusão (0015)
  //
  // Excluir não é o espelho do estorno: em vez de somar uma linha nova ao saldo
  // corrente, tira a linha excluída do cálculo e refaz o custo médio do zero a
  // partir do que sobrou — é o que prova que a ordem das entradas continua
  // certa mesmo com uma removida do meio.
  const [antesExclusao] = await dono`
    select quantidade, custo_medio from estoque_saldos where produto_id = ${agua}`

  const compraExcluida = randomUUID()
  await comTenant(A, (tx) =>
    tx`insert into estoque_movimentos
         (id, company_id, produto_id, quantidade, tipo, custo_unitario, fornecedor_id)
       values (${compraExcluida}, ${A}, ${agua}, 50, 'compra', 20.00, ${forn})`)
  const [inflado2] = await dono`select custo_medio from estoque_saldos where produto_id = ${agua}`
  check('compra cara antes de excluir move o custo médio',
        Number(inflado2.custo_medio) !== Number(antesExclusao.custo_medio),
        `veio ${inflado2.custo_medio}`)

  await comTenant(A, (tx) =>
    tx`update estoque_movimentos set excluido_em = now() where id = ${compraExcluida}`)
  const [depoisExclusao] = await dono`
    select quantidade, custo_medio from estoque_saldos where produto_id = ${agua}`
  check('excluir recalcula o saldo do zero, sem a linha excluída',
        Number(depoisExclusao.quantidade) === Number(antesExclusao.quantidade),
        `veio ${depoisExclusao.quantidade}, esperava ${antesExclusao.quantidade}`)
  check('excluir devolve o custo médio de antes da compra',
        Number(depoisExclusao.custo_medio) === Number(antesExclusao.custo_medio),
        `veio ${depoisExclusao.custo_medio}, esperava ${antesExclusao.custo_medio}`)

  await deveFalhar(
    'excluir o mesmo movimento duas vezes é rejeitado',
    () => comTenant(A, (tx) =>
      tx`update estoque_movimentos set excluido_em = now() where id = ${compraExcluida}`),
    'já foi excluído',
  )

  await deveFalhar(
    'apagar movimento de estoque do banco é rejeitado, mesmo excluído pela tela',
    () => comTenant(A, (tx) => tx`delete from estoque_movimentos where id = ${compraExcluida}`),
    'não pode ser apagado',
  )

  const naoExcluido = randomUUID()
  await comTenant(A, (tx) =>
    tx`insert into estoque_movimentos (id, company_id, produto_id, quantidade, tipo, custo_unitario)
       values (${naoExcluido}, ${A}, ${agua}, 5, 'ajuste', 0)`)
  await deveFalhar(
    'alterar quantidade de um movimento não passa pela exceção da exclusão',
    () => comTenant(A, (tx) =>
      tx`update estoque_movimentos set quantidade = 999 where id = ${naoExcluido}`),
    'não pode ser alterado',
  )
  await deveFalhar(
    'marcar excluido_em e mudar outro campo junto é rejeitado',
    () => comTenant(A, (tx) =>
      tx`update estoque_movimentos
           set excluido_em = now(), observacao = 'tentando mudar junto'
         where id = ${naoExcluido}`),
    'não pode ser alterado',
  )

  // ------------------------------------------------------------- financeiro
  await deveFalhar(
    'baixa pela metade em contas a receber é rejeitada',
    () => comTenant(A, (tx) =>
      tx`insert into contas_receber (id, company_id, cliente_id, valor_total, valor_parcela, vencimento, pago_em)
         values (${randomUUID()}, ${A}, ${c1}, 100, 100, current_date, current_date)`),
    'contas_receber_baixa_completa',
  )

  // -------------------------------------------------------- feedbacks (0013)
  const fb1 = randomUUID(), fb2 = randomUUID()
  await comTenant(A, (tx) =>
    tx`insert into feedbacks (id, company_id, tipo, prioridade, titulo, descricao)
       values (${fb1}, ${A}, 'bug', 'alta', 'Prova', 'Descrição de prova com mais de dez caracteres')`)
  await comTenant(B, (tx) =>
    tx`insert into feedbacks (id, company_id, tipo, prioridade, titulo, descricao)
       values (${fb2}, ${B}, 'bug', 'alta', 'Prova B', 'Descrição de prova com mais de dez caracteres')`)

  const feedbacksVistos = await comTenant(A, (tx) => tx`select id from feedbacks`)
  check('tenant A não enxerga feedback de B', feedbacksVistos.length === 1,
        `viu ${feedbacksVistos.length}`)

  await deveFalhar(
    'gravar feedback com company_id alheio é rejeitado',
    () => comTenant(A, (tx) =>
      tx`insert into feedbacks (id, company_id, tipo, prioridade, titulo, descricao)
         values (${randomUUID()}, ${B}, 'bug', 'alta', 'Invasor', 'Descrição de prova com mais de dez caracteres')`),
    'row-level security',
  )

  await deveFalhar(
    'sugestão com prioridade é rejeitada',
    () => comTenant(A, (tx) =>
      tx`insert into feedbacks (id, company_id, tipo, prioridade, titulo, descricao)
         values (${randomUUID()}, ${A}, 'sugestao', 'baixa', 'Prova', 'Descrição de prova com mais de dez caracteres')`),
    'feedbacks_prioridade_por_tipo',
  )

  await deveFalhar(
    'bug sem prioridade é rejeitado',
    () => comTenant(A, (tx) =>
      tx`insert into feedbacks (id, company_id, tipo, titulo, descricao)
         values (${randomUUID()}, ${A}, 'bug', 'Prova', 'Descrição de prova com mais de dez caracteres')`),
    'feedbacks_prioridade_por_tipo',
  )

  // ------------------------------------------- admins da plataforma (0008)
  //
  // A tabela guarda o hash da credencial que abre TODAS as distribuidoras. Se
  // um dia ela ficar legível pela aplicação, nada quebra e nenhum teste
  // reclama — o vazamento é silencioso por natureza. Por isso a prova é
  // explícita, e roda como `casco_app` fora e dentro de tenant.
  const adminId = randomUUID()
  await dono`
    insert into plataforma_admins (id, nome, email, senha_hash)
         values (${adminId}, 'PROVA', ${`prova-${adminId}@exemplo.invalid`}, 'x')
  `

  await deveFalhar(
    'aplicação não consegue ler plataforma_admins',
    () => app`select id from plataforma_admins`,
    'permission denied',
  )
  await deveFalhar(
    'nem dentro de um tenant',
    () => comTenant(A, (tx) => tx`select id from plataforma_admins`),
    'permission denied',
  )

  // O caminho legítimo continua aberto: a porta estreita `security definer`.
  // Sem esta checagem, revogar demais passaria por "mais seguro" e derrubaria
  // o login de admin em produção.
  const achado = await app`select id from admin_find(${`prova-${adminId}@exemplo.invalid`})`
  check('admin_find continua funcionando para a aplicação',
        achado[0]?.id === adminId, `veio ${achado[0]?.id}`)

  // -------------------------------------------- config da plataforma (0014)
  //
  // A tabela é singleton e real — não tem "empresa de prova A/B" para isolar
  // o teste. Por isso o valor original é lido antes e devolvido depois, com
  // `finally`: rodar esta prova contra um ambiente onde alguém já configurou
  // o webhook de verdade não pode apagar essa configuração.
  const [original] = await dono`select discord_webhook_feedback from plataforma_config`
  try {
    await deveFalhar(
      'aplicação não consegue ler plataforma_config direto',
      () => app`select id from plataforma_config`,
      'permission denied',
    )

    await app`select plataforma_config_salvar(${'https://discord.com/api/webhooks/1/prova'})`
    const [cfgSalva] = await app`select * from plataforma_config_ler()`
    check('plataforma_config_salvar grava e plataforma_config_ler lê de volta',
          cfgSalva?.discord_webhook_feedback === 'https://discord.com/api/webhooks/1/prova',
          `veio ${cfgSalva?.discord_webhook_feedback}`)

    await app`select plataforma_config_salvar(${null})`
    const [cfgLimpa] = await app`select * from plataforma_config_ler()`
    check('salvar com vazio limpa a configuração', cfgLimpa?.discord_webhook_feedback === null,
          `veio ${cfgLimpa?.discord_webhook_feedback}`)
  } finally {
    await dono`update plataforma_config set discord_webhook_feedback = ${original?.discord_webhook_feedback ?? null}`
  }

  // `admin_listar_empresas` roda como dono e por isso enxerga as duas empresas
  // de teste — é justamente o poder que o painel precisa e que a RLS negaria.
  const listadas = await app`select id from admin_listar_empresas()`
  const ids = listadas.map((l) => l.id)
  check('admin_listar_empresas enxerga além da RLS',
        ids.includes(A) && ids.includes(B), `viu ${listadas.length} empresas`)
} catch (err) {
  falhas.push(`ERRO INESPERADO: ${err.message}`)
} finally {
  // Sem `catch` silencioso: faxina que falha deixa dado de teste no banco, e a
  // rodada seguinte quebra num lugar que não tem nada a ver com a causa.
  await limpar().catch((err) => falhas.push(`faxina falhou: ${err.message}`))
  await app.end({ timeout: 5 }).catch(() => {})
  await dono.end({ timeout: 5 }).catch(() => {})
}

console.log(`\n✓ ${ok.length} passaram`)
for (const o of ok) console.log(`   ${o}`)
if (falhas.length) {
  console.log(`\n✗ ${falhas.length} FALHARAM`)
  for (const f of falhas) console.log(`   ${f}`)
  process.exitCode = 1
}
