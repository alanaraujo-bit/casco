import { exigirAdminPronto } from '@/lib/dal'

/**
 * Grupo que exige senha definitiva.
 *
 * Só existe para hospedar o guard. `/admin/senha` fica fora dele de propósito:
 * é a única tela que um admin com senha provisória pode ver, e é ela que o
 * guard aponta. Toda tela de admin criada daqui em diante nasce dentro deste
 * grupo e herda a trava sem ninguém precisar lembrar.
 */
export default async function LayoutPainelAdmin({
  children,
}: {
  children: React.ReactNode
}) {
  await exigirAdminPronto()
  return <>{children}</>
}
