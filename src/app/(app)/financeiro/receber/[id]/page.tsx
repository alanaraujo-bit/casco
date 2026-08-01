import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Card } from '@/components/ui/card'
import { dataNaLoja } from '@/lib/formatos'
import { moeda } from '@/lib/utils'
import { receberTitulo } from '@/modules/financeiro/acoes'
import { acharTitulo, listarContas, listarFormasPagamento } from '@/modules/financeiro/consultas'
import { FormularioBaixa } from './formulario-baixa'

export const metadata: Metadata = { title: 'Receber título' }

export default async function PaginaBaixaTitulo({ params }: PageProps<'/financeiro/receber/[id]'>) {
  const { id } = await params

  const [titulo, contas, formas] = await Promise.all([
    acharTitulo(id),
    listarContas(),
    listarFormasPagamento(),
  ])

  // A RLS já garante que um título de outra distribuidora não é encontrado —
  // o 404 aqui é o mesmo caminho para "não existe" e "não é seu", que é o que
  // evita a tela confirmar a existência de dado alheio.
  if (!titulo) notFound()

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Receber título"
        descricao={`${titulo.cliente} · parcela ${titulo.parcela} · vence em ${titulo.vencimento}`}
      />

      <Card className="p-4 md:p-5">
        <dl className="grid gap-3 text-sm sm:grid-cols-4">
          {[
            ['Código', titulo.codigo ? String(titulo.codigo).padStart(4, '0') : '—'],
            ['Emissão', titulo.emissao],
            ['Vencimento', titulo.vencimento],
            ['Valor da parcela', moeda(Number(titulo.valorParcela))],
          ].map(([rotulo, valor]) => (
            <div key={rotulo}>
              <dt className="text-xs text-texto-suave">{rotulo}</dt>
              <dd className="font-medium tabular-nums text-texto">{valor}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <FormularioBaixa
        acao={receberTitulo}
        titulo={titulo}
        contas={contas}
        formas={formas}
        // A data padrão sai do servidor, no fuso da loja. Deixar o navegador
        // decidir daria a data do aparelho, que pode estar em qualquer fuso.
        hoje={dataNaLoja()}
      />
    </div>
  )
}
