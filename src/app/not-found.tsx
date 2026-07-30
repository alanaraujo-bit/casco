import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { lerSessao } from '@/lib/sessao'

/**
 * 404 do sistema inteiro.
 *
 * Envolve o `AppShell` explicitamente porque o boundary de `not-found` da raiz
 * não passa pelo layout do grupo `(app)`. Tentar resolver pela convenção —
 * um `not-found.tsx` dentro de `(app)` ou de `[...secao]` — não funciona:
 * grupo de rota não cria segmento de URL, e o boundary da raiz vence de
 * qualquer forma. Ambas as tentativas viraram arquivo morto antes desta.
 *
 * Importa porque um erro de digitação na URL não deveria jogar o usuário para
 * fora da navegação: com o shell, ele volta ao trabalho pelo menu, sem
 * precisar do botão.
 */
export default async function NaoEncontrado() {
  // `lerSessao` e não `exigirSessao`: redirecionar de dentro de um boundary de
  // erro é como se cria laço de navegação. Sem sessão, o shell aparece sem o
  // menu de conta — e o proxy já teria mandado essa pessoa para o login.
  const sessao = await lerSessao()

  return (
    <AppShell
      usuario={
        sessao
          ? { nome: sessao.nome, empresa: sessao.empresa, papel: sessao.papel }
          : undefined
      }
    >
      <Card className="mx-auto max-w-lg">
        <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
          <div className="grid size-11 place-items-center rounded-full bg-superficie-afundada text-texto-suave">
            <SearchX className="size-5" aria-hidden />
          </div>

          <div className="space-y-1">
            <p className="text-2xs font-medium uppercase tracking-wide text-texto-fraco">
              Erro 404
            </p>
            <p className="text-base font-medium text-texto">Esta tela não existe</p>
            <p className="mx-auto max-w-[46ch] text-sm text-texto-suave">
              O endereço pode estar errado. Use o menu para chegar onde precisa.
            </p>
          </div>

          <Button asChild variant="secundario">
            <Link href="/painel">Ir para o Painel Gerencial</Link>
          </Button>
        </CardContent>
      </Card>
    </AppShell>
  )
}
