'use client'

import type { Falha } from '@/lib/erros'
import { useActionState, useEffect, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import { Check, CircleAlert, Undo2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AvisoErro } from '@/components/ui/aviso-erro'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { moeda } from '@/lib/utils'
import { centavos, deCentavos, paraNumero } from '@/modules/vendas/esquema'
import { desfazerBaixa } from '@/modules/financeiro/acoes'
import type { EstadoBaixa } from '@/modules/financeiro/esquema'
import type {
  ContaOpcao,
  FormaPagamentoOpcao,
  TituloParaBaixa,
} from '@/modules/financeiro/consultas'

type Props = {
  acao: (anterior: EstadoBaixa, form: FormData) => Promise<EstadoBaixa>
  titulo: TituloParaBaixa
  contas: ContaOpcao[]
  formas: FormaPagamentoOpcao[]
  hoje: string
}

function BotaoReceber() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="primario" size="lg" disabled={pending} aria-disabled={pending}>
      {pending ? (
        'Recebendo…'
      ) : (
        <>
          <Wallet aria-hidden />
          Confirmar recebimento
        </>
      )}
    </Button>
  )
}

/**
 * A baixa de um título.
 *
 * O formulário **já vem preenchido com o caso normal**: hoje, o valor cheio da
 * parcela, o caixa da loja e dinheiro. O cliente que chega para pagar o que
 * deve, no valor que deve, é a esmagadora maioria — e para ele isto é um clique.
 * Os campos existem para os outros casos, não para serem digitados todo dia.
 *
 * O que a tela não faz é aceitar meia baixa. Data e valor andam juntos, como o
 * banco exige: um título com valor pago e sem data trava a conciliação, porque
 * o relatório passa a saber quanto entrou e não quando.
 */
