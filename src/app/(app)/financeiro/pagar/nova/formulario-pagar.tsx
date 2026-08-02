'use client'

import { useActionState, useEffect, useRef } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Check, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AvisoErro } from '@/components/ui/aviso-erro'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { SeletorCategoria } from '@/components/ui/seletor-categoria'
import { Textarea } from '@/components/ui/textarea'
import { cn, moeda } from '@/lib/utils'
import { formatarDataISO } from '@/lib/formatos'
import type { EstadoPagar } from '@/modules/financeiro/esquema'
import type { FornecedorOpcao } from '@/modules/financeiro/consultas'

type Props = {
  acao: (anterior: EstadoPagar, form: FormData) => Promise<EstadoPagar>
  fornecedores: FornecedorOpcao[]
  hoje: string
  /** As categorias de despesa já usadas. O seletor sempre aceita uma nova. */
  categorias: string[]
}

function BotaoLancar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="primario" size="lg" disabled={pending} aria-disabled={pending}>
      {pending ? (
        'Lançando…'
      ) : (
        <>
          <Plus aria-hidden />
          Lançar conta
        </>
      )}
    </Button>
  )
}

/**
 * O lançamento de uma conta a pagar.
 *
 * **Custo ou despesa vem primeiro, e como botão.** É a escolha que o resto da
 * tela depende para significar alguma coisa: custo entra no CMV, despesa entra
 * em despesa operacional, e é essa separação que faz o resultado do mês fechar.
 * Num `<select>` no meio do formulário ela viraria o campo que se aceita como
 * veio — e o padrão de qualquer combo é a primeira opção.
 */
