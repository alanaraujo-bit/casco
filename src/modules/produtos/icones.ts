/**
 * Biblioteca fixa de ícones de referência para produto — não é upload: a
 * operadora escolhe um PNG pronto (gerado por `scripts/gerar-icones-produto.mjs`,
 * versionado em `public/icones-produto/`). Evita depender de armazenamento de
 * arquivo, que o projeto não tem hoje.
 */

export const ICONES_PRODUTO = [
  { chave: 'agua', rotulo: 'Água' },
  { chave: 'gas', rotulo: 'Gás' },
  { chave: 'vasilhame', rotulo: 'Vasilhame' },
  { chave: 'acessorio', rotulo: 'Acessório' },
  { chave: 'generico', rotulo: 'Genérico' },
] as const

export type ChaveIconeProduto = (typeof ICONES_PRODUTO)[number]['chave']

export const CHAVES_ICONE_PRODUTO = ICONES_PRODUTO.map((i) => i.chave)

export function caminhoIconeProduto(chave: string | null | undefined): string | null {
  if (!chave) return null
  return CHAVES_ICONE_PRODUTO.includes(chave as ChaveIconeProduto)
    ? `/icones-produto/${chave}.png`
    : null
}
