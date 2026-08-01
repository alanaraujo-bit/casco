import type { Metadata } from 'next'
import Link from 'next/link'
import { History } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { lancarMovimento } from '@/modules/vasilhame/acoes'
import {
  listarClientesParaBaixa,
  listarSaldos,
  listarVasilhames,
  ultimosMovimentos,
} from '@/modules/vasilhame/consultas'
import { REGRA } from '@/modules/vasilhame/esquema'
import { FormularioBaixa } from './formulario-baixa'

export const metadata: Metadata = { title: 'Baixa de Vasilhame' }

export default async function PaginaBaixa() {
  const [vasilhames, clientes, saldos, recentes] = await Promise.all([
    listarVasilhames(),
    listarClientesParaBaixa(),
    listarSaldos(),
    ultimosMovimentos(5),
  ])

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Baixa de Vasilhame"
        descricao="Entrada, devolução e perda de galão — sem passar por venda"
        acoes={
          <Button asChild variant="secundario">
            <Link href="/vasilhame/movimentos">
              <History aria-hidden />
              Ver movimentos
            </Link>
          </Button>
        }
      />

      <FormularioBaixa
        acao={lancarMovimento}
        vasilhames={vasilhames}
        clientes={clientes}
        saldos={saldos.map((s) => ({
          clienteId: s.clienteId,
          produtoId: s.produtoId,
          quantidade: s.quantidade,
        }))}
      />

      {recentes.length > 0 && (
        <Card className="p-4 md:p-5">
          <h2 className="mb-3 text-sm font-semibold text-texto">Últimos lançamentos</h2>
          {/* Conferência imediata, na mesma tela. Lançar e ter que navegar para
              outra página só para conferir é o que faz a operadora lançar duas
              vezes "por via das dúvidas". */}
          <ul className="divide-y divide-borda text-sm">
            {recentes.map((m) => {
              const regra = REGRA[m.motivo]
              return (
                <li key={m.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                  <Badge variant={regra.tom} className="shrink-0">
                    {regra.rotulo}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-texto">
                    {Math.abs(m.quantidade)}× {m.produto}
                    {m.cliente && <span className="text-texto-suave"> · {m.cliente}</span>}
                  </span>
                  <time
                    dateTime={m.criadoEm.toISOString()}
                    className="shrink-0 text-xs tabular-nums text-texto-fraco"
                  >
                    {m.criadoEm.toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
