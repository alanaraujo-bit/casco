'use client'

import { useRef } from 'react'
import { useFormStatus } from 'react-dom'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { salvarPrecos } from '@/modules/tabelas-preco/acoes'
import type { PrecoComProduto } from '@/modules/tabelas-preco/consultas'

function BotaoSalvarPrecos() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="primario" disabled={pending} aria-disabled={pending}>
      {pending ? (
        'Salvando…'
      ) : (
        <>
          <Save aria-hidden />
          Salvar preços
        </>
      )}
    </Button>
  )
}

function formatarPreco(valor: string | null): string {
  if (!valor) return ''
  return Number(valor).toFixed(2).replace('.', ',')
}

export function TabelaPrecos({
  tabelaId,
  precos,
}: {
  tabelaId: string
  precos: PrecoComProduto[]
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const salvar = salvarPrecos.bind(null, tabelaId)

  if (precos.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-texto-suave">
          Nenhum produto cadastrado. Cadastre produtos primeiro para definir preços.
        </p>
      </Card>
    )
  }

  return (
    <form ref={formRef} action={salvar}>
      <Card className="overflow-hidden">
        <div className="border-b border-borda px-4 py-3">
          <h2 className="text-sm font-semibold text-texto">Preços por produto</h2>
          <p className="mt-0.5 text-xs text-texto-suave">
            Deixe em branco para usar o preço padrão do produto
          </p>
        </div>

        <div className="divide-y divide-borda">
          {precos.map((p) => (
            <div
              key={p.produtoId}
              className="flex items-center gap-4 px-4 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-texto">
                  {p.produtoCodigo
                    ? `${String(p.produtoCodigo).padStart(4, '0')} — `
                    : ''}
                  {p.produtoNome}
                </p>
                <p className="text-xs text-texto-fraco">
                  Padrão: R$ {Number(p.precoPadrao).toFixed(2).replace('.', ',')}
                </p>
              </div>

              <div className="w-28 shrink-0">
                <Input
                  name={`preco-${p.produtoId}`}
                  defaultValue={formatarPreco(p.preco)}
                  inputMode="decimal"
                  placeholder="—"
                  aria-label={`Preço de ${p.produtoNome}`}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end border-t border-borda px-4 py-3">
          <BotaoSalvarPrecos />
        </div>
      </Card>
    </form>
  )
}
