import 'server-only'

import { cookies } from 'next/headers'
import { SignJWT, jwtVerify } from 'jose'
import type { Papel } from '@/db/schema'

/**
 * Sessão em cookie assinado (JWT HS256), sem tabela de sessão no banco.
 *
 * **Por que não Auth.js**, que o roadmap previa na Etapa 0.3: a LM tem login por
 * e-mail e senha e nada mais — sem Google, sem magic link, sem OAuth. O que
 * sobraria do Auth.js seria o provider de credenciais, que é justamente a parte
 * que ele pede para você escrever inteira. Trocaríamos ~80 linhas explícitas por
 * uma dependência em beta acoplada a uma versão do Next que acabou de renomear
 * o middleware. O ganho apareceria no dia em que precisássemos de OAuth — e aí
 * a troca é local, porque tudo que o resto do sistema conhece é `lerSessao()`.
 *
 * O `company_id` viaja no cookie porque é o que o `withTenant()` precisa em
 * toda requisição. Cookie assinado: adulterar o tenant quebra a assinatura e a
 * verificação falha. Sem assinatura válida, não há sessão — e sem sessão o
 * `app.company_id` nunca é definido, então a RLS nega tudo. Duas travas
 * independentes para o mesmo erro.
 */

const NOME_COOKIE = 'casco_sessao'
const NOME_COOKIE_ADMIN = 'casco_admin'

/** 14 dias. Balanço entre não relogar toda semana e não deixar sessão eterna
 *  num sistema que mostra faturamento. Renovada a cada acesso. */
const DURACAO_MS = 14 * 24 * 60 * 60 * 1000

/**
 * 12 horas para a sessão de admin, contra 14 dias para a de trabalho.
 *
 * Não é rigor decorativo: esta credencial abre *qualquer* distribuidora. O
 * balconista que fica logado duas semanas alcança só a própria empresa; um
 * notebook nosso esquecido aberto alcança todas elas. Doze horas cobrem um dia
 * de trabalho e expiram antes do dia seguinte.
 */
const DURACAO_ADMIN_MS = 12 * 60 * 60 * 1000

const segredo = process.env.AUTH_SECRET
if (!segredo) {
  throw new Error('AUTH_SECRET não definida. Gere com `npx auth secret` e veja .env.example.')
}
const chave = new TextEncoder().encode(segredo)

export interface Sessao {
  usuarioId: string
  companyId: string
  papel: Papel
  /** Só para exibir na topbar. Se o nome mudar, atualiza no próximo login. */
  nome: string
  empresa: string
  /**
   * Presente quando quem está dentro da distribuidora é um admin da Aionix, e
   * não um funcionário dela. Serve para a faixa de aviso no topo — ninguém
   * pode lançar achando que está na empresa errada — e para o caminho de volta.
   */
  adminId?: string
}

/**
 * Identidade de quem trabalha na Aionix, em cookie separado da sessão de trabalho.
 *
 * **Dois cookies, e é essa decisão que sustenta o resto.** A alternativa era um
 * cookie só, com `companyId` anulável — e aí `comTenant()` passaria a receber
 * `string | null`, e cada módulo de negócio herdaria um caso "sem empresa" que
 * não existe para eles. Separando, a sessão de trabalho continua exatamente o
 * que sempre foi: sempre tem empresa, sempre tem tenant, nada a mudar abaixo.
 *
 * Na prática:
 * - admin entra → só `casco_admin`. Não está em empresa nenhuma, nenhuma query
 *   de negócio roda.
 * - admin abre uma distribuidora → ganha **também** `casco_sessao`, comum, com
 *   o `company_id` daquela empresa. Daí para baixo o sistema não sabe — nem
 *   precisa saber — que ali dentro tem um admin. A RLS trata igual.
 * - admin volta ao painel → apaga só `casco_sessao`; a identidade permanece.
 */
