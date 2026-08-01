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
const NOME_COOKIE_ADMIN = 'casco_admin'
const chave = new TextEncoder().encode(process.env.AUTH_SECRET)

/** Espelha `AUD_TRABALHO` / `AUD_ADMIN` do `lib/sessao.ts`. Duplicado porque o
 *  proxy não pode importar de lá: aquele arquivo é `server-only` e lê
 *  `cookies()`, que aqui não existe — o request chega por parâmetro. */
const AUD_TRABALHO = 'casco:sessao'
const AUD_ADMIN = 'casco:admin'

async function ler(req: NextRequest, cookie: string, audience: string) {
  const token = req.cookies.get(cookie)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, chave, { algorithms: ['HS256'], audience })
    return payload
  } catch {
    return null
  }
}

export async function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const [sessao, admin] = await Promise.all([
    ler(req, NOME_COOKIE, AUD_TRABALHO),
    ler(req, NOME_COOKIE_ADMIN, AUD_ADMIN),
  ])

  const noLogin = pathname === '/login'
  const noAdmin = pathname === '/admin' || pathname.startsWith('/admin/')
  const naTrocaDeSenha = pathname === '/admin/senha'

  // Senha provisória tranca tudo, inclusive a área de negócio. Vem antes de
  // qualquer outra regra de propósito: enquanto a senha que nós entregamos
  // ainda vale, o alcance dela precisa ser uma tela só.
  if (admin?.trocaSenha === true && !naTrocaDeSenha) {
    return NextResponse.redirect(new URL('/admin/senha', req.url))
  }

  if (noLogin) {
    // Sessão de trabalho ganha do painel: admin que já escolheu a empresa volta
    // para dentro dela, não para a lista.
    if (sessao) return NextResponse.redirect(new URL('/painel', req.url))
    if (admin) return NextResponse.redirect(new URL('/admin', req.url))
    return NextResponse.next()
  }

  if (noAdmin) {
    // Sem `destino` na volta: quem não é admin não precisa nem descobrir que
    // estas telas existem, e devolver a URL na query seria contar.
    if (!admin) return NextResponse.redirect(new URL('/login', req.url))
    return NextResponse.next()
  }

  if (!sessao) {
    // Admin sem empresa escolhida cai no painel dele, não no login: está
    // autenticado, só não está em lugar nenhum ainda.
    if (admin) return NextResponse.redirect(new URL('/admin', req.url))

    const url = new URL('/login', req.url)
    // Guarda para onde a pessoa estava indo. Sessão que expira no meio do
    // expediente devolve à tela em que ela estava, não ao painel — quem estava
    // conferindo a lista de vencidos volta para a lista de vencidos.
    if (pathname !== '/') url.searchParams.set('destino', pathname + search)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  // Tudo, menos os assets e a rota de API interna do Next. `_next/image` e
  // `favicon.ico` fora da lista fariam o guard rodar em cada ícone da sidebar.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)'],
}
