// Gera a biblioteca fixa de ícones de cédula e moeda do Real
// (public/icones-dinheiro/*.png), no mesmo espírito de
// `gerar-icones-produto.mjs`: sem lib de imagem, PNG escrito à mão com só
// `zlib`. Os arquivos ficam versionados no repositório como qualquer outro
// asset estático — rodar de novo só é preciso se um ícone for redesenhado.
//
// Uso: node scripts/gerar-icones-dinheiro.mjs

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const DESTINO = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'icones-dinheiro',
)

const TAMANHO = 64

function novaTela(lado = TAMANHO) {
  return { lado, pixels: new Uint8ClampedArray(lado * lado * 4) }
}

function misturar(baixo, cima, alfaCima) {
  return Math.round(baixo * (1 - alfaCima) + cima * alfaCima)
}

function pintar(tela, x, y, [r, g, b, a]) {
  if (x < 0 || y < 0 || x >= tela.lado || y >= tela.lado) return
  const i = (y * tela.lado + x) * 4
  const alfa = a / 255
  if (alfa >= 1) {
    tela.pixels[i] = r
    tela.pixels[i + 1] = g
    tela.pixels[i + 2] = b
    tela.pixels[i + 3] = 255
    return
  }
  const alfaAtual = tela.pixels[i + 3] / 255
  const alfaFinal = alfa + alfaAtual * (1 - alfa)
  if (alfaFinal <= 0) return
  tela.pixels[i] = misturar(tela.pixels[i], r, alfa)
  tela.pixels[i + 1] = misturar(tela.pixels[i + 1], g, alfa)
  tela.pixels[i + 2] = misturar(tela.pixels[i + 2], b, alfa)
  tela.pixels[i + 3] = Math.round(alfaFinal * 255)
}

function circulo(tela, cx, cy, r, cor) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      if (d <= r - 0.5) pintar(tela, x, y, cor)
      else if (d <= r + 0.5) pintar(tela, x, y, [...cor.slice(0, 3), Math.round(cor[3] * (r + 0.5 - d))])
    }
  }
}

function anel(tela, cx, cy, rExterno, rInterno, cor) {
  for (let y = Math.floor(cy - rExterno - 1); y <= cy + rExterno + 1; y++) {
    for (let x = Math.floor(cx - rExterno - 1); x <= cx + rExterno + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      if (d >= rInterno && d <= rExterno) pintar(tela, x, y, cor)
    }
  }
}

function retanguloArredondado(tela, x0, y0, x1, y1, raio, cor) {
  for (let y = Math.floor(y0 - 1); y <= y1 + 1; y++) {
    for (let x = Math.floor(x0 - 1); x <= x1 + 1; x++) {
      const px = x + 0.5
      const py = y + 0.5
      const dentroX = px >= x0 && px <= x1
      const dentroY = py >= y0 && py <= y1
      let dentro = dentroX && dentroY
      let naBorda = false
      if (dentro && raio > 0) {
        const cantos = [
          [x0 + raio, y0 + raio, -1, -1],
          [x1 - raio, y0 + raio, 1, -1],
          [x0 + raio, y1 - raio, -1, 1],
          [x1 - raio, y1 - raio, 1, 1],
        ]
        for (const [cx, cy, dx, dy] of cantos) {
          const naRegiaoDoCanto = (dx < 0 ? px < cx : px > cx) && (dy < 0 ? py < cy : py > cy)
          if (naRegiaoDoCanto) {
            const d = Math.hypot(px - cx, py - cy)
            if (d > raio) dentro = false
            else if (d > raio - 1) naBorda = true
          }
        }
      }
      if (dentro) pintar(tela, x, y, naBorda ? [...cor.slice(0, 3), Math.round(cor[3] * 0.8)] : cor)
    }
  }
}

// --- fonte de dígitos, 5×7, um bit por pixel ---------------------------

const DIGITOS = {
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
}

/** Desenha um número (string de dígitos) centrado em `(cx, cy)`. */
function numero(tela, texto, cx, cy, cor) {
  const digitos = [...texto]
  // 3 dígitos cabem no mesmo espaço que 1, um pouco mais apertados —
  // "200" e "2" precisam caber na mesma cédula sem estourar a borda.
  const escala = digitos.length >= 3 ? 2 : digitos.length === 2 ? 3 : 5
  const largura = digitos.length * 5 * escala + (digitos.length - 1) * escala
  const altura = 7 * escala
  const x0 = Math.round(cx - largura / 2)
  const y0 = Math.round(cy - altura / 2)

  digitos.forEach((d, indiceDigito) => {
    const bitmap = DIGITOS[d]
    if (!bitmap) return
    const dx0 = x0 + indiceDigito * 6 * escala
    bitmap.forEach((linha, linY) => {
      ;[...linha].forEach((bit, linX) => {
        if (bit !== '1') return
        // Limite **exclusivo**, não o último pixel: é a convenção que
        // `retanguloArredondado` já usa (`px = x + 0.5` contra `x0..x1`) — dois
        // blocos vizinhos (`x1` de um == `x0` do outro) encostam sem vão nem
        // sobreposição. Subtrair 1 aqui foi o que abriu uma coluna de vão entre
        // cada bit aceso do dígito, partindo toda barra contínua em pedaços.
        retanguloArredondado(
          tela,
          dx0 + linX * escala,
          y0 + linY * escala,
          dx0 + linX * escala + escala,
          y0 + linY * escala + escala,
          0,
          cor,
        )
      })
    })
  })
}

