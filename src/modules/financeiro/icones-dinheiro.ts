/**
 * Biblioteca fixa de ícones de cédula e moeda do Real, versionada em
 * `public/icones-dinheiro/`. A chave é o valor em centavos, o mesmo que
 * `quebrarTroco` (em `pdv.tsx`) já usa para decidir quantas de cada separar.
 *
 * As doze são foto real, recortada e mascarada por
 * `scripts/processar-cedulas.mjs` a partir de fotos em `cedulas/` (fora do
 * repositório, fora do controle de versão).
 */

export const VALORES_DINHEIRO = [
  20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 25, 10, 5,
] as const

export type ValorDinheiro = (typeof VALORES_DINHEIRO)[number]

export function caminhoIconeDinheiro(centavos: number): string | null {
  return (VALORES_DINHEIRO as readonly number[]).includes(centavos)
    ? `/icones-dinheiro/${centavos}.png`
    : null
}
