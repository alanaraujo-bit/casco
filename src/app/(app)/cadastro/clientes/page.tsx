import type { Metadata } from 'next'
import { Contact, IdCard, Phone, UserPlus } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Chip } from '@/components/painel/pecas'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CLIENTES } from '@/lib/demo'
import { TabelaClientes } from './tabela-clientes'

export const metadata: Metadata = { title: 'Clientes' }

/**
 * Cabeçalho de métricas + tabela.
 *
 * As três métricas são as mesmas do sistema antigo (Total · Com CPF/CNPJ ·
 * Com contato), porque é o que a operadora já usa para saber se o cadastro
 * está sujo. A quarta é nossa: quantos galões estão na rua.
 */
export default function PaginaClientes() {
  const total = CLIENTES.length
  const comDocumento = CLIENTES.filter((c) => c.documento.length > 5).length
  const comContato = CLIENTES.filter((c) => c.telefone.length > 8).length
  const galoesNaRua = CLIENTES.reduce((s, c) => s + c.vasilhames, 0)

  const metricas = [
    { rotulo: 'Total de clientes', valor: total, Icone: Contact, tom: 'acento' as const },
    { rotulo: 'Com CPF/CNPJ', valor: comDocumento, Icone: IdCard, tom: 'info' as const },
    { rotulo: 'Com contato', valor: comContato, Icone: Phone, tom: 'sucesso' as const },
    {
      rotulo: 'Galões com clientes',
      valor: galoesNaRua,
      Icone: UserPlus,
      tom: 'roxo' as const,
    },
  ]

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Clientes"
        descricao="Cadastro, contato e vasilhame em poder de cada cliente"
        acoes={
          <Button variant="primario" size="sm">
            <UserPlus aria-hidden />
            Novo cliente
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricas.map((m) => (
          <Card key={m.rotulo} className="flex items-center gap-3 p-3">
            <Chip Icone={m.Icone} tom={m.tom} tamanho="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs text-texto-suave">{m.rotulo}</p>
              <p className="text-lg font-semibold tabular-nums text-texto">
                {m.valor.toLocaleString('pt-BR')}
              </p>
            </div>
          </Card>
        ))}
      </div>

      <TabelaClientes />
    </div>
  )
}
