// Gera a biblioteca fixa de ícones de produto (public/icones-produto/*.png).
//
// Não depende de nenhuma lib de imagem: escreve o PNG à mão (assinatura +
// chunks IHDR/IDAT/IEND) usando só `zlib`, que já vem no Node. Rodar de novo
// só é preciso se um ícone for redesenhado — os PNGs gerados ficam versionados
// no repositório como qualquer outro asset estático.
//
// Uso: node scripts/gerar-icones-produto.mjs

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const DESTINO = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'icones-produto',
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

// Cada forma cobre um pixel inteiro só se o centro dele estiver dentro do
// contorno, com uma faixa de meio-tom de ~1px na borda pra suavizar o serrilhado.
function circulo(tela, cx, cy, r, cor) {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      if (d <= r - 0.5) pintar(tela, x, y, cor)
      else if (d <= r + 0.5) pintar(tela, x, y, [...cor.slice(0, 3), Math.round(cor[3] * (r + 0.5 - d))])
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
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const linhas = Buffer.alloc(lado * (lado * 4 + 1))
  for (let y = 0; y < lado; y++) {
    const offLinha = y * (lado * 4 + 1)
    linhas[offLinha] = 0 // sem filtro
    pixels.subarray(y * lado * 4, (y + 1) * lado * 4).forEach((v, i) => {
      linhas[offLinha + 1 + i] = v
    })
  }

  const idat = deflateSync(linhas)

  return Buffer.concat([
    assinatura,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// CRC-32 padrão (usado pelos chunks PNG). Tabela calculada uma vez.
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

// --- Desenhos ---------------------------------------------------------

function desenharAgua() {
  const tela = novaTela()
  const azul = [26, 115, 189, 255]
  const azulClaro = [126, 197, 240, 220]
  // gota: círculo + "bico" triangular no topo
  circulo(tela, 32, 38, 20, azul)
  for (let y = 10; y <= 34; y++) {
    const progresso = (y - 10) / 24 // 0 no topo, 1 na base
    const largura = 2 + progresso * 16
    for (let x = 32 - largura; x <= 32 + largura; x++) {
      pintar(tela, Math.round(x), y, azul)
    }
  }
  circulo(tela, 26, 34, 5, azulClaro) // brilho
  return tela
}

function desenharGas() {
  const tela = novaTela()
  const laranja = [217, 95, 33, 255]
  const laranjaEscuro = [170, 70, 22, 255]
  retanguloArredondado(tela, 18, 22, 46, 54, 6, laranja) // corpo do botijão
  retanguloArredondado(tela, 26, 12, 38, 24, 3, laranjaEscuro) // registro/válvula
  retanguloArredondado(tela, 14, 48, 50, 54, 2, laranjaEscuro) // base
  return tela
}

function desenharVasilhame() {
  const tela = novaTela()
  const azul = [37, 99, 178, 255]
  retanguloArredondado(tela, 16, 20, 46, 52, 7, azul) // corpo do galão
  retanguloArredondado(tela, 24, 10, 34, 22, 2, azul) // gargalo
  // alça (vazado)
  retanguloArredondado(tela, 40, 22, 50, 36, 4, azul)
  retanguloArredondado(tela, 42, 24, 48, 34, 3, [0, 0, 0, 0])
  return tela
}

function desenharAcessorio() {
  const tela = novaTela()
  const cinza = [90, 99, 112, 255]
  retanguloArredondado(tela, 14, 26, 50, 38, 4, cinza) // corpo da chave
  circulo(tela, 16, 32, 9, cinza)
  circulo(tela, 16, 32, 4, [0, 0, 0, 0])
  circulo(tela, 48, 32, 9, cinza)
  circulo(tela, 48, 32, 4, [0, 0, 0, 0])
  return tela
}

function desenharGenerico() {
  const tela = novaTela()
  const cinza = [130, 138, 150, 255]
  retanguloArredondado(tela, 14, 18, 50, 50, 4, cinza) // caixa
  retanguloArredondado(tela, 14, 26, 50, 30, 0, [90, 98, 110, 255]) // fita
  return tela
}

console.log('Gerando ícones de produto em', DESTINO)
salvar('agua', desenharAgua())
salvar('gas', desenharGas())
salvar('vasilhame', desenharVasilhame())
salvar('acessorio', desenharAcessorio())
salvar('generico', desenharGenerico())
console.log('Pronto.')
