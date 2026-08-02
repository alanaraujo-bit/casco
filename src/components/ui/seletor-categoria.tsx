'use client'

import { useRef, useState } from 'react'
import { Undo2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'

/**
 * Escolher uma categoria — ou criar uma nova sem sair do formulário.
 *
 * **Por que não um campo de texto livre.** Categoria digitada à mão vira cinco
 * grafias da mesma coisa: "Manutenção", "manutençao", "MANUTENCAO", "Manut.".
 * Cada uma abre uma linha própria no DRE e na abertura de despesas por
 * categoria, e o relatório que deveria responder "gastei com o quê?" passa a
 * responder com uma lista de sinônimos. Ninguém digita errado de propósito; o
 * campo é que deixava.
 *
 * **Por que não só um `<select>` fechado.** Categoria não é enum: cada
 * distribuidora tem as suas, e a que falta é sempre a que a operadora precisa
 * lançar agora. Um select fechado a obrigaria a escolher "Outras Despesas" —
 * que é como uma categoria vira o lixeiro onde metade do custo se esconde.
 *
 * Daí a terceira forma: a lista traz o que já existe, e a última opção é
 * "+ Nova categoria…", que troca o select por um campo de texto com volta.
 * O campo enviado é sempre o mesmo `name`, então a action não sabe (nem
 * precisa saber) por qual dos dois caminhos o valor veio.
 */
export function SeletorCategoria({
  id,
  name = 'categoria',
  categorias,
  defaultValue = '',
  erro,
  placeholder = 'Nova categoria',
  opcional = true,
}: {
  id?: string
  name?: string
  /** As que já existem, vindas do banco e já ordenadas. */
  categorias: string[]
  defaultValue?: string
  erro?: string
  placeholder?: string
  /** Quando `true`, a lista abre com "Sem categoria". */
  opcional?: boolean
}) {
  /**
   * A categoria gravada pode não estar mais na lista — por exemplo se foi a
   * única do produto e o produto está sendo editado depois de renomeada em
   * outro lugar. Ela entra na lista mesmo assim: um select que "esquece" o
   * valor atual do registro faz a operadora salvar por cima sem perceber.
   */
  const lista = defaultValue && !categorias.includes(defaultValue)
    ? [defaultValue, ...categorias]
    : categorias

  const [criando, setCriando] = useState(false)
  const [valor, setValor] = useState(defaultValue)
  const campoNovo = useRef<HTMLInputElement>(null)

  if (criando) {
    return (
      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          {/* O `flex-1` mora no wrapper e não no `Input`: o componente embrulha
              o campo num div para carregar a mensagem de erro, e a classe
              aplicada nele iria parar no `<input>` de dentro — o wrapper
              encolheria e o campo vazaria para fora. */}
          <div className="flex-1">
            <Input
              id={id}
              name={name}
              ref={campoNovo}
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              erro={erro}
              maxLength={60}
              autoComplete="off"
              placeholder={placeholder}
            />
          </div>
          {/*
            A volta existe porque criar é o caminho raro: quem clicou em
            "+ Nova categoria…" sem querer ficaria preso num campo de texto
            sem a lista, e o jeito de sair seria recarregar e perder o resto
            do formulário.
          */}
          <button
            type="button"
            onClick={() => {
              setCriando(false)
              setValor(defaultValue)
            }}
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-borda-controle px-3 text-sm text-texto-suave transition-colors hover:bg-superficie-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco"
          >
            <Undo2 className="size-4" aria-hidden />
            <span className="sr-only sm:not-sr-only">Escolher da lista</span>
          </button>
        </div>
        <p className="text-xs text-texto-fraco">
          A categoria nova passa a aparecer na lista assim que este cadastro for salvo.
        </p>
      </div>
    )
  }

  return (
    <Select
      id={id}
      name={name}
      value={valor}
      erro={erro}
      onChange={(e) => {
        if (e.target.value === '__nova__') {
          setCriando(true)
          setValor('')
          // O foco vai para o campo novo no mesmo gesto: sem isso a operadora
          // clica em "criar" e o cursor fica no select que sumiu.
          requestAnimationFrame(() => campoNovo.current?.focus())
          return
        }
        setValor(e.target.value)
      }}
    >
      <option value="">{opcional ? 'Sem categoria' : 'Escolha a categoria…'}</option>
      {lista.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
      <option value="__nova__">+ Nova categoria…</option>
    </Select>
  )
}
