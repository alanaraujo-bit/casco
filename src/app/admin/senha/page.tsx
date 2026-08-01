import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { exigirAdmin } from '@/lib/dal'
import { FormularioSenha } from './formulario-senha'

export const metadata: Metadata = { title: 'Definir senha' }

/**
 * Primeiro acesso: trocar a senha provisória.
 *
 * Fora do grupo `(painel)`, então escapa do `exigirAdminPronto()` — é a única
 * tela que um admin com senha provisória enxerga.
 *
 * O inverso também vale e está logo abaixo: quem já trocou não volta aqui.
 * Sem isso, a tela viraria um "trocar senha" genérico acessível pela URL, e a
 * primeira coisa que ela faz é aceitar uma senha nova **sem pedir a atual** —
 * o que só é aceitável enquanto a senha atual é a provisória que nós mesmos
 * entregamos. Trocar senha depois é outra tela, com a atual pedida.
 */
export default async function PaginaSenha() {
  const admin = await exigirAdmin()
  if (!admin.trocaSenha) redirect('/admin')

  return (
    <div className="mx-auto max-w-sm space-y-6 py-6">
      <div className="space-y-2">
        <h1 className="text-xl font-semibold tracking-tight text-texto">Defina sua senha</h1>
        <p className="text-sm text-texto-suave">
          {admin.nome}, este é seu primeiro acesso. Escolha uma senha antes de continuar — a
          provisória deixa de valer agora.
        </p>
      </div>

      <FormularioSenha />
    </div>
  )
}
