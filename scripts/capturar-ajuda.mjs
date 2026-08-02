/**
 * Grava os vídeos (GIF) das telas para a Central de Ajuda (`src/lib/ajuda.ts`),
 * abrindo um Chrome de verdade pelo protocolo de depuração — mesma técnica do
 * `scripts/fluxo.mjs`, sem Playwright.
 *
 * **O vídeo mostra o fluxo inteiro, do começo ao fim.** Não é uma sequência de
 * fotos de estados: a gravação é contínua (`Page.startScreencast`), o ponteiro
 * anda até cada campo e o texto é digitado caractere a caractere, no ritmo de
 * quem está usando o sistema. Quem assiste consegue repetir o que viu sem ler
 * uma linha — que é o ponto inteiro de ter vídeo em vez de texto.
 *
 * Precisa de uma conta de desenvolvimento já existente, com ao menos um
 * vasilhame cadastrado. Todo lançamento criado para a demonstração é estornado
 * ao fim da própria captura, pelo mesmo motivo do `PREFIXO` no `fluxo.mjs`:
 * não sujar o banco que também serve para conferir telas na mão.
 *
 *     node scripts/capturar-ajuda.mjs --email dono@exemplo.com --senha "..."
 *     node scripts/capturar-ajuda.mjs --artigo baixa-vasilhame --ver
 *
 * Sem `--artigo`, grava todos os artigos com sequência conhecida, em sequência.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PNG } from 'pngjs'
// `gifenc` é CommonJS; import nomeado direto quebra em ESM ("Named export not found").
import gifenc from 'gifenc'
const { GIFEncoder, quantize, applyPalette } = gifenc

const args = process.argv.slice(2)
const arg = (n) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 ? args[i + 1] : undefined
}

// Mesma ressalva do `fluxo.mjs`: `localhost`, nunca `127.0.0.1` — são origens
// diferentes para o navegador e o Next 16 só serve os pacotes do cliente para
// a origem certa.
const BASE = arg('url') ?? 'http://localhost:3210'
const EMAIL = arg('email') ?? process.env.CAPTURA_AJUDA_EMAIL
const SENHA = arg('senha') ?? process.env.CAPTURA_AJUDA_SENHA
const VER = args.includes('--ver')
/**
 * `--quadros` despeja quadros amostrados como PNG numa pasta temporária.
 *
 * Existe porque o projeto exige conferir com os próprios olhos, e um GIF
 * pronto não se abre no meio do terminal. Sem isto a única forma de saber se o
 * vídeo mostra o fluxo inteiro é confiar na contagem de quadros — que foi
 * exatamente o erro que produziu a primeira versão, curta e sem ação.
 */
const DESPEJAR = args.includes('--quadros')
const SAIDA = path.resolve('public/ajuda')

/**
 * A janela gravada, por artigo.
 *
 * Não é uma largura só, e a razão é a legibilidade do vídeo dentro do artigo:
 * a gravação é exibida sempre na mesma largura da página, então **quanto mais
 * larga a captura, menor o texto na tela de quem lê**. Cada artigo usa a menor
 * janela em que a tela dele aparece inteira.
 *
 * As telas de tabela precisam de 1360: abaixo disso a coluna de correção sai
 * da área visível, o navegador rola a tabela para o lado ao alcançar o botão,
 * e o vídeo corta Data e Motivo bem no quadro em que ensina a achar a linha
 * certa. O formulário de baixa cabe com folga em 1120.
 */
const JANELA_PADRAO = { width: 1360, height: 720 }
const JANELA_POR_ARTIGO = {
  'baixa-vasilhame': { width: 1120, height: 720 },
}

/** ~12 quadros por segundo: fluido para o olho e metade do peso de 24. */
const INTERVALO_MIN_MS = 80

if (!EMAIL || !SENHA) {
  console.error(
    'Faltou credencial. Use --email e --senha (ou CAPTURA_AJUDA_EMAIL/CAPTURA_AJUDA_SENHA),\n' +
      'de uma conta de desenvolvimento já existente com ao menos um vasilhame cadastrado.',
  )
  process.exit(1)
}

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => existsSync(p))

if (!CHROME) {
  console.error('Nenhum Chrome ou Edge encontrado.')
  process.exit(1)
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

/* ------------------------------------------------------------------ CDP */

let proximoId = 0
const pendentes = new Map()
/** Assinantes de evento do CDP (`Page.screencastFrame` e afins). */
const ouvintes = new Map()
let ws
let sessao

function conectar(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url)
    socket.addEventListener('open', () => resolve(socket))
    socket.addEventListener('error', reject)
    socket.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)

      // Evento não tem `id`. É por aqui que os quadros do screencast chegam —
      // o CDP os empurra conforme a tela muda, em vez de responder a um pedido.
      if (!msg.id) {
        ouvintes.get(msg.method)?.(msg.params)
        return
      }

      const p = pendentes.get(msg.id)
      if (!p) return
      pendentes.delete(msg.id)
      if (msg.error) p.reject(new Error(msg.error.message))
      else p.resolve(msg.result)
    })
  })
}

