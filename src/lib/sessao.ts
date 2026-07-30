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

/** 14 dias. Balanço entre não relogar toda semana e não deixar sessão eterna
 *  num sistema que mostra faturamento. Renovada a cada acesso. */
const DURACAO_MS = 14 * 24 * 60 * 60 * 1000

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
}

async function assinar(sessao: Sessao, expiraEm: Date) {
  return new SignJWT({ ...sessao })
    .setProtectedHeader({ alg: 'HS256' })
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
    const { payload } = await jwtVerify(token, chave, { algorithms: ['HS256'] })
    const { usuarioId, companyId, papel, nome, empresa } = payload as Record<string, unknown>

    if (typeof usuarioId !== 'string' || typeof companyId !== 'string') return null

    return {
      usuarioId,
      companyId,
      papel: papel as Papel,
      nome: String(nome ?? ''),
      empresa: String(empresa ?? ''),
    }
  } catch {
    return null
  }
}

export async function criarSessao(sessao: Sessao) {
  const expiraEm = new Date(Date.now() + DURACAO_MS)
  const token = await assinar(sessao, expiraEm)

  ;(await cookies()).set(NOME_COOKIE, token, {
    httpOnly: true,
    // Em `localhost` o navegador recusa cookie `secure` sobre http, e o login
    // entraria em laço: a action grava, o cookie some, o guard manda pro login.
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: expiraEm,
    path: '/',
  })
}

export async function encerrarSessao() {
  ;(await cookies()).delete(NOME_COOKIE)
}
