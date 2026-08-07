'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Check, Save } from 'lucide-react'
import { AvisoErro } from '@/components/ui/aviso-erro'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { corrigirEntrega } from '@/modules/vendas/acoes'
import type { EstadoEntrega } from '@/modules/vendas/esquema'
import type { EntregadorVenda } from '@/modules/vendas/consultas'

function BotaoSalvar({ mudou }: { mudou: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant="primario"
      disabled={pending || !mudou}
      aria-disabled={pending || !mudou}
    >
      {pending ? (
        'Salvando…'
      ) : (
        <>
          <Save aria-hidden />
          Salvar alteração
        </>
      )}
    </Button>
  )
}

/**
 * Os dois campos que uma venda fechada aceita mudar.
 *
 * O texto do rodapé não é decoração: sem ele, a primeira reação de quem vê um
 * formulário numa venda é procurar onde se corrige a quantidade — e não achar
 * parece defeito. Dizer o que a tela não faz, e por quê, transforma a ausência
 * em decisão. O motivo completo mora em `esquema.ts`, junto do schema.
 *
 * "Salvar" nasce desabilitado e só acende quando algo muda. Numa tela que a
 * operadora abre para conferir, o botão aceso é um convite a gravar sem querer
 * o que ela só veio olhar.
 */
export function FormularioEntrega({
  vendaId,
  entregadorId,
  entregadorNome,
  observacao,
  entregadores,
  bloqueado,
}: {
  vendaId: string
  entregadorId: string | null
  /** Só usado quando ele saiu do cadastro — ver `faltaNaLista`. */
  entregadorNome: string | null
  observacao: string | null
  entregadores: EntregadorVenda[]
  /** Venda cancelada não muda. O formulário some e sobra a explicação. */
  bloqueado?: boolean
}) {
  const [estado, enviar] = useActionState<EstadoEntrega, FormData>(corrigirEntrega, {})

  /**
   * Os valores vivem no estado, e o `<form>` remonta a cada resposta.
   *
   * É a armadilha do React 19 que o `AGENTS.md` documenta: a action terminando
   * limpa o formulário, **inclusive em erro**. Sem isto, uma recusa qualquer
   * devolveria o `<select>` para o primeiro entregador da lista — e a operadora,
   * corrigindo outra coisa, gravaria o nome errado sem perceber.
   */
  const [escolhido, setEscolhido] = useState(entregadorId ?? '')
  const [texto, setTexto] = useState(observacao ?? '')

  // Depois de salvar, o servidor revalida a página e as props chegam novas.
  // Sem isto o formulário continuaria comparando com o valor de antes e o botão
  // ficaria aceso, sugerindo que a alteração não pegou.
  //
  // O ajuste é no corpo do render, e não num efeito: o React reinicia a render
  // com o valor novo antes de pintar a tela, então o botão nunca chega a
  // aparecer aceso. Pelo efeito, a operadora veria um quadro com "Salvar"
  // habilitado logo depois de salvar — o mesmo idioma dos outros formulários.
  const [propsAnteriores, setPropsAnteriores] = useState({ entregadorId, observacao })
  if (
    propsAnteriores.entregadorId !== entregadorId ||
    propsAnteriores.observacao !== observacao
  ) {
    setPropsAnteriores({ entregadorId, observacao })
    setEscolhido(entregadorId ?? '')
    setTexto(observacao ?? '')
  }

  if (bloqueado) return null

  const mudou = escolhido !== (entregadorId ?? '') || texto !== (observacao ?? '')

  // Entregador desativado depois da venda continua selecionável nesta venda:
  // tirá-lo da lista faria o `<select>` mostrar outro nome, e salvar qualquer
  // outra coisa reescreveria o histórico em silêncio.
  const faltaNaLista = entregadorId && !entregadores.some((e) => e.id === entregadorId)

  return (
    <form key={estado.tentativa ?? 0} action={enviar}>
      <Card className="space-y-4 p-4 md:p-5">
        <div>
          <h2 className="text-sm font-semibold text-texto">Corrigir esta venda</h2>
          <p className="mt-0.5 text-xs text-texto-suave">
            Marcar quem entregou depois é o caso mais comum — o balcão cheio fecha a venda
            primeiro e resolve a rota depois.
          </p>
        </div>

        <input type="hidden" name="vendaId" value={vendaId} />

        <AvisoErro erro={estado.erro} />

        {estado.salvo && !mudou && (
          <p className="flex items-center gap-2 rounded-md bg-sucesso-bg px-3 py-2 text-sm text-sucesso">
            <Check className="size-4 shrink-0" aria-hidden />
            Alteração salva.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="entregadorId">Entregador</Label>
            <Select
              id="entregadorId"
              name="entregadorId"
              value={escolhido}
              onChange={(e) => setEscolhido(e.target.value)}
              erro={estado.campos?.entregadorId}
            >
              <option value="">Sem entregador</option>
              {faltaNaLista && (
                <option value={entregadorId}>{entregadorNome ?? 'Entregador atual'} (inativo)</option>
              )}
              {entregadores.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.nome}
                </option>
              ))}
            </Select>
            <p className="text-xs text-texto-fraco">
              Entra no Desempenho dos Entregadores assim que você salvar.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="observacao">Observação</Label>
            <Textarea
              id="observacao"
              name="observacao"
              rows={3}
              maxLength={300}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              erro={estado.campos?.observacao}
              placeholder="Ex.: entregue no portão dos fundos"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-borda pt-4">
          <BotaoSalvar mudou={mudou} />
          <p className="text-xs text-texto-fraco">
            Item, quantidade, preço e forma de pagamento não mudam aqui: cada um deles já
            virou saída de estoque, caixa, título e saldo de vasilhame. Venda errada se
            refaz, para as duas pontas continuarem batendo.
          </p>
        </div>
      </Card>
    </form>
  )
}