function comando(method, params = {}) {
  const id = ++proximoId
  return new Promise((resolve, reject) => {
    pendentes.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params, sessionId: sessao }))
    setTimeout(() => {
      if (pendentes.delete(id)) reject(new Error(`timeout em ${method}`))
    }, 30_000)
  })
}

/** Avalia JS na página e devolve o valor já desserializado. Ver `fluxo.mjs`. */
async function js(expressao) {
  const r = await comando('Runtime.evaluate', {
    expression: `(async () => { ${expressao} })()`,
    returnByValue: true,
    awaitPromise: true,
  })
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description ?? 'erro no script da página')
  }
  return r.result.value
}

/**
 * Espera generosa de propósito: 45s, não 15s.
 *
 * Este script roda contra o `next dev`, que compila rota por rota no primeiro
 * acesso — e recompila a cada arquivo salvo. Com alguém programando em
 * paralelo, uma recompilação no meio da gravação estourava o prazo e a captura
 * morria já no meio, culpando a tela por uma demora do compilador.
 */
async function esperarPor(condicao, oque, ms = 45_000) {
  const limite = Date.now() + ms
  while (Date.now() < limite) {
    try {
      if (await condicao()) return true
    } catch {
      /* página trocando no meio da avaliação */
    }
    await espera(150)
  }
  throw new Error(`esperando ${oque} (${ms}ms)`)
}

const caminhoAtual = () => js('return location.pathname')

async function irPara(rota) {
  await comando('Page.navigate', { url: BASE + rota })
  await esperarPor(() => js(`return document.readyState === 'complete'`), `carregar ${rota}`)
  await espera(500) // React hidratando
  await injetarPonteiro()
}

async function esperarCaminho(condicao, oque) {
  await esperarPor(async () => condicao(await caminhoAtual()), oque)
  await esperarPor(
    () => js(`return document.readyState === 'complete' && !!document.body`),
    `${oque} terminar de carregar`,
  )
  await espera(400)
}

/* ------------------------------------------------------------ gravação
 *
 * `Page.startScreencast` empurra um quadro a cada mudança visível, o que dá
 * duas coisas de graça: fluidez de verdade (o ponteiro andando, o texto
 * aparecendo letra a letra) e nenhum quadro gasto enquanto a tela está parada.
 * O tempo de cada quadro sai do relógio real, então uma pausa de leitura vira
 * um quadro longo em vez de trinta iguais.
 */
const gravacao = { ativa: false, quadros: [], ultimoMs: 0, janela: JANELA_PADRAO }

/** Aplica a janela do artigo antes de navegar — o layout depende da largura. */
async function usarJanela(slug) {
  gravacao.janela = JANELA_POR_ARTIGO[slug] ?? JANELA_PADRAO
  await comando('Emulation.setDeviceMetricsOverride', {
    ...gravacao.janela,
    deviceScaleFactor: 1,
    mobile: false,
  })
}

function ligarOuvinteDeQuadros() {
  ouvintes.set('Page.screencastFrame', (params) => {
    // O ack é obrigatório: sem ele o Chrome para de mandar depois do primeiro.
    comando('Page.screencastFrameAck', { sessionId: params.sessionId }).catch(() => {})
    if (!gravacao.ativa) return

    const agora = Date.now()
    const desdeUltimo = gravacao.ultimoMs ? agora - gravacao.ultimoMs : 0

    // Descarta o excesso quando a tela muda mais rápido que o alvo de fps —
    // dois quadros a 8ms de distância não acrescentam nada ao que se vê e
    // pesam igual aos outros.
    if (gravacao.quadros.length > 0 && desdeUltimo < INTERVALO_MIN_MS) return

    // A duração de um quadro é o tempo até o próximo chegar — relógio real, e
    // não um número escolhido aqui. É isto que faz uma pausa de leitura virar
    // um quadro longo automaticamente, sem ninguém precisar somar nada.
    if (gravacao.quadros.length > 0) {
      gravacao.quadros[gravacao.quadros.length - 1].duracaoMs = desdeUltimo
    }
    gravacao.quadros.push({ png: Buffer.from(params.data, 'base64'), duracaoMs: INTERVALO_MIN_MS })
    gravacao.ultimoMs = agora
  })
}

async function iniciarGravacao() {
  gravacao.quadros = []
  gravacao.ultimoMs = 0
  gravacao.ativa = true
  await comando('Page.startScreencast', {
    format: 'png',
    maxWidth: gravacao.janela.width,
    maxHeight: gravacao.janela.height,
    everyNthFrame: 1,
  })
  await espera(250) // deixa o primeiro quadro chegar antes da ação começar
}

