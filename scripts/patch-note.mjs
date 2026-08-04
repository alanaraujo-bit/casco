/**
 * Cria (e, opcionalmente, publica) uma novidade da Central de Atualizações.
 *
 * Uso do dia a dia, antes de um push que muda o que o cliente vê ou faz —
 * ver o parágrafo sobre isso no `AGENTS.md`. É o mesmo espírito de
 * `scripts/capturar-ajuda.mjs`: uma ferramenta de desenvolvimento, rodada por
 * quem está fazendo o trabalho, não um serviço em produção lendo commit
 * sozinho. Ninguém além de quem chama este script decide o texto — "não
 * invente" continua valendo.
 *
 *     node scripts/patch-note.mjs \
 *       --titulo "Cupom de venda para o cliente" \
 *       --resumo "A venda agora gera um cupom com endereço e itens" \
 *       --categoria melhoria \
 *       --corpo "Depois de fechar uma venda, o Casco monta um cupom pronto para imprimir..." \
 *       --admin-email alan@aionixdev.com \
 *       --publicar
 *
 * `--corpo-arquivo caminho.md` no lugar de `--corpo` quando o texto for
 * longo o bastante para incomodar na linha de comando. `--commits abc123
 * def456` é só rastro de auditoria — não trava nada se os hashes não
 * existirem mais localmente.
 *
 * Sem `--publicar`, nasce como rascunho: revisar pela tela `/admin/patch-notes`
 * antes de publicar continua sendo o caminho de quem quer conferir o texto
 * fora do terminal.
 *
 * Roda como dono do banco (DIRECT_DATABASE_URL) porque `patch_notes` é
 * invisível para `casco_app` fora das funções `security definer` — mesmo
 * desenho de `scripts/criar-admin.mjs` para `plataforma_admins`.
 */
import postgres from 'postgres'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'

const args = process.argv.slice(2)
const arg = (nome) => {
  const i = args.indexOf(`--${nome}`)
  return i >= 0 ? args[i + 1] : undefined
}
const flag = (nome) => args.includes(`--${nome}`)

const titulo = arg('titulo')
const resumo = arg('resumo')
const categoria = arg('categoria')
const adminEmail = arg('admin-email')?.trim().toLowerCase()
const corpoArquivo = arg('corpo-arquivo')
const commits = arg('commits')?.split(/\s+/).filter(Boolean) ?? []
const publicar = flag('publicar')

const CATEGORIAS = ['novo', 'melhoria', 'correcao', 'desempenho', 'seguranca', 'interface']

if (!titulo || !resumo || !categoria || !adminEmail || (!arg('corpo') && !corpoArquivo)) {
  console.error(
    'Uso: node scripts/patch-note.mjs --titulo "..." --resumo "..." --categoria melhoria ' +
      '(--corpo "..." | --corpo-arquivo caminho.md) --admin-email alguem@aionixdev.com\n' +
      '     opcional: --publicar, --commits "abc123 def456"\n\n' +
      `Categorias válidas: ${CATEGORIAS.join(', ')}`,
  )
  process.exit(1)
}

if (!CATEGORIAS.includes(categoria)) {
  console.error(`Categoria inválida: ${categoria}. Use uma de: ${CATEGORIAS.join(', ')}`)
  process.exit(1)
}

const corpo = corpoArquivo ? await readFile(corpoArquivo, 'utf8') : arg('corpo')

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
if (!url) {
  console.error('DIRECT_DATABASE_URL não definida. Veja .env.example.')
  process.exit(1)
}

const sql = postgres(url, { max: 1, prepare: false, onnotice() {} })

const slug = () =>
  `${titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)}-${randomUUID().slice(0, 8)}`

try {
  const [admin] = await sql`select id, nome from plataforma_admins where lower(email) = ${adminEmail} and ativo`
  if (!admin) {
    console.error(`Nenhum admin ativo com o e-mail ${adminEmail}. Veja npm run admin:criar.`)
    process.exit(1)
  }

  const [{ patch_notes_admin_criar: id }] = await sql`
    select patch_notes_admin_criar(
      ${randomUUID()}, ${slug()}, ${titulo}, ${resumo}, ${corpo}, ${categoria}, ${commits}, ${admin.id}
    )
  `

  console.log(`[patch-note] criado como rascunho — id ${id}`)

  if (publicar) {
    await sql`select patch_notes_admin_mudar_status(${id}, 'publicado', ${admin.id})`
    console.log(`[patch-note] publicado por ${admin.nome}`)
  } else {
    console.log('[patch-note] revise em /admin/patch-notes antes de publicar')
  }
} finally {
  await sql.end({ timeout: 5 }).catch(() => {})
}
