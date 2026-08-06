import { exigirSessao } from '@/lib/dal'

/**
 * O layout do PDV kiosk — sem sidebar, sem topbar.
 *
 * O PDV vive fora do `AppShell` de propósito: ele abre numa aba própria (ver
 * o link em `sidebar.tsx`) para ficar num monitor à parte do resto do
 * sistema, e cada pixel de menu ali é um pixel a menos para produto e
 * carrinho na tela que a operadora olha o dia inteiro. `exigirSessao()` aqui
 * é a mesma proteção do layout de `(app)` — nenhuma tela de negócio existe
 * sem sessão, e este grupo não herda a checagem de lá porque é irmão, não
 * filho.
 */
export default async function LayoutPdv({ children }: { children: React.ReactNode }) {
  await exigirSessao()
  return <div className="min-h-dvh bg-fundo">{children}</div>
}
