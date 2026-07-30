import type { Metadata } from 'next'
import { Contact, IdCard, Package, Phone } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Chip } from '@/components/painel/pecas'
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
  const comDocumento = CLIENTES.filter((c) => c.documento !== '').length
  const comContato = CLIENTES.filter((c) => c.telefone !== '').length
  const galoesNaRua = CLIENTES.reduce((s, c) => s + c.vasilhames, 0)

  const metricas = [
    {
      rotulo: 'Total de clientes',
      valor: total.toLocaleString('pt-BR'),
      Icone: Contact,
      tom: 'cat-1' as const,
    },
    {
      rotulo: 'Com CPF/CNPJ',
      valor: `${comDocumento} de ${total}`,
      Icone: IdCard,
      tom: 'cat-3' as const,
    },
    {
      // O único cartão em vermelho da tela, e de propósito: é um defeito de
      // cadastro que custa cobrança e entrega perdida, não uma contagem neutra.
      rotulo: 'Com telefone',
      valor: `${comContato} de ${total}`,
      Icone: Phone,
      tom: 'perigo' as const,
    },
    {
      rotulo: 'Galões com clientes',
      valor: galoesNaRua.toLocaleString('pt-BR'),
      Icone: Package,
      tom: 'cat-4' as const,
    },
  ]

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Clientes"
        descricao="Cadastro, contato e vasilhame em poder de cada cliente"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricas.map((m) => (
          <Card key={m.rotulo} className="flex items-center gap-3 p-3">
            <Chip Icone={m.Icone} tom={m.tom} tamanho="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs text-texto-suave">{m.rotulo}</p>
              <p className="text-lg font-semibold tabular-nums text-texto">{m.valor}</p>
            </div>
          </Card>
        ))}
      </div>

      <TabelaClientes />
    </div>
  )
}
