import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Button } from '@/components/ui/button'
import { abrirCaixa } from '@/modules/financeiro/acoes'
import { listarAberturasCaixa, listarContasCaixa } from '@/modules/financeiro/consultas'
import { FormularioAbertura } from './formulario-abertura'
import { TabelaAberturas } from './tabela-aberturas'

export const metadata: Metadata = { title: 'Abertura de Caixa' }

export default async function PaginaAberturaCaixa() {
  const [contas, aberturas] = await Promise.all([listarContasCaixa(), listarAberturasCaixa()])

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <CabecalhoPagina
        titulo="Abertura de Caixa"
        descricao="Quanto tem na gaveta ao abrir o turno, e quanto disso é fundo de troco"
        acoes={
          <Button asChild variant="secundario">
            <Link href="/financeiro/caixa">
              <ArrowLeft aria-hidden />
              Voltar ao Caixa
            </Link>
          </Button>
        }
      />

      <FormularioAbertura acao={abrirCaixa} contas={contas} />

      <TabelaAberturas linhas={aberturas} />
    </div>
  )
}
