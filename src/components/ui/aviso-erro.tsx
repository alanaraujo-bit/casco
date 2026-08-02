import { CircleAlert, LifeBuoy, RotateCw, ShieldAlert, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Culpa, Falha } from '@/lib/erros'

/**
 * O aviso de falha, em toda tela que grava.
 *
 * Antes cada formulário tinha o seu: uma faixa vermelha com um `TriangleAlert`
 * e a string que a action devolvesse — quase sempre "Não foi possível gravar.
 * Tente de novo." O usuário lia a mesma frase para um dígito errado, para uma
 * regra do negócio e para um bug nosso, e nos três casos a única saída
 * oferecida era repetir. Nos dois últimos, repetir não resolve nunca.
 *
 * Aqui a estrutura obriga a resposta. Não dá para renderizar este componente
 * sem dizer o que aconteceu, de quem é o problema e o que fazer agora —
 * `Falha` não compila sem `titulo`, `acao` e `culpa`.
 *
 * **A cor é informação, não decoração.** Vermelho só quando alguém precisa ser
 * avisado; âmbar quando é regra do sistema funcionando; azul quando é
 * concorrência e recarregar resolve. Pintar tudo de vermelho ensina, em uma
 * semana, a ignorar o vermelho.
 */

const TOM: Record<
  Culpa,
  { caixa: string; texto: string; Icone: typeof TriangleAlert; rotulo: string }
> = {
  usuario: {
    caixa: 'bg-alerta-bg border-alerta/25',
    texto: 'text-alerta',
    Icone: CircleAlert,
    rotulo: 'Confira o preenchimento',
  },
  regra: {
    caixa: 'bg-alerta-bg border-alerta/25',
    texto: 'text-alerta',
    Icone: ShieldAlert,
    rotulo: 'Regra do sistema',
  },
  conflito: {
    caixa: 'bg-info-bg border-info/25',
    texto: 'text-info',
    Icone: RotateCw,
    rotulo: 'Alguém mexeu ao mesmo tempo',
  },
  sistema: {
    caixa: 'bg-perigo-bg border-perigo/25',
    texto: 'text-perigo',
    Icone: TriangleAlert,
    rotulo: 'Problema no sistema, não no seu preenchimento',
  },
}

export function AvisoErro({
  erro,
  className,
}: {
  /**
   * Aceita os dois formatos de propósito.
   *
   * `string` é o que as validações de campo já devolvem — mensagens que sempre
   * foram específicas ("Informe o vencimento") e não ganhariam nada em virar
   * objeto. `Falha` é o que sai de `descreverFalha`, para quando o banco recusa.
   */
  erro?: Falha | string
  className?: string
}) {
  if (!erro) return null

  const f: Falha =
    typeof erro === 'string'
      ? { titulo: erro, acao: '', culpa: 'usuario', codigo: '' }
      : erro

  const tom = TOM[f.culpa]
  const Icone = tom.Icone

  return (
    // `role="alert"` no container, e não no texto: o leitor de tela precisa
    // anunciar o bloco inteiro quando ele aparece, não uma frase solta.
    <div
      role="alert"
      className={cn('rounded-md border px-3 py-2.5', tom.caixa, className)}
    >
      <div className="flex items-start gap-2">
        <Icone className={cn('mt-0.5 size-4 shrink-0', tom.texto)} aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className={cn('text-sm font-medium', tom.texto)}>{f.titulo}</p>

          {f.detalhe && <p className="text-xs text-texto-suave">{f.detalhe}</p>}

          {/* O que fazer agora, sempre em texto normal e nunca na cor do
              alarme: é a linha que a pessoa vai executar, e ela precisa ler
              como instrução, não como parte do susto. */}
          {f.acao && <p className="text-xs text-texto">{f.acao}</p>}

          {/* De quem é o problema. Só aparece quando não é o preenchimento —
              dizer "confira o preenchimento" embaixo de "informe o vencimento"
              seria repetir a mesma coisa com outras palavras. */}
          {f.culpa !== 'usuario' && (
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pt-0.5 text-2xs text-texto-fraco">
              <span className={cn('font-medium', tom.texto)}>{tom.rotulo}</span>
              {f.codigo && (
                <span className="inline-flex items-center gap-1">
                  <LifeBuoy className="size-3" aria-hidden />
                  código&nbsp;
                  {/* Selecionável e em fonte tabular: existe para ser lido em
                      voz alta no telefone ou copiado para a mensagem. */}
                  <code className="select-all rounded bg-superficie-afundada px-1 font-mono tabular-nums text-texto-suave">
                    {f.codigo}
                  </code>
                </span>
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