/**
 * Encerra a gravação segurando o último quadro.
 *
 * O último quadro não tem um "próximo" para medir a duração dele, e é
 * justamente o desfecho — o comprovante, a linha estornada. Sem esse segundo e
 * meio ele pisca e o laço reinicia antes de dar para ler.
 */
async function pararGravacao(seguraFinalMs = 2200) {
  gravacao.ativa = false
  await comando('Page.stopScreencast').catch(() => {})
  const ultimo = gravacao.quadros[gravacao.quadros.length - 1]
  if (ultimo) ultimo.duracaoMs = seguraFinalMs
  return gravacao.quadros
}

/**
 * Pausa que **conta como tempo de vídeo**.
 *
 * É só um `espera()`: quem transforma isso em quadro longo é o ouvinte acima,
 * que mede a duração de cada quadro pelo tempo até o seguinte. Somar a pausa à
 * mão aqui era pior do que não fazer nada — o quadro que chegasse logo depois
 * sobrescrevia a soma, e todo o tempo de leitura sumia do vídeo.
 */
const pausar = espera

/* ------------------------------------------------------------- interação */

function seletorPorTexto(fonteRegex, seletorBase) {
  return `
    const re = new RegExp(${JSON.stringify(fonteRegex)})
    const els = [...document.querySelectorAll(${JSON.stringify(seletorBase)})]
    const el = els.find((e) => re.test(e.textContent || ''))
  `
}

async function coordsDoElemento(fonteRegex, seletorBase = 'button, a, label') {
  return js(`
    ${seletorPorTexto(fonteRegex, seletorBase)}
    if (!el) return null
    el.scrollIntoView({ block: 'center', behavior: 'instant' })
    await new Promise((r) => setTimeout(r, 60))
    const r2 = el.getBoundingClientRect()
    return { x: Math.round(r2.left + r2.width / 2), y: Math.round(r2.top + r2.height / 2) }
  `)
}

async function coordsDoSeletor(seletor) {
  return js(`
    const el = document.querySelector(${JSON.stringify(seletor)})
    if (!el) return null
    el.scrollIntoView({ block: 'center', behavior: 'instant' })
    await new Promise((r) => setTimeout(r, 60))
    const r2 = el.getBoundingClientRect()
    return { x: Math.round(r2.left + r2.width / 2), y: Math.round(r2.top + r2.height / 2) }
  `)
}

/**
 * Leva o ponteiro até o alvo com aceleração e desaceleração.
 *
 * Movimento linear parece máquina; este `easeInOutQuad` parece mão. Num vídeo
 * de ensino a diferença não é estética: o olho acompanha melhor o que
 * desacelera ao chegar, e é justamente na chegada que está a informação —
 * qual campo vai ser usado agora.
 */
async function moverPonteiro(alvo, duracaoMs = 620) {
  if (!alvo) return
  const origem = (await js('return window.__ponteiroPos')) ?? { x: 60, y: 60 }
  const passos = Math.max(8, Math.round(duracaoMs / 40))
  for (let i = 1; i <= passos; i++) {
    const t = i / passos
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
    const x = Math.round(origem.x + (alvo.x - origem.x) * e)
    const y = Math.round(origem.y + (alvo.y - origem.y) * e)
    await js(`window.__moverPonteiro(${x}, ${y})`)
    await espera(40)
  }
}

/** Ponteiro até o elemento, o "clique" visual, e o clique de verdade. */
async function clicarComPonteiro(fonteRegex, seletorBase = 'button, a, label') {
  const alvo = await coordsDoElemento(fonteRegex, seletorBase)
  if (!alvo) return false
  await moverPonteiro(alvo)
  await js('window.__pulsarPonteiro()')
  await espera(180)
  await js(`
    ${seletorPorTexto(fonteRegex, seletorBase)}
    el?.click()
  `)
  await espera(280)
  return true
}

async function clicarSeletorComPonteiro(seletor) {
  const alvo = await coordsDoSeletor(seletor)
  if (!alvo) return false
  await moverPonteiro(alvo)
  await js('window.__pulsarPonteiro()')
  await espera(180)
  await js(`document.querySelector(${JSON.stringify(seletor)})?.click()`)
  await espera(280)
  return true
}

/**
 * Digita letra por letra, como a operadora digitaria.
 *
 * O setter nativo antes do evento é a mesma ressalva do `fluxo.mjs`: React
 * guarda o valor num descritor próprio e ignora `el.value = x` em campo
 * controlado.
 */