export function FormularioBaixa({ acao, titulo, contas, formas, hoje }: Props) {
  const [estado, enviar] = useActionState<EstadoBaixa, FormData>(acao, {})

  /**
   * O estado nasce do que o servidor devolveu, e só cai no padrão na primeira
   * abertura.
   *
   * É a armadilha do React 19 que o `AGENTS.md` documenta: a action terminando
   * limpa o `<form>`, **inclusive em erro**. Sem isto, o formulário voltava com
   * a forma de pagamento na primeira opção da lista — "Cartão Crédito", com
   * taxa de 3,19% — depois de uma recusa qualquer. A operadora corrigiria o
   * campo que errou, não repararia no combo que mudou sozinho, e a taxa entraria
   * numa baixa em dinheiro. O `key` no `<form>` abaixo remonta tudo, e estes
   * padrões relêem `estado.valores`, que carrega o que ela tinha escolhido.
   */
  const [pagoEm, setPagoEm] = useState(estado.valores?.pagoEm || hoje)
  const [valorPago, setValorPago] = useState(
    estado.valores?.valorPago || Number(titulo.valorParcela).toFixed(2).replace('.', ','),
  )
  const [contaId, setContaId] = useState(
    estado.valores?.contaId || contas.find((c) => c.tipo === 'caixa')?.id || contas[0]?.id || '',
  )
  const [formaId, setFormaId] = useState(
    estado.valores?.formaId ||
      formas.find((f) => f.tipo === 'dinheiro')?.id ||
      formas[0]?.id ||
      '',
  )

  const formRef = useRef<HTMLFormElement>(null)
  const forma = formas.find((f) => f.id === formaId) ?? null

  const pago = centavos(paraNumero(valorPago) || 0)
  const taxa = forma ? Math.round((pago * Number(forma.taxaPercentual)) / 100) : 0
  const cobrado = centavos(Number(titulo.valorParcela))
  const diferenca = cobrado - pago

  useEffect(() => {
    const primeiro = Object.keys(estado.campos ?? {})[0]
    if (!primeiro) return
    formRef.current?.querySelector<HTMLElement>(`[name="${primeiro}"]`)?.focus()
  }, [estado])

  if (estado.recibo) {
    const r = estado.recibo
    return (
      <Card className="p-5">
        <div className="flex items-start gap-3 text-sucesso">
          <Check className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p className="text-base font-medium">
              Recebido: <span className="tabular-nums">{moeda(r.valorPago)}</span> de {r.cliente}
            </p>
            <p className="text-sm">
              {r.forma} · entrou em {r.conta}
              {r.taxa > 0 && (
                <>
                  {' '}
                  — taxa de <span className="tabular-nums">{moeda(r.taxa)}</span> descontada,{' '}
                  <span className="tabular-nums">{moeda(r.liquido)}</span> líquidos
                </>
              )}
              .
            </p>
            {r.diferenca !== 0 && (
              <p className="text-sm text-alerta">
                {r.diferenca > 0
                  ? `Ficou faltando ${moeda(r.diferenca)} do valor cobrado — o título foi baixado mesmo assim.`
                  : `Recebido ${moeda(-r.diferenca)} a mais que o cobrado.`}
              </p>
            )}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild variant="primario">
            <Link href="/financeiro/receber">Voltar para Contas a Receber</Link>
          </Button>
          <Button asChild variant="secundario">
            <Link href="/financeiro/caixa">Ver no Caixa</Link>
          </Button>
        </div>
      </Card>
    )
  }

  if (titulo.pagoEm) {
    return <JaRecebido titulo={titulo} />
  }

  if (contas.length === 0 || formas.length === 0) {
    return (
      <Card className="p-6 text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-full bg-alerta-bg text-alerta">
          <CircleAlert className="size-5" aria-hidden />
        </div>
        <p className="mt-3 text-base font-medium text-texto">
          Falta cadastrar {contas.length === 0 ? 'uma conta' : 'uma forma de pagamento'}
        </p>
        <p className="mx-auto mt-1 max-w-[46ch] text-sm text-texto-suave">
          Sem isso não há como dizer onde o dinheiro caiu — e uma baixa sem destino é
          exatamente o que impede o caixa de fechar.
        </p>
      </Card>
    )
  }

  return (
    <form
      // Remonta a cada resposta do servidor: é o par do bloco de estado acima,
      // e sem ele o `<select>` fica dizendo uma coisa enquanto o React acredita
      // em outra.
      key={estado.tentativa ?? 0}
      ref={formRef}
      action={enviar}
      className="space-y-4"
      noValidate
    >
      <input type="hidden" name="tituloId" value={titulo.id} />

      <AvisoErro erro={estado.erro} />

      <Card className="space-y-4 p-4 md:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="pagoEm">Data do pagamento</Label>
            <Input
              id="pagoEm"
              name="pagoEm"
              type="date"
              value={pagoEm}
              onChange={(e) => setPagoEm(e.target.value)}
              erro={estado.campos?.pagoEm}
            />
            {/* O caixa segue esta data, não a de hoje: título recebido ontem e
                lançado hoje pertence ao fechamento de ontem. */}
            <p className="text-xs text-texto-fraco">O movimento de caixa entra nesta data.</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="valorPago">Valor recebido</Label>
            <Input
              id="valorPago"
              name="valorPago"
              value={valorPago}
              onChange={(e) => setValorPago(e.target.value)}
              erro={estado.campos?.valorPago}
              inputMode="decimal"
              autoComplete="off"
              className="text-right tabular-nums"
            />
            {diferenca !== 0 && (
              <p className="text-xs text-alerta tabular-nums">
                {diferenca > 0
                  ? `${moeda(deCentavos(diferenca))} a menos que o cobrado.`
                  : `${moeda(deCentavos(-diferenca))} a mais que o cobrado.`}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="formaId">Forma de pagamento</Label>
            <Select
              id="formaId"
              name="formaId"
              value={formaId}
              onChange={(e) => setFormaId(e.target.value)}
              erro={estado.campos?.formaId}
            >
              {formas.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.nome}
                  {Number(f.taxaPercentual) > 0 &&
                    ` — taxa ${Number(f.taxaPercentual).toLocaleString('pt-BR')}%`}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contaId">Banco / Caixa</Label>
            <Select
              id="contaId"
              name="contaId"
              value={contaId}
              onChange={(e) => setContaId(e.target.value)}
              erro={estado.campos?.contaId}
            >
              {contas.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {taxa > 0 && (
          // Sem esta linha o dono acha que recebeu o valor cheio até
          // conciliar o extrato no fim do mês.
          <dl className="space-y-1 border-t border-borda pt-3 text-sm">
            <div className="flex justify-between text-alerta">
              <dt>Taxa {forma?.nome}</dt>
              <dd className="tabular-nums">− {moeda(deCentavos(taxa))}</dd>
            </div>
            <div className="flex justify-between font-medium text-texto">
              <dt>Entra no caixa</dt>
              <dd className="tabular-nums">{moeda(deCentavos(pago - taxa))}</dd>
            </div>
          </dl>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <BotaoReceber />
        <Button asChild variant="fantasma">
          <Link href="/financeiro/receber">Cancelar</Link>
        </Button>
      </div>
    </form>
  )
}

/** O título já baixado, com o caminho de volta. */
function JaRecebido({ titulo }: { titulo: TituloParaBaixa }) {
  const [erro, setErro] = useState<Falha | string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const [pendente, setPendente] = useState(false)

  async function desfazer() {
    setPendente(true)
    setErro(null)
    const r = await desfazerBaixa(titulo.id)
    setPendente(false)
    if (!r.ok) setErro(r.erro ?? 'Não foi possível desfazer.')
    else setConfirmando(false)
  }

  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start gap-3 text-sucesso">
        <Check className="mt-0.5 size-5 shrink-0" aria-hidden />
        <div className="space-y-0.5">
          <p className="text-base font-medium">
            Recebido em {titulo.pagoEm} —{' '}
            <span className="tabular-nums">{moeda(Number(titulo.valorPago ?? 0))}</span>
          </p>
          <p className="text-sm">
            {titulo.forma ?? 'sem forma registrada'} · {titulo.conta ?? 'sem conta registrada'}
            {Number(titulo.taxas) > 0 && ` · taxa de ${moeda(Number(titulo.taxas))}`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-borda pt-4">
        <Button asChild variant="primario">
          <Link href="/financeiro/receber">Voltar para Contas a Receber</Link>
        </Button>

        {/* Dois toques, e não um diálogo do navegador: desfazer mexe no caixa,
            e o botão fica ao lado de um "Voltar" que a operadora clica sem ler. */}
        {!confirmando ? (
          <Button variant="fantasma" onClick={() => setConfirmando(true)}>
            <Undo2 aria-hidden />
            Desfazer baixa
          </Button>
        ) : (
          <>
            <Button variant="perigo" onClick={desfazer} disabled={pendente}>
              {pendente ? 'Desfazendo…' : 'Confirmar: título volta a ficar em aberto'}
            </Button>
            <Button variant="fantasma" onClick={() => setConfirmando(false)} disabled={pendente}>
              Cancelar
            </Button>
          </>
        )}
      </div>

      <p className="text-xs text-texto-fraco">
        Desfazer não apaga o movimento de caixa: lança a saída oposta, para o extrato continuar
        explicando o que aconteceu.
      </p>

      {erro && <AvisoErro erro={erro} />}
    </Card>
  )
}
