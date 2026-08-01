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
    'tabelas_preco', 'formas_pagamento', 'contas_bancarias', 'sequencias',
  ]) {
    await dono.unsafe(`delete from ${t} where company_id in ('${A}','${B}')`)
  }
  await dono`delete from companies where id in (${A}, ${B})`
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
  // DRE para sempre, e teríamos trocado a receita inflada do sistema antigo
  // por um custo inflado no nosso.
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
             values (${randomUUID()}, ${A}, ${agua}, 100, 'entrada', 4.00)`
    await tx`insert into estoque_movimentos (id, company_id, produto_id, quantidade, tipo, custo_unitario)
             values (${randomUUID()}, ${A}, ${agua}, 100, 'entrada', 5.00)`
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

  // ------------------------------------------------------------- financeiro
  await deveFalhar(
    'baixa pela metade em contas a receber é rejeitada',
    () => comTenant(A, (tx) =>
      tx`insert into contas_receber (id, company_id, cliente_id, valor_total, valor_parcela, vencimento, pago_em)
         values (${randomUUID()}, ${A}, ${c1}, 100, 100, current_date, current_date)`),
    'contas_receber_baixa_completa',
  )
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