async function digitar(nome, texto, msPorTecla = 55) {
  const alvo = await coordsDoSeletor(`[name="${nome}"]`)
  await moverPonteiro(alvo, 520)
  await js('window.__pulsarPonteiro()')
  await js(`document.querySelector('[name="${nome}"]')?.focus()`)
  await espera(200)

  for (let i = 1; i <= texto.length; i++) {
    await js(`
      const el = document.querySelector('[name="${nome}"]')
      if (el) {
        const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(texto.slice(0, i))})
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
    `)
    await espera(msPorTecla)
  }
  await espera(150)
}

/**
 * Rola a página em passos, e não de uma vez.
 *
 * `scrollTo({behavior:'smooth'})` resolveria para o olho humano, mas a
 * gravação só recebe quadro quando a tela muda: um salto único vira dois
 * quadros e o espectador perde o que passou no meio. Em passos, a rolagem
 * aparece como rolagem — que numa tela de listagem é metade do que se está
 * ensinando a ler.
 */
async function rolarAte(destinoY, duracaoMs = 1400) {
  const origem = (await js('return window.scrollY')) ?? 0
  const passos = Math.max(10, Math.round(duracaoMs / 45))
  for (let i = 1; i <= passos; i++) {
    const t = i / passos
    const e = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2
    await js(`window.scrollTo(0, ${Math.round(origem + (destinoY - origem) * e)})`)
    await espera(45)
  }
}

/** Escolhe num `<select>`, com o ponteiro indo até ele antes. */
async function escolher(nome, valorOuIndice) {
  const alvo = await coordsDoSeletor(`[name="${nome}"]`)
  await moverPonteiro(alvo, 520)
  await js('window.__pulsarPonteiro()')
  await espera(200)
  await js(`
    const el = document.querySelector('[name="${nome}"]')
    if (el) {
      const valor = ${typeof valorOuIndice === 'number'
        ? `el.options[${valorOuIndice}]?.value`
        : JSON.stringify(valorOuIndice)}
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, valor)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
  `)
  await espera(300)
}

/* ------------------------------------------------------------- ponteiro
 *
 * O CDP não desenha cursor no modo headless. Sem indicação visual o vídeo vira
 * uma tela que muda sozinha, e quem assiste não sabe onde a pessoa clicou —
 * exatamente o que este arquivo existe para evitar.
 */
async function injetarPonteiro() {
  await js(`
    if (document.getElementById('casco-ajuda-ponteiro')) return
    const estilo = document.createElement('style')
    estilo.textContent = \`
      /* O selo do servidor de desenvolvimento ("N", "Rendering...") fica por
         cima do canto inferior direito e entraria no video. E andaime de
         desenvolvimento: a distribuidora nunca ve isso, e a Central de Ajuda
         nao pode ensinar uma tela diferente da que ela usa. */
      nextjs-portal { display: none !important; }
      #casco-ajuda-ponteiro {
        position: fixed; z-index: 2147483647; width: 24px; height: 24px;
        margin-left: -3px; margin-top: -2px; pointer-events: none;
        filter: drop-shadow(0 2px 4px rgba(0,0,0,.55));
      }
      #casco-ajuda-pulso {
        position: fixed; z-index: 2147483646; width: 34px; height: 34px;
        margin-left: -17px; margin-top: -17px; border-radius: 999px;
        pointer-events: none; opacity: 0;
        border: 2px solid oklch(0.624 0.108 200);
        background: oklch(0.624 0.108 200 / 0.28);
      }
      #casco-ajuda-pulso.ativo { animation: casco-ajuda-pulsar 420ms ease-out; }
      @keyframes casco-ajuda-pulsar {
        0%   { opacity: .95; transform: scale(.35); }
        100% { opacity: 0;   transform: scale(1.5); }
      }
    \`
    document.head.appendChild(estilo)

    const ponteiro = document.createElement('div')
    ponteiro.id = 'casco-ajuda-ponteiro'
    ponteiro.innerHTML = \`<svg viewBox="0 0 24 24" width="24" height="24">
      <path d="M4 2 L4 20 L9 15.5 L12.5 22 L15.5 20.5 L12 14 L19 14 Z" fill="white" stroke="black" stroke-width="1.3"/>
    </svg>\`
    const pulso = document.createElement('div')
    pulso.id = 'casco-ajuda-pulso'
    document.body.append(ponteiro, pulso)

    const pos = { x: 60, y: 60 }
    const aplicar = () => {
      ponteiro.style.left = pos.x + 'px'
      ponteiro.style.top = pos.y + 'px'
      pulso.style.left = pos.x + 'px'
      pulso.style.top = pos.y + 'px'
    }
    aplicar()
    window.__ponteiroPos = pos
    window.__moverPonteiro = (x, y) => { pos.x = x; pos.y = y; window.__ponteiroPos = { x, y }; aplicar() }
    window.__pulsarPonteiro = () => {
      pulso.classList.remove('ativo')
      void pulso.offsetWidth
      pulso.classList.add('ativo')
    }
  `)
}

