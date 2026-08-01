/**
 * Provisiona um administrador da Aionix.
 *
 * Não é usuário de distribuidora — é quem opera o Casco por dentro e consegue
 * entrar em qualquer empresa. Ver `migrations/0008_admins_plataforma.sql`.
 *
 *     npm run admin:criar -- --nome "Rafael Araújo" --email rafael@aionixdev.com
 *
 * A senha é provisória por construção: `senha_provisoria = true`, e o sistema
 * tranca a pessoa na tela de troca até ela escolher a definitiva. Por isso o
 * `--senha` é opcional e sorteado quando ausente — senha provisória digitada
 * pelo provisionador é senha que ele conhece, e o objetivo é que ela viva
 * poucos minutos e ninguém a reutilize.
 *
 * Idempotente pelo e-mail: rodar de novo devolve a pessoa ao estado de
 * primeiro acesso com uma senha provisória nova. É também o caminho de
 * "esqueci minha senha" enquanto não existe recuperação por e-mail.
 *
 * Roda como dono do banco (DIRECT_DATABASE_URL) porque `plataforma_admins` é
 * invisível para `casco_app` — de propósito.
 */
import postgres from 'postgres'
import bcrypt from 'bcryptjs'
import { uuidv7 } from 'uuidv7'
import { randomInt } from 'node:crypto'

const args = process.argv.slice(2)
const arg = (nome) => {
  const i = args.indexOf(`--${nome}`)
  return i >= 0 ? args[i + 1] : undefined
}

const nome = arg('nome')
const email = arg('email')?.trim().toLowerCase()

if (!nome || !email) {
  console.error(
    'Uso: npm run admin:criar -- --nome "Rafael Araújo" --email rafael@aionixdev.com\n' +
      '     opcional: --senha "provisoria" (sorteada se omitida)',
  )
  process.exit(1)
}

/**
 * Alfabeto sem `0OoIl1` e sem símbolo.
 *
 * Esta senha vai ser lida em voz alta ou colada num WhatsApp e digitada uma vez
 * na vida. `l` contra `1` num celular é dois minutos perdidos achando que o
 * login quebrou. Tira-se ambiguidade e compensa-se no comprimento.
 */
const ALFABETO = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const sortear = (n = 14) =>
  Array.from({ length: n }, () => ALFABETO[randomInt(ALFABETO.length)]).join('')

const senha = arg('senha') ?? sortear()

if (senha.length < 10) {
  console.error('A senha provisória precisa de pelo menos 10 caracteres.')
  process.exit(1)
}

const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
if (!url) {
  console.error('DIRECT_DATABASE_URL não definida. Veja .env.example.')
  process.exit(1)
}

const sql = postgres(url, { max: 1, prepare: false, onnotice() {} })

/** Custo 12, igual ao resto do sistema. Ver `scripts/criar-empresa.mjs`. */
const CUSTO_BCRYPT = 12

try {
  const hash = await bcrypt.hash(senha, CUSTO_BCRYPT)

  const [linha] = await sql`
    insert into plataforma_admins (id, nome, email, senha_hash)
         values (${uuidv7()}, ${nome}, ${email}, ${hash})
    on conflict (lower(email)) do update
            set nome = excluded.nome,
                senha_hash = excluded.senha_hash,
                senha_provisoria = true,
                ativo = true
      returning id, (xmax = 0) as criado
  `

  console.log(linha.criado ? `Admin "${nome}" criado.` : `Admin "${nome}" atualizado.`)
  console.log(`  E-mail:          ${email}`)
  console.log(`  Senha provisória: ${senha}`)
  console.log('\n  No primeiro acesso o sistema exige trocar esta senha antes de qualquer tela.')
} catch (err) {
  console.error('FALHOU:', err.message)
  process.exitCode = 1
} finally {
  await sql.end({ timeout: 5 })
}