export function FormularioPagar({ acao, fornecedores, hoje, categorias }: Props) {
  const [estado, enviar] = useActionState<EstadoPagar, FormData>(acao, {})
  const formRef = useRef<HTMLFormElement>(null)

  const v = estado.valores ?? {}
  const erroDe = (campo: keyof NonNullable<EstadoPagar['campos']>) => estado.campos?.[campo]

  useEffect(() => {
    const primeiro = Object.keys(estado.campos ?? {})[0]
    if (!primeiro) return
    const el = formRef.current?.querySelector<HTMLElement>(`[name="${primeiro}"]`)
    el?.focus()
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [estado])

  if (estado.sucesso) {
    const s = estado.sucesso
    return (
      <Card className="p-5">
        <div className="flex items-start gap-3 text-sucesso">
          <Check className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="space-y-0.5">
            <p className="text-base font-medium">
              {s.descricao} — <span className="tabular-nums">{moeda(s.total)}</span>
            </p>
            <p className="text-sm">
              {s.parcelas === 1
                ? `Uma conta, vencendo em ${formatarDataISO(s.primeiroVencimento)}.`
                : `${s.parcelas} parcelas, a primeira vencendo em ${formatarDataISO(s.primeiroVencimento)}.`}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="primario">
            <Link href="/financeiro/pagar">Ver Contas a Pagar</Link>
          </Button>
          <Button asChild variant="secundario">
            <Link href="/financeiro/pagar/nova">Lançar outra</Link>
          </Button>
        </div>
      </Card>
    )
  }

  return (
    // `key` na tentativa: o React 19 limpa o formulário quando a action termina,
    // inclusive em erro. Sem remontar com os valores devolvidos, a operadora
    // perde tudo que preencheu por causa de um dígito.
    <form key={estado.tentativa ?? 0} ref={formRef} action={enviar} className="space-y-4" noValidate>
      <AvisoErro erro={estado.erro} />

      <Card className="p-4 md:p-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-texto">
            Isto é custo ou despesa?
          </legend>
          <p className="mb-3 text-xs text-texto-suave">
            Custo é o que entra no produto — garrafão, tampa, água. Despesa é o que mantém a
            porta aberta — energia, aluguel, combustível. É esta escolha que faz o resultado do
            mês fechar.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['custo', 'Custo', 'Entra no custo do produto vendido'],
                ['despesa', 'Despesa', 'Custo de manter a operação'],
              ] as const
            ).map(([valor, rotulo, ajuda]) => (
              <label
                key={valor}
                className={cn(
                  'flex min-h-11 cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm transition-colors',
                  'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-foco',
                  'border-borda-controle bg-superficie hover:bg-superficie-hover',
                  'has-[:checked]:border-acento-suave-borda has-[:checked]:bg-acento-suave has-[:checked]:text-acento-texto',
                )}
              >
                <input
                  type="radio"
                  name="natureza"
                  value={valor}
                  defaultChecked={(v.natureza || 'despesa') === valor}
                  className="mt-1"
                />
                <span>
                  <span className="block font-medium">{rotulo}</span>
                  <span className="block text-xs opacity-80">{ajuda}</span>
                </span>
              </label>
            ))}
          </div>
          {erroDe('natureza') && <p className="mt-1 text-xs text-perigo">{erroDe('natureza')}</p>}
        </fieldset>
      </Card>

      <Card className="p-4 md:p-5">
        <div className="grid gap-4 sm:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-4">
            <Label htmlFor="descricao">Descrição</Label>
            <Input
              id="descricao"
              name="descricao"
              defaultValue={v.descricao ?? ''}
              erro={erroDe('descricao')}
              maxLength={200}
              placeholder="Compra de garrafões — nota 4512"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="categoria">
              Categoria
              <span className="ml-1 font-normal text-texto-fraco">(opcional)</span>
            </Label>
            <SeletorCategoria
              id="categoria"
              categorias={categorias}
              defaultValue={v.categoria ?? ''}
              erro={erroDe('categoria')}
              placeholder="Energia"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="fornecedorId">
              Fornecedor
              <span className="ml-1 font-normal text-texto-fraco">(opcional)</span>
            </Label>
            <Select
              id="fornecedorId"
              name="fornecedorId"
              defaultValue={v.fornecedorId ?? ''}
              erro={erroDe('fornecedorId')}
            >
              <option value="">Sem fornecedor</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.codigo ? `${String(f.codigo).padStart(4, '0')} - ` : ''}
                  {f.nome}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="valorPrevisto">Valor previsto</Label>
            <Input
              id="valorPrevisto"
              name="valorPrevisto"
              defaultValue={v.valorPrevisto ?? ''}
              erro={erroDe('valorPrevisto')}
              inputMode="decimal"
              placeholder="0,00"
              autoComplete="off"
              className="text-right tabular-nums"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="vencimento">Primeiro vencimento</Label>
            <Input
              id="vencimento"
              name="vencimento"
              type="date"
              defaultValue={v.vencimento || hoje}
              erro={erroDe('vencimento')}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="parcelas">Parcelas</Label>
            <Select id="parcelas" name="parcelas" defaultValue={v.parcelas || '1'} erro={erroDe('parcelas')}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>
                  {n}×
                </option>
              ))}
            </Select>
            {/* Cada parcela vira uma linha própria, com seu vencimento: é o que
                faz "o que vence esta semana" ter resposta. */}
            <p className="text-xs text-texto-fraco">
              Cada parcela vira uma conta, um mês depois da anterior.
            </p>
          </div>

          <div className="space-y-1.5 sm:col-span-6">
            <Label htmlFor="observacao">
              Observação
              <span className="ml-1 font-normal text-texto-fraco">(opcional)</span>
            </Label>
            <Textarea
              id="observacao"
              name="observacao"
              defaultValue={v.observacao ?? ''}
              erro={erroDe('observacao')}
              rows={2}
              maxLength={300}
            />
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <BotaoLancar />
        <Button asChild variant="fantasma">
          <Link href="/financeiro/pagar">Cancelar</Link>
        </Button>
      </div>
    </form>
  )
}