/* ------------------------------------------------------------- sequências */

const ROTA = {
  'baixa-vasilhame': '/vasilhame/baixa',
  'saldo-vasilhame': '/vasilhame/saldos',
  'movimentos-vasilhame': '/vasilhame/movimentos',
  pdv: '/vendas/pdv',
  'vendas-produtos': '/vendas/produtos',
}

const OBSERVACAO_DEMO = '[ajuda] gravação da Central de Ajuda'

/** Estorna o lançamento mais recente — é sempre o que a gravação acabou de criar. */
async function estornarUltimoLancamento() {
  await irPara(ROTA['movimentos-vasilhame'])
  const PRIMEIRA = `document.querySelector('tbody tr')`
  const temBotao = await js(`
    const b = [...(${PRIMEIRA}?.querySelectorAll('button') ?? [])].find((b) => /estornar/i.test(b.textContent))
    return !!b
  `)
  if (!temBotao) {
    console.warn('  (não achei o botão Estornar para desfazer o lançamento da gravação)')
    return
  }
  await js(`
    const b = [...(${PRIMEIRA}?.querySelectorAll('button') ?? [])].find((b) => /estornar/i.test(b.textContent))
    b?.click()
  `)
  await espera(250)
  await js(`
    const b = [...(${PRIMEIRA}?.querySelectorAll('button') ?? [])].find((b) => /confirmar/i.test(b.textContent))
    b?.click()
  `)
  await espera(600)
}

/**
 * Baixa de Vasilhame, do início ao fim: chegar na tela, escolher o motivo,
 * escolher o vasilhame, a quantidade, o cliente, a observação, lançar, e ler
 * o comprovante. É o fluxo que o artigo descreve em quatro passos.
 */
async function sequenciaBaixaVasilhame() {
  await irPara(ROTA['baixa-vasilhame'])
  await iniciarGravacao()
  await pausar(1100) // a tela inteira, antes de qualquer coisa acontecer

  // 1. O motivo. Sem âncora no regex: o `<label>` carrega o selo "custo" junto
  //    no `textContent` ("Quebradocusto"), então `^Quebrado$` não casaria.
  await clicarComPonteiro('Quebrado', 'label')
  await pausar(1500) // o painel de custo aparece e precisa de tempo de leitura

  // 2. Vasilhame e quantidade.
  await escolher('produtoId', 0)
  await pausar(500)
  await digitar('quantidade', '2')
  await pausar(700)

  // 3. O cliente, e o saldo dele aparecendo antes de gravar.
  const temCliente = await js(`return !!document.querySelector('[name="clienteId"]')`)
  if (temCliente) {
    await escolher('clienteId', 1)
    await pausar(1500) // a linha "está com N vasilhames hoje" aparece aqui
  }

  // 4. Observação e lançamento.
  await digitar('observacao', OBSERVACAO_DEMO, 32)
  await pausar(600)
  await clicarComPonteiro('Lançar baixa', 'button')
  await esperarPor(() => js(`return !!document.querySelector('[role="status"]')`), 'recibo aparecer')

  /**
   * Sobe até o comprovante — **sem isto o vídeo termina em "Lançando…"**.
   *
   * O recibo é o primeiro filho da página, e a essa altura a tela está rolada
   * lá embaixo, no botão. Ele aparece fora do quadro: a gravação mostrava o
   * fluxo inteiro e escondia justamente o desfecho, que é a única parte que
   * responde "e como eu sei que deu certo?".
   */
  await js('window.scrollTo({ top: 0, behavior: "smooth" })')
  await espera(700)
  await pausar(3000) // o comprovante com o novo saldo, tempo de ler inteiro

  const quadros = await pararGravacao()
  await estornarUltimoLancamento()
  return quadros
}

/** Saldo por Cliente: o cabeçalho, a lista, o atalho e o extrato do cliente. */
async function sequenciaSaldoVasilhame() {
  await irPara(ROTA['saldo-vasilhame'])
  await iniciarGravacao()
  await pausar(1800) // os quatro cartões de métrica, tempo de ler

  // Desce pela lista de clientes: é o corpo da tela, e passar direto para o
  // extrato deixaria de fora justamente o que a pessoa veio ver.
  await rolarAte(340, 1500)
  await pausar(1900)
  await rolarAte(0, 1100)
  await pausar(600)

  const temAtalho = await js(`return !!document.querySelector('a[href^="/vasilhame/saldos/"]')`)
  if (temAtalho) {
    await clicarSeletorComPonteiro('a[href^="/vasilhame/saldos/"]')
    await esperarPor(
      () => js(`return location.pathname.split('/').length > 3`),
      'abrir o extrato do cliente',
    )
    await espera(700)
    await injetarPonteiro()
    await pausar(2400) // o saldo separado por tipo de vasilhame
    await rolarAte(360, 1400) // e o histórico, que explica de onde o saldo veio
    await pausar(2600)
  }

  return pararGravacao()
}

