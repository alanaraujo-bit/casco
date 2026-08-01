import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, TableProperties } from 'lucide-react'
import { CabecalhoPagina } from '@/components/layout/cabecalho-pagina'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { listarTabelas } from '@/modules/tabelas-preco/consultas'

export const metadata: Metadata = { title: 'Tabelas de Preço' }

export default async function PaginaTabelasPreco() {
  const tabelas = await listarTabelas()

  return (
    <div className="space-y-5">
      <CabecalhoPagina
        titulo="Tabelas de Preço"
        descricao="Cada tipo de cliente pode pagar um preço diferente pelo mesmo produto"
        acoes={
          <Button asChild variant="primario">
            <Link href="/cadastro/tabelas-preco/nova">
              <Plus aria-hidden />
              Nova tabela
            </Link>
          </Button>
        }
      />

      {tabelas.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <TableProperties className="size-10 text-texto-fraco" aria-hidden />
          <div>
            <p className="font-medium text-texto">Nenhuma tabela de preço</p>
            <p className="mt-1 text-sm text-texto-suave">
              Crie a primeira tabela para definir preços diferenciados por tipo de cliente.
            </p>
          </div>
          <Button asChild variant="primario" className="mt-2">
            <Link href="/cadastro/tabelas-preco/nova">
              <Plus aria-hidden />
              Criar primeira tabela
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tabelas.map((t) => (
            <Link key={t.id} href={`/cadastro/tabelas-preco/${t.id}`}>
              <Card className="flex items-center gap-3 p-4 transition-colors hover:bg-superficie-hover">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-texto">{t.nome}</p>
                    {t.padrao && <Badge variant="acento">padrão</Badge>}
                    {!t.ativo && <Badge variant="neutro">inativa</Badge>}
                  </div>
                  <p className="mt-0.5 text-xs text-texto-suave">
                    {t.totalProdutos === 0
                      ? 'Nenhum preço definido'
                      : t.totalProdutos === 1
                        ? '1 produto com preço'
                        : `${t.totalProdutos} produtos com preço`}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
