// Processa as fotos reais de cédulas e moedas em `cedulas/` (fora do
// versionamento) e gera `public/icones-dinheiro/*.png`: recorta a borda de
// fundo (branco ou o quadriculado de transparência que veio embutido no
// JPEG), aplica máscara — retângulo arredondado para nota, círculo para
// moeda — e escala para um tamanho consistente com fundo transparente.
//
// Uso: node scripts/processar-cedulas.mjs
import sharp from 'sharp'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const ORIGEM = path.join(RAIZ, 'cedulas')
const DESTINO = path.join(RAIZ, 'public', 'icones-dinheiro')

/**
 * Recorta pixels que são "fundo": próximos do branco, ou o quadriculado
 * cinza/branco que aparece quando um PNG transparente é achatado em JPEG.
 * Varre linha e coluna de fora para dentro e para no primeiro pixel que foge
 * dos dois padrões — é mais tolerante que o `trim()` do sharp, que exige um
 * fundo uniforme e falha com o leve gradiente de sombra sob as moedas.
 */
function ehFundo(r, g, b) {
  const quaseBranco = r > 225 && g > 225 && b > 225
  // Quadriculado: cinza neutro (R≈G≈B) em qualquer tom, não só branco.
  const neutro = Math.max(r, g, b) - Math.min(r, g, b) < 10 && r > 180
  return quaseBranco || neutro
}

async function bboxConteudo(caminho) {
  const { data, info } = await sharp(caminho).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  let minX = width, minY = height, maxX = -1, maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      if (!ehFundo(data[i], data[i + 1], data[i + 2])) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return { left: 0, top: 0, width, height }
  // Folga de 2% para não colar a moeda/nota na borda do recorte.
  const folgaX = Math.round(width * 0.01)
  const folgaY = Math.round(height * 0.01)
  const left = Math.max(0, minX - folgaX)
  const top = Math.max(0, minY - folgaY)
  const right = Math.min(width, maxX + folgaX + 1)
  const bottom = Math.min(height, maxY + folgaY + 1)
  return { left, top, width: right - left, height: bottom - top }
}

/** Máscara SVG: retângulo arredondado (nota) ou círculo (moeda), branco sobre
 *  transparente — o alfa da máscara vira o alfa da foto ao compor com `dest-in`. */
function mascara(largura, altura, tipo) {
  const forma =
    tipo === 'moeda'
      ? `<circle cx="${largura / 2}" cy="${altura / 2}" r="${Math.min(largura, altura) / 2}" fill="#fff"/>`
      : `<rect x="0" y="0" width="${largura}" height="${altura}" rx="${altura * 0.09}" fill="#fff"/>`
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}">${forma}</svg>`,
  )
}

async function processar(arquivoOrigem, nomeDestino, tipo, alturaAlvo) {
  const origem = path.join(ORIGEM, arquivoOrigem)
  const caixa = await bboxConteudo(origem)
  const recortado = await sharp(origem).extract(caixa).toBuffer()
  const meta = await sharp(recortado).metadata()

  const largura =
    tipo === 'moeda' ? alturaAlvo : Math.round((alturaAlvo * meta.width) / meta.height)
  const alturaFinal = tipo === 'moeda' ? alturaAlvo : alturaAlvo

  const redimensionado = await sharp(recortado)
    .resize(largura, alturaFinal, { fit: tipo === 'moeda' ? 'cover' : 'fill' })
    .ensureAlpha()
    .toBuffer()

  const final = await sharp(redimensionado)
    .composite([{ input: mascara(largura, alturaFinal, tipo), blend: 'dest-in' }])
    .png()
    .toBuffer()

  if (!existsSync(DESTINO)) mkdirSync(DESTINO, { recursive: true })
  writeFileSync(path.join(DESTINO, `${nomeDestino}.png`), final)
  console.log(`  ${nomeDestino}.png  (${largura}x${alturaFinal}, de ${arquivoOrigem})`)
}

/** Altura-base: moeda vira quadrado ALTURA×ALTURA; nota mantém a proporção
 *  real (~2,1:1) na mesma altura, então elas convivem bem lado a lado. */
const ALTURA = 72

console.log('Processando cédulas e moedas reais em', DESTINO)

await processar('200_front.jpg', '20000', 'nota', ALTURA)
await processar('Atual_cédula_de_100_reais_anverso.jpg', '10000', 'nota', ALTURA)
await processar('Anverso_da_cédula_de_50_reais.png', '5000', 'nota', ALTURA)
await processar('Anverso_da_cédula_de_20_reais.png', '2000', 'nota', ALTURA)
await processar('Anverso_da_cédula_de_10_reais.png', '1000', 'nota', ALTURA)
await processar('Anverso_da_cédula_de_5_reais.png', '500', 'nota', ALTURA)
await processar('2.jpg', '200', 'nota', ALTURA)

await processar('1 real.jpg', '100', 'moeda', ALTURA)
await processar('50 centavos.png', '50', 'moeda', ALTURA)
await processar('25 centavos .jpg', '25', 'moeda', ALTURA)
await processar('10 centavos.jpg', '10', 'moeda', ALTURA)
await processar('5 centavos.jpg', '5', 'moeda', ALTURA)

console.log('Pronto.')
