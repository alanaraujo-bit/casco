/**
 * Zera os dados de operação de uma empresa, mantendo-a utilizável.
 *
 * Existe porque "recomeçar do zero" é uma operação de desenvolvimento que
 * acontece o tempo todo — testar um fluxo, sujar o banco, querer a tela limpa
 * de novo — e fazê-la na mão, com `delete` solto no psql, é como se apaga a
 * empresa errada às onze da noite.
 *
 * **O que sai:** cliente, fornecedor, produto, preço, venda, título, caixa,
 * estoque e vasilhame. Tudo que a operadora lançou.
 *
 * **O que fica:** a empresa, os usuários (o login continua funcionando), e a
 * configuração que nasce junto com a empresa — tabelas de preço, formas de
 * pagamento e contas bancárias. Sem elas o PDV não fecha venda nenhuma, e
 * "zerado" viraria "quebrado".
 *
 * Movimento de estoque e de vasilhame são imutáveis por trigger, inclusive
 * para o dono do banco. Por isso o `session_replication_role = 'replica'`: é o
 * modo que o Postgres usa em réplica de streaming, em que trigger de usuário
 * não dispara. Mesmo recurso que a faxina do `provar-schema.mjs` usa.
 *
 *     node scripts/zerar-dados.mjs --todas --confirmar
 *     node scripts/zerar-dados.mjs --empresa "JM Distribuidora Natuclara" --confirmar
 *
 * Sem `--confirmar` o script só mostra o que apagaria e sai sem tocar em nada.
 */
import postgres from 'postgres'

const args = process.argv.slice(2)
const arg = (nome) => {
  const i = args.indexOf(`--${nome}`)
  return i >= 0 ? args[i + 1] : undefined
}
const tem = (nome) => args.includes(`--${nome}`)

const TODAS = tem('todas')
const EMPRESA = arg('empresa')
const CONFIRMAR = tem('confirmar')

if (!TODAS && !EMPRESA) {
  console.error('Uso: node scripts/zerar-dados.mjs (--todas | --empresa "Nome") [--confirmar]')
  process.exit(1)
}

const url = process.env.DIRECT_DATABASE_URL
if (!url) {
  console.error('DIRECT_DATABASE_URL não definida. Rode com --env-file-if-exists=.env.local')
  process.exit(1)
}

const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 30, onnotice() {} })

/**
 * Ordem importa: filho antes de pai. `precos` antes de `produtos` porque a
 * linha de preço aponta para o produto; `venda_itens` antes de `vendas`; e
 * assim por diante até `clientes`, que é referenciado por quase tudo.
 *
 * `sequencias` entra porque é o contador de código: mantê-lo faria o próximo
 * cliente nascer 0007 num sistema que não tem nenhum — o oposto de zerado.
 */
const TABELAS = [
  'estoque_movimentos',
  'estoque_saldos',
  'vasilhame_movimentos',
  'vasilhame_saldos',
  'pagamentos',
  'venda_itens',
  'vendas',
  'contas_receber',
  'contas_pagar',
  'caixa_movimentos',
  'precos',
  'produtos',
  'clientes',
  'fornecedores',
  'sequencias',
]

try {
  const empresas = TODAS
    ? await sql`select id, nome from companies order by criado_em`
    : await sql`select id, nome from companies where nome = ${EMPRESA}`

  if (empresas.length === 0) {
    console.error(EMPRESA ? `Empresa "${EMPRESA}" não encontrada.` : 'Nenhuma empresa no banco.')
    process.exit(1)
  }

  // Contagem antes: é o que o modo de simulação mostra, e o que confirma
  // depois que a limpeza fez o que disse que faria.
  let total = 0
  console.log(CONFIRMAR ? '\n=== APAGANDO ===' : '\n=== SIMULAÇÃO (sem --confirmar, nada é apagado) ===')
  for (const e of empresas) {
    console.log(`\n[${e.nome}]`)
    for (const t of TABELAS) {
      const [{ n }] = await sql.unsafe(
        `select count(*)::int as n from ${t} where company_id = '${e.id}'`,
      )
      if (n > 0) {
        console.log(`  ${t}: ${n}`)
        total += n
      }
    }
  }

  if (total === 0) {
    console.log('\nNada a apagar — já está zerado.')
    await sql.end()
    process.exit(0)
  }

  if (!CONFIRMAR) {
    console.log(`\n${total} linha(s) seriam apagadas. Rode de novo com --confirmar.`)
    await sql.end()
    process.exit(0)
  }

  await sql`set session_replication_role = 'replica'`
  for (const e of empresas) {
    for (const t of TABELAS) {
      await sql.unsafe(`delete from ${t} where company_id = '${e.id}'`)
    }
  }
  await sql`set session_replication_role = 'origin'`

  // Releitura depois de apagar: contar de novo é o que separa "o delete rodou"
  // de "o delete funcionou". Um trigger reativando algo, ou uma tabela fora da
  // lista, apareceria aqui e em nenhum outro lugar.
  let sobrou = 0
  for (const e of empresas) {
    for (const t of TABELAS) {
      const [{ n }] = await sql.unsafe(
        `select count(*)::int as n from ${t} where company_id = '${e.id}'`,
      )
      sobrou += n
    }
  }

  console.log(
    sobrou === 0
      ? `\n✓ ${total} linha(s) apagadas. Empresas, usuários e configuração base intactos.`
      : `\n✗ ainda restam ${sobrou} linha(s) — confira a lista de tabelas.`,
  )
  process.exitCode = sobrou === 0 ? 0 : 1
} catch (err) {
  console.error('ERRO:', err.message)
  process.exitCode = 1
} finally {
  await sql.end()
}