/** Movimentos: a lista, e o estorno em dois toques, do início ao fim. */
async function sequenciaMovimentosVasilhame() {
  // Um lançamento neutro (transferência interna, sem cliente e sem custo) só
  // para existir algo real para estornar na demonstração.
  await irPara(ROTA['baixa-vasilhame'])
  await js(`
    ${seletorPorTexto('Enviado à fábrica', 'label')}
    el?.click()
  `)
  await espera(300)
  await js(`
    const el = document.querySelector('[name="observacao"]')
    if (el) {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, ${JSON.stringify(OBSERVACAO_DEMO)})
      el.dispatchEvent(new Event('input', { bubbles: true }))
    }
  `)
  await js(`
    ${seletorPorTexto('Lançar baixa', 'button')}
    el?.click()
  `)
  await esperarPor(
    () => js(`return !!document.querySelector('[role="status"]')`),
    'lançamento de demonstração',
  )

  await irPara(ROTA['movimentos-vasilhame'])
  await iniciarGravacao()
  await pausar(1800) // o resumo de perda do mês, no topo

  // Desce até a lista, que é o assunto da tela.
  await rolarAte(300, 1300)
  await pausar(1800)

  const PRIMEIRA = `document.querySelector('tbody tr')`
  const alvo = await js(`
    const tr = ${PRIMEIRA}
    const b = tr && [...tr.querySelectorAll('button')].find((b) => /estornar/i.test(b.textContent))
    if (!b) return null
    b.scrollIntoView({ block: 'center', behavior: 'instant' })
    await new Promise((r) => setTimeout(r, 60))
    const r2 = b.getBoundingClientRect()
    return { x: Math.round(r2.left + r2.width / 2), y: Math.round(r2.top + r2.height / 2) }
  `)

  if (!alvo) {
    console.warn('  (linha do lançamento de demonstração não encontrada em Movimentos)')
    return pararGravacao()
  }

  await moverPonteiro(alvo)
  await js('window.__pulsarPonteiro()')
  await espera(180)
  await js(`
    const b = [...(${PRIMEIRA}?.querySelectorAll('button') ?? [])].find((b) => /estornar/i.test(b.textContent))
    b?.click()
  `)
  await pausar(1600) // aparecem "Confirmar" e "Cancelar" — o segundo toque

  const alvoConfirmar = await js(`
    const b = [...(${PRIMEIRA}?.querySelectorAll('button') ?? [])].find((b) => /confirmar/i.test(b.textContent))
    if (!b) return null
    const r2 = b.getBoundingClientRect()
    return { x: Math.round(r2.left + r2.width / 2), y: Math.round(r2.top + r2.height / 2) }
  `)
  await moverPonteiro(alvoConfirmar, 460)
  await js('window.__pulsarPonteiro()')
  await espera(180)
  await js(`
    const b = [...(${PRIMEIRA}?.querySelectorAll('button') ?? [])].find((b) => /confirmar/i.test(b.textContent))
    b?.click()
  `)
  await espera(700)
  await pausar(2600) // a linha nova de estorno no topo da lista

  return pararGravacao()
}

/**
 * PDV, do início ao fim: escolher um produto retornável, aumentar a
 * quantidade, escolher o cliente, registrar o vasilhame devolvido, informar o
 * valor recebido e fechar. Os botões de vasilhame e quantidade são achados
 * pelo prefixo do `aria-label` — não pelo nome do produto, que muda de banco
 * para banco — e o produto em si pelo texto "retornável" que só aparece nos
 * cartões de água/gás com casco.
 *
 * Diferente da baixa de vasilhame, uma venda não tem estorno (roadmap: o
 * cancelamento de venda ainda não tem tela). A venda de demonstração fica
 * gravada na conta de desenvolvimento usada para capturar — o mesmo motivo
 * pelo qual este script exige uma conta própria para isso, nunca a de
 * produção.
 */
