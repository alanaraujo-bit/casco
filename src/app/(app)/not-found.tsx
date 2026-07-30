import Link from 'next/link'
import { SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

/**
 * 404 de dentro do sistema.
 *
 * Existe separado do `app/not-found.tsx` por dois motivos: mantém o usuário
 * dentro do shell — um erro de digitação na URL não deveria jogá-lo para fora
 * da navegação — e renderiza no lugar certo da árvore, em vez de chegar pelo
 * payload de streaming com o body vazio.
 */
export default function NaoEncontradoNoApp() {
  return (
    <Card className="mx-auto max-w-lg">
      <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <div className="grid size-11 place-items-center rounded-full bg-superficie-afundada text-texto-suave">
          <SearchX className="size-5" aria-hidden />
        </div>

        <div className="space-y-1">
          <p className="text-base font-medium text-texto">Esta tela não existe</p>
          <p className="mx-auto max-w-[46ch] text-sm text-texto-suave">
            O endereço pode estar errado. Use o menu ao lado para chegar onde
            precisa.
          </p>
        </div>

        <Button asChild variant="secundario">
          <Link href="/painel">Ir para o Painel Gerencial</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
