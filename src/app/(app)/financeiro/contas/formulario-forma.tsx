'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Check, Save, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { moeda } from '@/lib/utils'
import { ROTULO_TIPO_PAGAMENTO, type EstadoForma } from '@/modules/financeiro/esquema'
import type { ContaOpcao } from '@/modules/financeiro/consultas'

type Props = {
  acao: (anterior: EstadoForma, form: FormData) => Promise<EstadoForma>
  contas: ContaOpcao[]
  id?: string
  inicial?: {
    nome: string
    tipo: string
    taxaPercentual: string
    prazoDias: number
    contaId: string | null
  }
}

function BotaoSalvar() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="primario" size="lg" disabled={pending} aria-disabled={pending}>
      {pending ? (
        'Salvando…'
      ) : (
        <>
          <Save aria-hidden />
          Salvar forma
        </>
      )}
    </Button>
  )
}

/**
 * Cadastro de uma forma de pagamento.
 *
 * **A taxa é o campo que justifica esta tela.** É o número que o sistema antigo
 * não desconta em lugar nenhum: o dono vende R$ 100 no débito, o painel diz
 * R$ 100, e o que cai na conta é R$ 98,51 — a diferença só aparece ao conciliar
 * o extrato no fim do mês, se alguém conciliar. Aqui ela é descontada na venda
 * e vira linha própria no DRE.
 *
 * O exemplo em R$ 100 aparece embaixo do campo enquanto se digita, porque
 * "1,49%" não diz nada e "R$ 98,51 de R$ 100,00" diz tudo — e é assim que um
 * `1490` digitado no lugar de `14,90` é pego na hora, e não no fechamento.
 */
export function FormularioForma({ acao, contas, id, inicial }: Props) {
  const [estado, enviar] = useActionState<EstadoForma, FormData>(acao, {})
  const formRef = useRef<HTMLFormElement>(null)

  const v = estado.valores ?? {}

  /**
   * A taxa é o único campo controlado do formulário, e precisa ser.
   *
   * Todos os outros usam `defaultValue`, que é o padrão da casa. Este mostra o
   * líquido de uma venda de R$ 100 **enquanto se digita**, e com campo não
   * controlado essa linha nunca recalculava: ela lia o valor devolvido pela
   * action, que só existe depois de um envio. O resultado era pior que não ter
   * a linha — a tela dizia "entram R$ 100,00" com 2,50 digitado no campo ao
   * lado, afirmando com todas as letras que a maquininha não desconta nada.
   *
   * O estado nasce do valor devolvido em erro, ou do gravado na edição. O
   * `key={estado.tentativa}` no `<form>` remonta o componente a cada resposta,
   * então o `useState` é re-semeado junto e não fica preso ao primeiro valor.
   */
  const [taxa, setTaxa] = useState(v.taxaPercentual ?? inicial?.taxaPercentual ?? '0')
  const erroDe = (campo: keyof NonNullable<EstadoForma['campos']>) => estado.campos?.[campo]

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
          <p className="text-base font-medium">
            {s.nome} {s.novo ? 'foi cadastrada.' : 'foi atualizada.'}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="primario">
            <Link href="/financeiro/contas">Ver contas e formas</Link>
          </Button>
          {s.novo && (
            <Button asChild variant="secundario">
              <Link href="/financeiro/formas/nova">Cadastrar outra</Link>
            </Button>
          )}
        </div>
      </Card>
    )
  }

  const taxaNumero = Number(taxa.replace(/\./g, '').replace(',', '.'))
  const taxaValida = Number.isFinite(taxaNumero) && taxaNumero >= 0 && taxaNumero <= 100
  const liquidoEm100 = taxaValida ? 100 - taxaNumero : null

  return (
    <form key={estado.tentativa ?? 0} ref={formRef} action={enviar} className="space-y-4" noValidate>
      {id && <input type="hidden" name="id" value={id} />}

      {estado.erro && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-perigo-bg px-3 py-2.5 text-sm text-perigo"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{estado.erro}</span>
        </div>
      )}

      <Card className="p-4 md:p-5">
        <div className="grid gap-4 sm:grid-cols-6">
          <div className="space-y-1.5 sm:col-span-4">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              name="nome"
              defaultValue={v.nome ?? inicial?.nome ?? ''}
              erro={erroDe('nome')}
              maxLength={80}
              placeholder="Cartão Débito"
              autoComplete="off"
            />
            <p className="text-xs text-texto-fraco">
              É o que aparece na coluna “Forma Pgto” e no seletor do PDV.
            </p>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tipo">Tipo</Label>
            <Select
              id="tipo"
              name="tipo"
              defaultValue={v.tipo ?? inicial?.tipo ?? 'dinheiro'}
              erro={erroDe('tipo')}
            >
              {Object.entries(ROTULO_TIPO_PAGAMENTO).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </Select>
            {/* O tipo não é decoração: `a_prazo` é o que faz o PDV gerar título
                em Contas a Receber em vez de entrada no caixa. */}
            <p className="text-xs text-texto-fraco">
              “A prazo” gera título em Contas a Receber; os outros entram no caixa.
            </p>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="taxaPercentual">Taxa (%)</Label>
            <Input
              id="taxaPercentual"
              name="taxaPercentual"
              value={taxa}
              onChange={(e) => setTaxa(e.target.value)}
              erro={erroDe('taxaPercentual')}
              inputMode="decimal"
              placeholder="0,00"
              autoComplete="off"
              className="text-right tabular-nums"
            />
            {/* O exemplo em R$ 100: "1,49%" não diz nada e "entram R$ 98,51"
                diz tudo. É também o que pega um `250` digitado no lugar de
                `2,50` na hora — sem ele o erro só apareceria no fechamento,
                com cada venda gerando entrada de caixa negativa. */}
            {liquidoEm100 !== null ? (
              <p className="text-xs text-texto-fraco">
                Em uma venda de {moeda(100)}, entram{' '}
                <span className="tabular-nums text-texto-suave">{moeda(liquidoEm100)}</span>.
              </p>
            ) : (
              <p className="text-xs text-alerta">
                A taxa precisa ficar entre 0 e 100%.
              </p>
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="prazoDias">Prazo (dias)</Label>
            <Input
              id="prazoDias"
              name="prazoDias"
              defaultValue={v.prazoDias ?? String(inicial?.prazoDias ?? 0)}
              erro={erroDe('prazoDias')}
              inputMode="numeric"
              placeholder="0"
              autoComplete="off"
              className="text-right tabular-nums"
            />
            <p className="text-xs text-texto-fraco">Quantos dias até o dinheiro cair.</p>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="contaId">
              Cai em
              <span className="ml-1 font-normal text-texto-fraco">(opcional)</span>
            </Label>
            <Select
              id="contaId"
              name="contaId"
              defaultValue={v.contaId ?? inicial?.contaId ?? ''}
              erro={erroDe('contaId')}
            >
              <option value="">Sem conta definida</option>
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <BotaoSalvar />
        <Button asChild variant="fantasma">
          <Link href="/financeiro/contas">Cancelar</Link>
        </Button>
      </div>
    </form>
  )
}
