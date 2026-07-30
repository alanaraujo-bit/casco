import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

/**
 * Guard de navegação.
 *
 * Nesta versão do Next o antigo `middleware.ts` chama-se `proxy.ts`, com export
 * nomeado `proxy` e runtime `nodejs` fixo (sem edge).
 *
 * **Isto não é a camada de segurança.** É o que evita a tela piscar: sem sessão,
 * a pessoa vai para o login antes de a página começar a renderizar. Quem
 * protege o dado é o `comTenant()` do `lib/dal.ts`, no servidor, junto da query
 * — e, abaixo dele, a RLS do Postgres. Confiar no proxy para autorizar é o erro
 * clássico: basta uma rota nova fora do `matcher` para o dado vazar.
 *
 * Verifica a assinatura em vez de só checar se o cookie existe: com runtime
 * nodejs isso é barato, e evita mandar para o painel alguém com um token
 * expirado que só seria rejeitado uma navegação depois.
 */

const NOME_COOKIE = 'casco_sessao'
const chave = new TextEncoder().encode(process.env.AUTH_SECRET)

async function temSessaoValida(req: NextRequest) {
  const token = req.cookies.get(NOME_COOKIE)?.value
  if (!token) return false
  try {
    await jwtVerify(token, chave, { algorithms: ['HS256'] })
    return true
  } catch {
    return false
  }
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const autenticado = await temSessaoValida(req)
  const noLogin = pathname === '/login'

  if (!autenticado && !noLogin) {
    const url = new URL('/login', req.url)
    // Guarda para onde a pessoa estava indo. Sessão que expira no meio do
    // expediente devolve à tela em que ela estava, não ao painel — quem estava
    // conferindo a lista de vencidos volta para a lista de vencidos.
    if (pathname !== '/') url.searchParams.set('destino', pathname + search)
    return NextResponse.redirect(url)
  }

  if (autenticado && noLogin) {
    return NextResponse.redirect(new URL('/painel', req.url))
  }

  return NextResponse.next()
}

export const config = {
  // Tudo, menos os assets e a rota de API interna do Next. `_next/image` e
  // `favicon.ico` fora da lista fariam o guard rodar em cada ícone da sidebar.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
}
