import type { Metadata } from 'next'
import { Contact, IdCard, Package, Phone } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Chip } from '@/components/painel/pecas'
import { Card } from '@/components/ui/card'
import { listarClientes, metricasClientes } from '@/modules/clientes/consultas'
import { TabelaClientes } from './tabela-clientes'

export const metadata: Metadata = { title: 'Clientes' }

/**
 * Cabeçalho de métricas + tabela. **Primeira tela lendo do banco de verdade.**
 *
 * As três primeiras métricas (Total · Com CPF/CNPJ · Com contato) respondem a
 * pergunta que a operadora faz todo dia: o cadastro está sujo? A quarta —
 * quantos galões estão na rua — é a que liga o cliente ao comodato.
 */
export default async function PaginaClientes() {
  // Em paralelo: são duas consultas independentes, e encadeá-las somaria as
  // duas latências para nada.
  const [linhas, metricas] = await Promise.all([listarClientes(), metricasClientes()])

  const cartoes = [
    {
      rotulo: 'Total de clientes',
      valor: metricas.total.toLocaleString('pt-BR'),
      Icone: Contact,
      tom: 'cat-1' as const,
    },
    {
      rotulo: 'Com CPF/CNPJ',
      valor: `${metricas.comDocumento} de ${metricas.total}`,
      Icone: IdCard,
      tom: 'cat-3' as const,
    },
    {
      // O único cartão em vermelho da tela, e de propósito: é um defeito de
      // cadastro que custa cobrança e entrega perdida, não uma contagem neutra.
      // Só fica vermelho quando há de fato quem esteja sem telefone — cadastro
      // vazio não é defeito, e alarme sem causa some da vista em uma semana.
      rotulo: 'Com telefone',
      valor: `${metricas.comTelefone} de ${metricas.total}`,
      Icone: Phone,
      tom:
        metricas.total > 0 && metricas.comTelefone < metricas.total
          ? ('perigo' as const)
          : ('cat-2' as const),
    },
    {
      rotulo: 'Galões com clientes',
      valor: metricas.galoesNaRua.toLocaleString('pt-BR'),
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
        {cartoes.map((m) => (
          <Card key={m.rotulo} className="flex items-center gap-3 p-3">
            <Chip Icone={m.Icone} tom={m.tom} tamanho="sm" />
            <div className="min-w-0">
              <p className="truncate text-xs text-texto-suave">{m.rotulo}</p>
              <p className="text-lg font-semibold tabular-nums text-texto">{m.valor}</p>
            </div>
          </Card>
        ))}
      </div>

      <TabelaClientes linhas={linhas} />
    </div>
  )
}
