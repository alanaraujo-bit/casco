/**
 * Renomeia uma distribuidora e audita vestígios do nome antigo no banco.
 *
 * Existe porque o nome da empresa é dado, não código: trocar o texto no
 * repositório não muda o que a topbar mostra nem o que o seletor da Aionix
 * lista. Quem grava é o `empresa:criar`, e ele só sabe criar.
 *
 *     npm run empresa:renomear -- --de "LM Distribuidora" --para "JM Distribuidora Natuclara"
 *     npm run empresa:renomear -- --auditar "LM"
 *
 * `--de` casa por trecho, sem diferenciar maiúscula. Se casar com mais de uma
 * empresa o script para e lista as candidatas, em vez de escolher por você —
 * numa instalação multi-tenant, renomear a empresa errada é dado de cliente
 * trocado. Com uma única empresa no banco, `--de` pode ser omitido.
 *
 * Depois de renomear, varre toda coluna de texto do schema `public` atrás do
 * nome antigo e imprime o que sobrou. Nome de empresa vaza para lugares que
 * ninguém lembra: e-mail do dono, observação de venda, nome de produto.
 *
 * Roda como dono do banco (DIRECT_DATABASE_URL) porque `companies` é a tabela
 * sem tenant a que se apoiar, e a auditoria lê tabela de todas as empresas.
 */
import postgres from 'postgres'

const args = process.argv.slice(2)
const arg = (nome) => {
  const i = args.indexOf(`--${nome}`)
  return i >= 0 ? args[i + 1] : undefined
}

const de = arg('de')
const para = arg('para')
const auditar = arg('auditar')

if (!para && !auditar) {
  console.error(
    'Uso: npm run empresa:renomear -- --de "Nome Antigo" --para "Nome Novo"\n' +
      '     npm run empresa:renomear -- --auditar "trecho"   (só varre, não escreve)',
  )
  process.exit(1)
}

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
if (!url) {
  console.error('DIRECT_DATABASE_URL não definida. Veja .env.example.')
  process.exit(1)
}

const sql = postgres(url, { max: 1, prepare: false, onnotice() {} })

/** Aspas duplas em identificador vindo do catálogo. O nome da tabela não é
 *  entrada do usuário, mas concatenar identificador sem citar é o hábito que um
 *  dia encontra uma coluna chamada `order`. O termo buscado vai por parâmetro. */
const ident = (nome) => `"${nome.replaceAll('"', '""')}"`

/**
 * Procura `termo` em toda coluna textual do schema `public`.
 *
 * Uma query por coluna é ineficiente e tudo bem: roda uma vez, à mão, num banco
 * de dezenas de milhares de linhas. Clareza vale mais que o milissegundo.
 */
async function varrer(termo) {
  const colunas = await sql`
    select table_name, column_name
      from information_schema.columns
     where table_schema = 'public'
       and table_name in (select tablename from pg_tables where schemaname = 'public')
       and data_type in ('character varying', 'text', 'character')
     order by table_name, column_name
  `

  const achados = []
  for (const { table_name: tabela, column_name: coluna } of colunas) {
    // Amostra junto com a contagem: saber que "sobrou algo em users.email" sem
    // ver o quê obriga a abrir o banco à mão, que é justamente o que o script
    // evita. Três valores bastam para decidir se é vestígio ou falso positivo.
    const linhas = await sql.unsafe(
      `select distinct ${ident(coluna)} as valor
         from ${ident(tabela)}
        where ${ident(coluna)} ilike $1
        limit 4`,
      [`%${termo}%`],
    )
    if (linhas.length > 0) achados.push({ tabela, coluna, valores: linhas.map((l) => l.valor) })
  }
  return achados
}

try {
  if (para) {
    const candidatas = de
      ? await sql`select id, nome from companies where nome ilike ${'%' + de + '%'} order by nome`
      : await sql`select id, nome from companies order by nome`

    if (candidatas.length === 0) {
      console.error(de ? `Nenhuma empresa casa com "${de}".` : 'Não há empresas no banco.')
      process.exit(1)
    }
    if (candidatas.length > 1) {
      console.error('Mais de uma empresa casa — refine o `--de`:')
      for (const c of candidatas) console.error(`  ${c.nome}`)
      process.exit(1)
    }

    const alvo = candidatas[0]
    if (alvo.nome === para) {
      console.log(`"${para}" já é o nome gravado. Nada a fazer.`)
    } else {
      await sql`update companies set nome = ${para} where id = ${alvo.id}`
      console.log(`Renomeada: "${alvo.nome}" → "${para}"`)
    }
  }

  const termo = auditar ?? de
  if (termo) {
    const achados = await varrer(termo)
    if (achados.length === 0) {
      console.log(`\nAuditoria: nenhum vestígio de "${termo}" no banco.`)
    } else {
      console.log(`\nAuditoria — "${termo}" ainda aparece em:`)
      for (const a of achados) {
        const amostra = a.valores.slice(0, 3).join(', ')
        const reticencia = a.valores.length > 3 ? ', …' : ''
        console.log(`  ${a.tabela}.${a.coluna}  →  ${amostra}${reticencia}`)
      }
    }
  }
} catch (err) {
  console.error('FALHOU:', err.message)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
