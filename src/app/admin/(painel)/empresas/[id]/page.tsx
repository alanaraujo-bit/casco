import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { EstadoVazio } from '@/components/ui/estados'
import { acharEmpresa, listarAcessos } from '@/modules/admin/consultas'
import { FormularioAcesso } from './formulario-acesso'
import { LinhaAcesso } from './linha-acesso'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const empresa = await acharEmpresa(id)
  return { title: empresa ? `Acessos — ${empresa.nome}` : 'Acessos' }
}

/**
 * Os acessos de uma distribuidora.
 *
 * Quem cria login é a Aionix, e é aqui. Não existe equivalente disto do lado da
 * distribuidora — o dono não cadastra funcionário sozinho. Ver o cabeçalho da
 * migration 0009 para o porquê.
 */
export default async function AcessosDaEmpresa({ params }: Props) {
  // `params` é assíncrono nesta versão do Next.
  const { id } = await params

  const empresa = await acharEmpresa(id)
  if (!empresa) notFound()

  const acessos = await listarAcessos(empresa.id)
  const ativos = acessos.filter((a) => a.ativo).length

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-xs text-texto-suave hover:text-texto"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Distribuidoras
        </Link>
        <h1 className="text-xl font-semibold tracking-tight text-texto">{empresa.nome}</h1>
        <p className="text-sm text-texto-suave">
          {acessos.length === 0
            ? 'Nenhum acesso criado ainda.'
            : `${ativos} ${ativos === 1 ? 'acesso ativo' : 'acessos ativos'} de ${acessos.length}.`}
        </p>
      </div>

      <FormularioAcesso companyId={empresa.id} />

      {acessos.length === 0 ? (
        <EstadoVazio
          titulo="Ninguém acessa essa distribuidora"
          descricao="Crie o acesso do dono no formulário acima."
        />
      ) : (
        <ul className="space-y-2">
          {acessos.map((a) => (
            <li key={a.id}>
              <LinhaAcesso acesso={a} companyId={empresa.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
