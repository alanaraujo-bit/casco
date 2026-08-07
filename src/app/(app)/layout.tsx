import { AppShell } from '@/components/layout/app-shell'
import { SincronizarAoVivo } from '@/components/sincronizar-ao-vivo'
import { exigirSessao } from '@/lib/dal'
import { contarPatchNotesNaoLidos } from '@/modules/patch-notes/consultas'

/**
 * Tudo que está sob este layout exige sessão.
 *
 * O `exigirSessao()` aqui não é redundante com o `proxy.ts`: o proxy evita o
 * flash de tela, este roda no servidor junto da renderização e é o que de fato
 * impede a página de existir sem sessão. Um `matcher` mal escrito no proxy
 * deixaria uma rota passar; aqui não tem como escapar, porque o layout é pai de
 * todas as telas de negócio.
 */
export default async function LayoutApp({ children }: { children: React.ReactNode }) {
  const [sessao, naoLidosAtualizacoes] = await Promise.all([
    exigirSessao(),
    contarPatchNotesNaoLidos(),
  ])

  return (
    <AppShell
      usuario={{
        nome: sessao.nome,
        empresa: sessao.empresa,
        papel: sessao.papel,
        // `adminId` só está na sessão quando quem entrou aqui veio do painel da
        // Aionix. Vira a faixa de aviso no topo — ver `AppShell`.
        admin: Boolean(sessao.adminId),
      }}
      naoLidosAtualizacoes={naoLidosAtualizacoes}
    >
      <SincronizarAoVivo />
      {children}
    </AppShell>
  )
}