async function sequenciaPdv() {
  await irPara(ROTA['pdv'])
  await iniciarGravacao()
  await pausar(1000) // a tela inteira, catálogo e carrinho vazio

  // 1. Um produto retornável, para o contador de vasilhame aparecer depois.
  const achouRetornavel = await clicarComPonteiro('retornável', 'button')
  if (!achouRetornavel) {
    // Sem produto retornável cadastrado, segue com o primeiro da lista —
    // a demonstração ainda mostra o carrinho e o pagamento, só sem o
    // contador de vasilhame.
    await clicarSeletorComPonteiro('.mt-4.grid.gap-2 button')
  }
  await pausar(900)

  // 2. Quantidade: 1 → 2.
  await clicarSeletorComPonteiro('button[aria-label^="Aumentar "]')
  await pausar(700)

  // 3. O cliente — é o que faz o contador de vasilhame devolvido aparecer.
  await escolher('clienteId', 1)
  await pausar(1400) // a linha "já está com N vasilhames hoje" aparece aqui

  // 4. Vasilhame devolvido, se o contador existir para este produto.
  const temContador = await js(
    `return !!document.querySelector('button[aria-label^="Mais vasilhame devolvido de "]')`,
  )
  if (temContador) {
    await clicarSeletorComPonteiro('button[aria-label^="Mais vasilhame devolvido de "]')
    await espera(200)
    await clicarSeletorComPonteiro('button[aria-label^="Mais vasilhame devolvido de "]')
    await pausar(900)
  }

  // 5. Valor recebido, para o troco aparecer (forma padrão é dinheiro).
  const temRecebido = await js(`return !!document.querySelector('[name="valorRecebido"]')`)
  if (temRecebido) {
    await digitar('valorRecebido', '100')
    await pausar(900)
  }

  // 6. Fechar e ler o comprovante.
  await clicarComPonteiro('Fechar venda', 'button')
  await esperarPor(() => js(`return !!document.querySelector('[role="status"]')`), 'comprovante da venda aparecer')
  await js('window.scrollTo({ top: 0, behavior: "smooth" })')
  await espera(700)
  await pausar(3000) // o comprovante com total, troco e saldo de vasilhame

  return pararGravacao()
}

/** Vendas de Produtos: os quatro cartões de métrica e a lista. */
async function sequenciaVendasProdutos() {
  await irPara(ROTA['vendas-produtos'])
  await iniciarGravacao()
  await pausar(1900) // os quatro cartões: vendido hoje, no mês, ticket médio, taxas

  // Desce até a tabela, que é o assunto da tela.
  await rolarAte(320, 1400)
  await pausar(2200)

  return pararGravacao()
}

const SEQUENCIAS = {
  'baixa-vasilhame': sequenciaBaixaVasilhame,
  'saldo-vasilhame': sequenciaSaldoVasilhame,
  'movimentos-vasilhame': sequenciaMovimentosVasilhame,
  pdv: sequenciaPdv,
  'vendas-produtos': sequenciaVendasProdutos,
}

/* -------------------------------------------------------------- encoding
 *
 * Duas decisões seguram o arquivo num tamanho que abre no celular, mesmo com
 * centenas de quadros:
 *
 * **Paleta global.** Uma paleta só para o vídeo inteiro, em vez de uma por
 * quadro. Além de economizar a tabela de cores repetida, é o que torna o
 * delta abaixo possível: a mesma cor precisa virar sempre o mesmo índice.
 *
 * **Delta por transparência.** Quadro a quadro, o pixel que não mudou vira o
 * índice transparente e `dispose: 1` deixa o anterior aparecer por baixo. Numa
 * tela de sistema quase tudo fica parado entre um quadro e o outro, e uma
 * faixa longa do mesmo índice é justamente o que o LZW comprime a quase nada.
 */
const CORES = 255
const INDICE_TRANSPARENTE = 255

function amostrarParaPaleta(quadros) {
  // Uma amostra por quadro, de ~24 quadros espalhados: cores demais não cabem
  // na paleta de qualquer jeito, e decodificar tudo custaria minutos.
  const passo = Math.max(1, Math.floor(quadros.length / 24))
  const amostras = []
  let total = 0
  for (let i = 0; i < quadros.length; i += passo) {
    const png = PNG.sync.read(quadros[i].png)
    amostras.push(png.data)
    total += png.data.length
  }
  const junto = new Uint8Array(total)
  let off = 0
  for (const a of amostras) {
    junto.set(a, off)
    off += a.length
  }
  return junto
}

