import type * as React from 'react'

/** Como a coluna se comporta quando a tela vira cartão, no celular. */
export type PapelMobile =
  /** Vira o título do cartão. Exatamente uma coluna deveria ter este papel. */
  | 'titulo'
  /** Fica no canto superior direito do cartão — normalmente o valor em R$. */
  | 'destaque'
  /** Vira uma linha "rótulo: valor" no corpo do cartão. É o padrão. */
  | 'campo'
  /** Não aparece no celular. Para colunas que só fazem sentido na conferência. */
  | 'oculto'

export type Alinhamento = 'esquerda' | 'centro' | 'direita'

/**
 * Definição de uma coluna.
 *
 * O ponto de projeto aqui é que **`texto` é a fonte da verdade** e `celula` é
 * decoração. Busca, ordenação e exportação leem `texto`; só a renderização lê
 * `celula`. Sem essa separação, exportar uma tabela devolve `[object Object]`
 * e buscar por "Pago" não acha a linha cujo selo diz "Pago" — os dois bugs
 * clássicos de tabela genérica, e os dois já existem no sistema que estamos
 * substituindo.
 */
export interface Coluna<T> {
  /** Identificador estável. É o que persiste em localStorage. Nunca traduzir. */
  chave: string

  /** Cabeçalho visível. Vocabulário do sistema antigo, sem inventar sinônimo. */
  cabecalho: string

  /**
   * Valor textual da célula: usado em busca, exportação e como conteúdo padrão
   * quando não há `celula`. Deve devolver o que o usuário leria na tela.
   */
  texto: (linha: T) => string

  /** Renderização rica (selo, link, ícone). Cai para `texto` quando ausente. */
  celula?: (linha: T) => React.ReactNode

  /**
   * Chave de ordenação. Número e data ordenam por grandeza; ausente, ordena
   * pelo `texto` com `localeCompare` pt-BR (que trata acento como o usuário
   * espera: "Ávila" antes de "Bastos", não depois de "Zanetti").
   */
  valor?: (linha: T) => string | number | Date | null | undefined

  alinhamento?: Alinhamento

  /** Aplica `tabular-nums` e alinha à direita. Para dinheiro e quantidade. */
  numerica?: boolean

  /** `false` desliga a ordenação nesta coluna. Padrão: `true`. */
  ordenavel?: boolean

  /** Coluna que o usuário não pode esconder (identificação da linha). */
  fixa?: boolean

  /** Nasce desmarcada no seletor de colunas. Para as colunas de conferência. */
  ocultaPorPadrao?: boolean

  /** Largura mínima em CSS (ex.: `'12rem'`). Evita coluna espremida. */
  larguraMin?: string

  papelMobile?: PapelMobile
}

export type Direcao = 'asc' | 'desc'

export interface Ordenacao {
  chave: string
  direcao: Direcao
}

/** Densidade das linhas. `confortavel` é o padrão; `compacta` cabe ~40% mais. */
export type Densidade = 'compacta' | 'confortavel'