// --- PNG -----------------------------------------------------------------

function pngEncode({ lado, pixels }) {
  const assinatura = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  function chunk(tipo, dados) {
    const tipoBuf = Buffer.from(tipo, 'ascii')
    const tamanho = Buffer.alloc(4)
    tamanho.writeUInt32BE(dados.length, 0)
    const crcBuf = Buffer.alloc(4)
    crcBuf.writeUInt32BE(crc32(Buffer.concat([tipoBuf, dados])), 0)
    return Buffer.concat([tamanho, tipoBuf, dados, crcBuf])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(lado, 0)
  ihdr.writeUInt32BE(lado, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const linhas = Buffer.alloc(lado * (lado * 4 + 1))
  for (let y = 0; y < lado; y++) {
    const offLinha = y * (lado * 4 + 1)
    linhas[offLinha] = 0
    pixels.subarray(y * lado * 4, (y + 1) * lado * 4).forEach((v, i) => {
      linhas[offLinha + 1 + i] = v
    })
  }

  const idat = deflateSync(linhas)

  return Buffer.concat([assinatura, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}

const TABELA_CRC = (() => {
  const tabela = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    tabela[n] = c
  }
  return tabela
})()

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = TABELA_CRC[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function salvar(nome, tela) {
  if (!existsSync(DESTINO)) mkdirSync(DESTINO, { recursive: true })
  writeFileSync(path.join(DESTINO, `${nome}.png`), pngEncode(tela))
  console.log(`  ${nome}.png`)
}

// --- desenhos --------------------------------------------------------

const BRANCO = [255, 255, 255, 255]
const ESCURO = [40, 32, 20, 255]

/**
 * Uma cédula: retângulo com a cor da família, uma moldura mais clara por
 * dentro (a margem branca de toda nota de verdade) e um "medalhão" oval mais
 * claro do lado esquerdo — o lugar onde a nota de verdade tem a marca
 * d'água. O número vem por cima, à direita do medalhão.
 */
function desenharCedula(texto, cor, corClara) {
  const tela = novaTela()
  retanguloArredondado(tela, 4, 16, 60, 48, 5, cor)
  retanguloArredondado(tela, 8, 20, 56, 44, 3, [...corClara, 90])
  circulo(tela, 17, 32, 8, [255, 255, 255, 60])
  numero(tela, texto, 41, 32, BRANCO)
  return tela
}

/**
 * Uma moeda: círculo metálico com um anel em relevo perto da borda — o
 * mesmo contorno que separa o centro da borda estriada de toda moeda de
 * verdade. O número vai no centro.
 */
function desenharMoeda(texto, cor, corAnel) {
  const tela = novaTela()
  circulo(tela, 32, 32, 26, cor)
  anel(tela, 32, 32, 26, 23, corAnel)
  numero(tela, texto, 32, 32, ESCURO)
  return tela
}

console.log('Gerando ícones de dinheiro em', DESTINO)

// Notas — cor por família, a mesma que a nota de verdade usa, para o olho
// reconhecer "essa é a laranja" antes de ler o número.
salvar('20000', desenharCedula('200', [217, 60, 110, 255], [255, 170, 195]))
salvar('10000', desenharCedula('100', [30, 140, 160, 255], [160, 230, 235]))
salvar('5000', desenharCedula('50', [200, 130, 40, 255], [250, 205, 140]))
salvar('2000', desenharCedula('20', [210, 175, 30, 255], [250, 230, 140]))
salvar('1000', desenharCedula('10', [205, 60, 55, 255], [250, 170, 160]))
salvar('500', desenharCedula('5', [140, 90, 200, 255], [210, 180, 245]))
salvar('200', desenharCedula('2', [40, 110, 205, 255], [160, 200, 250]))

// Moedas — prateadas, exceto a de R$1, dourada como a de verdade.
salvar('100', desenharMoeda('1', [225, 195, 110, 255], [190, 155, 70, 255]))
salvar('50', desenharMoeda('50', [200, 203, 208, 255], [160, 164, 170, 255]))
salvar('25', desenharMoeda('25', [200, 203, 208, 255], [160, 164, 170, 255]))
salvar('10', desenharMoeda('10', [200, 203, 208, 255], [160, 164, 170, 255]))
salvar('5', desenharMoeda('5', [200, 203, 208, 255], [160, 164, 170, 255]))

console.log('Pronto.')