async function gerarGif(slug, quadros) {
  if (quadros.length === 0) {
    console.warn(`  (nenhum quadro capturado para ${slug} — pulando)`)
    return
  }

  await mkdir(SAIDA, { recursive: true })
  // O primeiro quadro também vira PNG: é o `poster` do artigo, mostrado parado
  // para quem pediu menos movimento no sistema operacional.
  await writeFile(path.join(SAIDA, `${slug}.png`), quadros[0].png)

  if (DESPEJAR) {
    const pasta = path.join(tmpdir(), 'casco-ajuda-quadros', slug)
    await mkdir(pasta, { recursive: true })
    // Amostra que **sempre inclui o último quadro**. Com um passo fixo, o fim
    // do vídeo caía fora da conferência — e foi assim que um vídeo terminado
    // em "Lançando…" passou por bom, sem o desfecho que ele deveria ensinar.
    const total = 14
    for (let n = 0; n < total; n++) {
      const i = Math.round((n / (total - 1)) * (quadros.length - 1))
      await writeFile(path.join(pasta, `${String(n).padStart(2, '0')}.png`), quadros[i].png)
    }
    console.log(`  quadros de conferência em ${pasta}`)
  }

  const paleta = quantize(amostrarParaPaleta(quadros), CORES)
  while (paleta.length < 256) paleta.push([0, 0, 0])

  const gif = GIFEncoder()
  let anterior = null
  let largura = 0
  let altura = 0

  for (let i = 0; i < quadros.length; i++) {
    const png = PNG.sync.read(quadros[i].png)
    // Um quadro de tamanho diferente (redimensionamento no meio da gravação)
    // quebraria o delta — descarta em vez de corromper o vídeo.
    if (i === 0) {
      largura = png.width
      altura = png.height
    } else if (png.width !== largura || png.height !== altura) {
      continue
    }

    const indices = applyPalette(png.data, paleta)

    if (anterior) {
      for (let p = 0; p < indices.length; p++) {
        if (indices[p] === anterior[p]) indices[p] = INDICE_TRANSPARENTE
        else anterior[p] = indices[p]
      }
    } else {
      anterior = Uint8Array.from(indices)
    }

    gif.writeFrame(indices, largura, altura, {
      palette: i === 0 ? paleta : undefined,
      first: i === 0,
      delay: Math.min(4000, Math.max(60, quadros[i].duracaoMs)),
      transparent: i > 0,
      transparentIndex: INDICE_TRANSPARENTE,
      dispose: i === 0 ? -1 : 1,
      repeat: 0,
    })
  }
  gif.finish()

  const bytes = Buffer.from(gif.bytes())
  await writeFile(path.join(SAIDA, `${slug}.gif`), bytes)

  const segundos = (quadros.reduce((s, q) => s + q.duracaoMs, 0) / 1000).toFixed(1)
  console.log(
    `  ${slug}.gif — ${quadros.length} quadros, ${segundos}s, ${largura}×${altura}, ` +
      `${Math.round(bytes.byteLength / 1024)} KB`,
  )
}

/* ------------------------------------------------------------------ main */

async function main() {
  const artigoUnico = arg('artigo')
  const artigos = artigoUnico ? [artigoUnico] : Object.keys(SEQUENCIAS)
  for (const a of artigos) {
    if (!SEQUENCIAS[a]) {
      console.error(`Artigo desconhecido: ${a}. Opções: ${Object.keys(SEQUENCIAS).join(', ')}`)
      process.exit(1)
    }
  }

  const perfil = await mkdtemp(path.join(tmpdir(), 'casco-ajuda-'))
  const chrome = spawn(
    CHROME,
    [
      '--remote-debugging-port=0',
      `--user-data-dir=${perfil}`,
      ...(VER ? [] : ['--headless=new']),
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  )

  const urlDepurador = await new Promise((resolve, reject) => {
    let buffer = ''
    const prazo = setTimeout(() => reject(new Error('Chrome não anunciou a porta')), 20_000)
    chrome.stderr.on('data', (d) => {
      buffer += d
      const m = buffer.match(/ws:\/\/[^\s]+/)
      if (m) {
        clearTimeout(prazo)
        resolve(m[0])
      }
    })
    chrome.on('exit', (c) => reject(new Error(`Chrome saiu com código ${c}`)))
  })

  try {
    ws = await conectar(urlDepurador)
    const { targetId } = await comando('Target.createTarget', { url: 'about:blank' })
    const attach = await comando('Target.attachToTarget', { targetId, flatten: true })
    sessao = attach.sessionId

    await comando('Page.enable')
    await comando('Runtime.enable')
    await usarJanela(null)
    ligarOuvinteDeQuadros()

    await irPara('/painel')
    if ((await caminhoAtual()).startsWith('/login')) {
      await js(`
        const dados = { email: ${JSON.stringify(EMAIL)}, senha: ${JSON.stringify(SENHA)} }
        for (const [nome, valor] of Object.entries(dados)) {
          const el = document.querySelector('[name="' + nome + '"]')
          if (!el) continue
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, valor)
          el.dispatchEvent(new Event('input', { bubbles: true }))
          el.dispatchEvent(new Event('change', { bubbles: true }))
        }
      `)
      await js(`
        ${seletorPorTexto('Entrar', 'button')}
        el?.click()
      `)
      await esperarCaminho((p) => p.startsWith('/painel'), 'entrar no painel')
    }

    for (const slug of artigos) {
      console.log(`Gravando ${slug}…`)
      await usarJanela(slug)
      const quadros = await SEQUENCIAS[slug]()
      await gerarGif(slug, quadros)
    }
  } finally {
    chrome.kill()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
