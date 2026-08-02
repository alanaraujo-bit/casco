import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Badge } from '@/components/ui/badge'
import { salvarConta } from '@/modules/financeiro/acoes'
import { acharConta } from '@/modules/financeiro/consultas'
import { FormularioConta } from '../formulario-conta'

export const metadata: Metadata = { title: 'Editar conta bancária' }

export default async function PaginaEditarConta({
  params,
}: {
  // Assíncrono e ponto: acesso síncrono a `params` foi removido no Next 16.
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const conta = await acharConta(id)
  // A RLS já devolveu vazio se o id for de outra distribuidora, então 404 aqui
  // significa as duas coisas ao mesmo tempo — e é a resposta certa para as duas.
  if (!conta) notFound()

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Editar conta bancária"
        descricao={conta.nome}
        acoes={!conta.ativo ? <Badge variant="perigo">desativada</Badge> : undefined}
      />
      <FormularioConta
        acao={salvarConta}
        id={conta.id}
        inicial={{
          nome: conta.nome,
          tipo: conta.tipo,
          // Sem casas quando é inteiro: o campo aceita "1500" e "1500,00", e
          // devolver sempre com decimais faria a operadora apagar dois zeros
          // toda vez que abrisse a tela para mexer em outra coisa.
          saldoInicial: Number(conta.saldoInicial).toFixed(2).replace('.', ','),
        }}
      />
    </div>
  )
}
