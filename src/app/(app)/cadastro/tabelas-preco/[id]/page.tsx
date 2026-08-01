import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Badge } from '@/components/ui/badge'
import { atualizarTabela } from '@/modules/tabelas-preco/acoes'
import {
  acharTabela,
  listarPrecosDaTabela,
} from '@/modules/tabelas-preco/consultas'
import { FormularioTabela } from '../formulario-tabela'
import { TabelaPrecos } from './tabela-precos'
import { BotaoAtivo } from './botao-ativo'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const tabela = await acharTabela(id)
  return { title: tabela ? tabela.nome : 'Tabela não encontrada' }
}

export default async function PaginaEditarTabela({ params }: Props) {
  const { id } = await params

  const [tabela, precosLista] = await Promise.all([
    acharTabela(id),
    listarPrecosDaTabela(id),
  ])

  if (!tabela) notFound()

  const salvar = atualizarTabela.bind(null, tabela.id)

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <CabecalhoPagina
        titulo={tabela.nome}
        descricao="Edite o nome da tabela e os preços dos produtos"
        acoes={
          <div className="flex items-center gap-2">
            {tabela.padrao && <Badge variant="acento">padrão</Badge>}
            <BotaoAtivo id={tabela.id} ativo={tabela.ativo} />
          </div>
        }
      />

      <FormularioTabela acao={salvar} tabela={tabela} />

      <TabelaPrecos tabelaId={tabela.id} precos={precosLista} />
    </div>
  )
}