export interface SessaoAdmin {
  adminId: string
  nome: string
  email: string
  /** Ainda está na senha provisória: o guard tranca tudo menos a tela de troca. */
  trocaSenha: boolean
}

/**
 * Os dois cookies são assinados com a mesma chave, então o `aud` é o que
 * impede um de passar por outro. Sem ele, colar o conteúdo de `casco_sessao`
 * dentro de `casco_admin` produziria um token com assinatura perfeitamente
 * válida — e a validação só olharia se os campos existem. O `jwtVerify`
 * abaixo exige a audiência certa e rejeita a troca antes de ler qualquer campo.
 */
const AUD_TRABALHO = 'casco:sessao'
const AUD_ADMIN = 'casco:admin'

async function assinar(dados: object, aud: string, expiraEm: Date) {
  return new SignJWT({ ...dados })
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(expiraEm)
    .sign(chave)
}

/**
 * Lê e valida a sessão do cookie. `null` quando não há sessão válida — token
 * ausente, assinatura inválida ou expirado dão todos no mesmo resultado, de
 * propósito: quem chama não deve tomar decisão diferente por causa disso.
 */
export async function lerSessao(): Promise<Sessao | null> {
  const token = (await cookies()).get(NOME_COOKIE)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, chave, {
      algorithms: ['HS256'],
      audience: AUD_TRABALHO,
    })
    const { usuarioId, companyId, papel, nome, empresa, adminId } =
      payload as Record<string, unknown>

    if (typeof usuarioId !== 'string' || typeof companyId !== 'string') return null

    return {
      usuarioId,
      companyId,
      papel: papel as Papel,
      nome: String(nome ?? ''),
      empresa: String(empresa ?? ''),
      adminId: typeof adminId === 'string' ? adminId : undefined,
    }
  } catch {
    return null
  }
}

/** Opções iguais para os dois cookies — divergir aqui é como um deles vira o
 *  elo fraco sem ninguém notar. */
function opcoesCookie(expiraEm: Date) {
  return {
    httpOnly: true,
    // Em `localhost` o navegador recusa cookie `secure` sobre http, e o login
    // entraria em laço: a action grava, o cookie some, o guard manda pro login.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    expires: expiraEm,
    path: '/',
  }
}

export async function criarSessao(sessao: Sessao) {
  const expiraEm = new Date(Date.now() + DURACAO_MS)
  const token = await assinar(sessao, AUD_TRABALHO, expiraEm)
  ;(await cookies()).set(NOME_COOKIE, token, opcoesCookie(expiraEm))
}

export async function encerrarSessao() {
  ;(await cookies()).delete(NOME_COOKIE)
}

// ------------------------------------------------------------------- admin

export async function lerSessaoAdmin(): Promise<SessaoAdmin | null> {
  const token = (await cookies()).get(NOME_COOKIE_ADMIN)?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, chave, {
      algorithms: ['HS256'],
      audience: AUD_ADMIN,
    })
    const { adminId, nome, email, trocaSenha } = payload as Record<string, unknown>

    if (typeof adminId !== 'string') return null

    return {
      adminId,
      nome: String(nome ?? ''),
      email: String(email ?? ''),
      // `=== true` e não coerção: um token antigo sem o campo precisa cair em
      // `false` e não em `undefined`, senão o guard da troca de senha compara
      // contra algo que não é booleano.
      trocaSenha: trocaSenha === true,
    }
  } catch {
    return null
  }
}

export async function criarSessaoAdmin(admin: SessaoAdmin) {
  const expiraEm = new Date(Date.now() + DURACAO_ADMIN_MS)
  const token = await assinar(admin, AUD_ADMIN, expiraEm)
  ;(await cookies()).set(NOME_COOKIE_ADMIN, token, opcoesCookie(expiraEm))
}

export async function encerrarSessaoAdmin() {
  ;(await cookies()).delete(NOME_COOKIE_ADMIN)
}
