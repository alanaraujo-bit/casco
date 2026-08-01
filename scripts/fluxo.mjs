/**
 * Roda o fluxo real num navegador de verdade.
 *
 * O `AGENTS.md` diz que "pronto significa rodando" e que build passar não é
 * prova. Isto é o que torna essa regra verificável em vez de aspiracional:
 * abre o Chrome, faz login digitando, clica nos botões e confere o que
 * aparece na tela. Typecheck não pega `name="telefone"` escrito como
 * `name="fone"`; isto pega.
 *
 * Sem Playwright de propósito — ele baixa ~300 MB de navegador para fazer o
 * que o Chrome já instalado faz pelo protocolo de depuração, e o `WebSocket`
 * do Node cobre o resto. Menos dependência para manter.
 *
 *     npm run fluxo                       # usa http://127.0.0.1:3210
 *     npm run fluxo -- --url https://...  # ou outro alvo
 *     npm run fluxo -- --ver              # com janela, para assistir
 */
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import postgres from 'postgres'

const args = process.argv.slice(2)
const arg = (n) => {
  const i = args.indexOf(`--${n}`)
  return i >= 0 ? args[i + 1] : undefined
}

/**
 * `localhost` e **não** `127.0.0.1`.
 *
 * São a mesma máquina e origens diferentes para o navegador. O `next dev` do 16
 * recusa servir os pacotes do cliente para origem que não seja a dele, e a
 * recusa é silenciosa: a página aparece inteira, navega e até grava — porque
 * formulário e link são HTML puro — mas o React nunca assume. Busca da tabela,
 * menu do celular, seletor de tema e menu da conta ficam mortos, sem um único
 * erro no console. Custou meia dúzia de rodadas descobrir; fica anotado aqui
 * para não custar de novo.
 */
const BASE = arg('url') ?? 'http://localhost:3210'
const EMAIL = arg('email') ?? process.env.FLUXO_EMAIL
const SENHA = arg('senha') ?? process.env.FLUXO_SENHA
const VER = args.includes('--ver')
const PASTA_FOTOS = arg('fotos') ?? path.join(tmpdir(), 'casco-fluxo-fotos')

if (!EMAIL || !SENHA) {
  console.error(
    'Informe as credenciais: npm run fluxo -- --email x@y.com --senha "..."\n' +
      '     ou defina FLUXO_EMAIL e FLUXO_SENHA no ambiente.',
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

const ok = []
const falhas = []
const check = (nome, cond, detalhe = '') => {
  if (cond) ok.push(nome)
  else falhas.push(`${nome}${detalhe ? ' — ' + detalhe : ''}`)
  return cond
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms))

/* -------------------------------------------------------------- faxina
 *
 * O teste escreve no mesmo banco que a distribuidora usa. Cadastro de teste
 * esquecido lá dentro não é sujeira inofensiva: ele aparece na busca da
 * operadora, entra na contagem do cabeçalho e, no dia em que alguém emitir uma
 * cobrança, vira ligação para um telefone que não existe. Tudo que este
 * arquivo cria carrega o prefixo abaixo e é apagado no início e no fim.
 */
const PREFIXO = '[teste-fluxo]'

/** 1440×900: o notebook comum do escritório, e bem acima do breakpoint md. */
const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }
/** iPhone 14. O dono vai olhar o faturamento daqui, fora da loja. */
const CELULAR = { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }

const bancoUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
const banco = bancoUrl
  ? postgres(bancoUrl, { max: 1, prepare: false, onnotice() {} })
  : null

async function faxina() {
  if (!banco) return
  // Sem RLS aqui de propósito: roda como dono, e a limpeza precisa alcançar
  // qualquer tenant onde o teste tenha rodado.

  // `replica` desliga os triggers, e é a única forma de apagar movimento de
  // vasilhame: ele é imutável por trigger justamente para que ninguém apague
  // histórico. A exceção vive aqui, no script de teste, e não na aplicação.
  const doTeste = banco`select id from produtos where nome like ${PREFIXO + '%'}`
  const clientesDoTeste = banco`select id from clientes where nome like ${PREFIXO + '%'}`
  await banco`set session_replication_role = 'replica'`
  await banco`delete from vasilhame_movimentos where produto_id in (${doTeste})
                                                 or cliente_id in (${clientesDoTeste})`
  await banco`delete from vasilhame_saldos where produto_id in (${doTeste})
                                             or cliente_id in (${clientesDoTeste})`
  await banco`set session_replication_role = 'origin'`

  await banco`delete from clientes where nome like ${PREFIXO + '%'}`
  // Retornável primeiro: ele aponta para o galão por `vasilhame_id`.
  await banco`delete from produtos where retornavel and nome like ${PREFIXO + '%'}`
  await banco`delete from produtos where nome like ${PREFIXO + '%'}`

  // Devolve o contador de códigos ao maior que sobrou.
  //
  // Apagar as linhas não basta: o contador é sequencial e não recua sozinho,
  // então cada rodada empurrava o próximo código para cima. Depois de vinte
  // execuções, o primeiro cliente de verdade da distribuidora nasceria como
  // `0026` — e o código é justamente o que ela fala no telefone e procura na
  // lista. Um número que começa torto não tem conserto bonito depois.
  await banco`
    update sequencias s
       set valor = coalesce(
             (select max(c.codigo) from clientes c where c.company_id = s.company_id), 0)
     where s.nome = 'clientes'
  `
  // Mesma coisa para produtos, agora que o teste também cria dois deles.
  await banco`
    update sequencias s
       set valor = coalesce(
             (select max(p.codigo) from produtos p where p.company_id = s.company_id), 0)
     where s.nome = 'produtos'
  `
}

/**
 * Cria o par de produtos sem o qual a tela de baixa não tem o que mostrar.
 *
 * Semeado pelo banco e não pela interface de propósito: o que está sendo testado
 * aqui é o vasilhame, e fazer o teste passar antes por dois cadastros de produto
 * faria uma falha no formulário de produto reprovar a tela de baixa — que é o
 * tipo de teste que ninguém consegue ler quando fica vermelho.
 */
async function semearVasilhame() {
  if (!banco) return null
  const [dono] = await banco`select company_id from users where email = ${EMAIL}`
  if (!dono) return null

  const galao = randomUUID()
  const agua = randomUUID()
  await banco`
    insert into produtos (id, company_id, nome, unidade, custo, retornavel)
    values (${galao}, ${dono.company_id}, ${PREFIXO + ' Galão 20L'}, 'gl', 38, false)
  `
  await banco`
    insert into produtos (id, company_id, nome, unidade, preco_padrao, retornavel, vasilhame_id)
    values (${agua}, ${dono.company_id}, ${PREFIXO + ' Água 20L'}, 'gl', 12, true, ${galao})
  `
  return { companyId: dono.company_id, galao, agua }
}

/**
 * CNPJ válido e diferente a cada rodada.
 *
 * Um CNPJ fixo colide com a rodada anterior: o cadastro é barrado por
 * documento repetido, e o teste falha acusando "salvar não funciona" quando na
 * verdade a trava de duplicata funcionou. Levei uma rodada inteira nisso.
 */
function gerarCnpj() {
  const base = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10))
  for (const ate of [12, 13]) {
    let peso = ate - 7
    let soma = 0
    for (let i = 0; i < ate; i++) {
      soma += base[i] * peso
      peso = peso === 2 ? 9 : peso - 1
    }
    const resto = soma % 11
    base.push(resto < 2 ? 0 : 11 - resto)
  }
  const d = base.join('')
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/* ------------------------------------------------------------------ CDP */

const errosDaPagina = []
let proximoId = 0
const pendentes = new Map()

function conectar(url) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url)
    ws.addEventListener('open', () => resolve(ws))
    ws.addEventListener('error', reject)
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data)

      // Eventos não têm `id`. Exceção e `console.error` da página entram aqui —
      // e é o único jeito confiável de vê-los: substituir `console.error` na
      // página não pega erro de hidratação, que o React reporta por outro
      // caminho antes de qualquer script nosso rodar.
      if (!msg.id) {
        if (msg.method === 'Runtime.exceptionThrown') {
          const d = msg.params?.exceptionDetails
          errosDaPagina.push(
            (d?.exception?.description ?? d?.text ?? 'exceção').split('\n')[0].slice(0, 300),
          )
        }
        if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
          errosDaPagina.push(
            msg.params.args
              .map((a) => a.description ?? a.value ?? '')
              .join(' ')
              .slice(0, 300),
          )
        }
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

function comando(ws, method, params = {}, sessionId) {
  const id = ++proximoId
  return new Promise((resolve, reject) => {
    pendentes.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params, sessionId }))
    setTimeout(() => {
      if (pendentes.delete(id)) reject(new Error(`timeout em ${method}`))
    }, 30_000)
  })
}

/* ------------------------------------------------------------- helpers */

let ws
let sessao

/** Avalia JS na página e devolve o valor já desserializado. */
async function js(expressao) {
  const r = await comando(
    ws,
    'Runtime.evaluate',
    { expression: `(async () => { ${expressao} })()`, returnByValue: true, awaitPromise: true },
    sessao,
  )
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description ?? 'erro no script da página')
  }
  return r.result.value
}

async function irPara(caminho) {
  const antes = errosDaPagina.length
  await comando(ws, 'Page.navigate', { url: BASE + caminho }, sessao)
  await esperarPor(() => js(`return document.readyState === 'complete'`), `carregar ${caminho}`)
  // O React ainda precisa hidratar depois do `load` — sem isto, um clique
  // acontece antes de o handler existir e simplesmente não faz nada.
  await espera(400)

  // Carimba a tela em que o erro nasceu. Sem isto o relatório diz "erro de
  // hidratação" e cabe a alguém adivinhar em qual das seis telas — e em
  // produção a mensagem vem minificada, sem componente e sem linha.
  for (let i = antes; i < errosDaPagina.length; i++) {
    errosDaPagina[i] = `[${caminho}] ${errosDaPagina[i]}`
  }
}

async function esperarPor(condicao, oque, ms = 15_000) {
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

/** Salva um PNG da tela. Serve para inspecionar falha que o texto não explica. */
async function foto(nome) {
  const { data } = await comando(ws, 'Page.captureScreenshot', { format: 'png' }, sessao)
  const destino = path.join(PASTA_FOTOS, `${nome}.png`)
  await writeFile(destino, Buffer.from(data, 'base64'))
  return destino
}

const caminho = () => js('return location.pathname + location.search')
const texto = () => js('return document.body ? document.body.innerText : ""')

/**
 * Espera a URL casar **e** a página terminar de trocar.
 *
 * Conferir só o `pathname` não basta: ele muda no instante em que a navegação
 * começa, e o `document.body` fica nulo por alguns milissegundos enquanto o
 * documento novo é montado. Quem ler o texto nesse intervalo recebe `null` e
 * acusa uma falha que não existe — foi o que aconteceu na primeira rodada.
 */
async function esperarCaminho(condicao, oque) {
  await esperarPor(async () => condicao(await caminho()), oque)
  await esperarPor(
    async () => (await js(`return document.readyState === 'complete' && !!document.body`)),
    `${oque} terminar de carregar`,
  )
  await espera(300)
}

/**
 * Preenche pelo `name`, como o usuário faria.
 *
 * Usa o setter nativo antes de disparar o evento: React guarda o valor num
 * descritor próprio no elemento, e um `el.value = x` cru é ignorado por ele em
 * campo controlado. Com o setter do protótipo o React enxerga a mudança.
 */
async function preencher(campos) {
  const r = await js(`
    const dados = ${JSON.stringify(campos)}
    const faltando = []
    for (const [nome, valor] of Object.entries(dados)) {
      const el = document.querySelector(\`[name="\${nome}"]\`)
      if (!el) { faltando.push(nome); continue }
      const proto = el instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, valor)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.dispatchEvent(new Event('change', { bubbles: true }))
    }
    return faltando
  `)
  if (r.length) throw new Error(`campos inexistentes no formulário: ${r.join(', ')}`)
}

/**
 * Escolhe a opção de um `<select>` pelo texto visível.
 *
 * `preencher` grava o `value`, que para um select é um UUID — e um teste que
 * carrega UUID de produto passa a falhar quando o dado de semente muda, por
 * motivo nenhum. Aqui o teste procura o que a operadora leria na lista.
 */
async function escolherPorTexto(campo, trecho) {
  const r = await js(`
    const el = document.querySelector('[name=${JSON.stringify(campo)}]')
    if (!el) return 'campo não existe'
    const opcao = [...el.options].find((o) => o.text.includes(${JSON.stringify(trecho)}))
    if (!opcao) return 'opções: ' + [...el.options].map((o) => o.text).join(' | ')
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(el, opcao.value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
    return 'ok'
  `)
  if (r !== 'ok') throw new Error(`não escolhi "${trecho}" em ${campo} — ${r}`)
}

/**
 * Clica no primeiro elemento cujo texto contém `rotulo`, esperando ele aparecer.
 *
 * Esperar aqui dentro, e não em cada chamada, é o que separa um teste confiável
 * de um teste que falha uma vez a cada cinco. Navegação do App Router troca a
 * URL na hora e só depois busca o conteúdo — clicar nesse intervalo acerta o
 * documento antigo e não faz nada, sem erro nenhum. Foi assim que o botão
 * "Inativar" ficou dez minutos parecendo quebrado quando estava correto.
 */
async function clicar(rotulo, ms = 15_000, seletor = 'button, a, [role="button"], [role="menuitem"]') {
  const limite = Date.now() + ms
  while (Date.now() < limite) {
    // Rola até o elemento e devolve o centro dele, para o clique cair no lugar
    // certo mesmo com o rodapé grudento por cima.
    const caixa = await js(`
      const alvo = ${JSON.stringify(rotulo)}
      const els = [...document.querySelectorAll(${JSON.stringify(seletor)})]
      const el = els.find((e) => (e.innerText || '').trim().includes(alvo) && !e.disabled)
      if (!el) return null
      el.scrollIntoView({ block: 'center' })
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return null
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    `).catch(() => null)

    if (caixa) {
      // Mouse de verdade, e não `el.click()`. O Radix abre o menu suspenso no
      // `pointerdown`, não no `click` — com o clique sintético o gatilho da
      // conta simplesmente não abria, e o teste acusava "Sair" inexistente.
      // Evento real também exercita o `:active` e o foco como o usuário vê.
      for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) {
        await comando(
          ws,
          'Input.dispatchMouseEvent',
          {
            type,
            x: caixa.x,
            y: caixa.y,
            button: 'left',
            buttons: type === 'mousePressed' ? 1 : 0,
            clickCount: type === 'mouseMoved' ? 0 : 1,
            // Sem isto o Chrome não emite os eventos de ponteiro, e o Radix
            // abre menu no `pointerdown` — o gatilho da conta ficava inerte.
            pointerType: 'mouse',
          },
          sessao,
        )
      }
      return
    }
    await espera(200)
  }
  throw new Error(`não achei nada clicável com "${rotulo}"`)
}

/**
 * Foca o elemento pelo texto e aciona com Enter.
 *
 * Existe porque o menu suspenso do Radix não abriu com evento de mouse
 * injetado — e, mais importante, porque a operadora de balcão opera no teclado
 * o dia inteiro. Se o menu só abrisse no clique, seria um defeito de verdade,
 * não uma limitação do teste.
 */
async function acionarPeloTeclado(rotulo) {
  const achou = await js(`
    const alvo = ${JSON.stringify(rotulo)}
    const els = [...document.querySelectorAll('button, a, [role="button"], [role="menuitem"]')]
    const el = els.find((e) => (e.innerText || '').trim().includes(alvo) && !e.disabled)
    if (!el) return false
    el.focus()
    return document.activeElement === el
  `)
  if (!achou) throw new Error(`não consegui focar "${rotulo}"`)

  for (const type of ['keyDown', 'char', 'keyUp']) {
    await comando(
      ws,
      'Input.dispatchKeyEvent',
      {
        type,
        key: 'Enter',
        code: 'Enter',
        windowsVirtualKeyCode: 13,
        nativeVirtualKeyCode: 13,
        text: type === 'char' ? '\r' : undefined,
      },
      sessao,
    )
  }
}

/* -------------------------------------------------------------- roteiro */

await mkdir(PASTA_FOTOS, { recursive: true })

const perfil = await mkdtemp(path.join(tmpdir(), 'casco-fluxo-'))
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

// A porta 0 faz o Chrome escolher uma livre e anunciar no stderr. Porta fixa
// colidiria com um Chrome que a pessoa ja tenha aberto com depuracao ligada.
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
  const navegador = await conectar(urlDepurador)
  ws = navegador

  const { targetId } = await comando(ws, 'Target.createTarget', { url: 'about:blank' })
  const attach = await comando(ws, 'Target.attachToTarget', { targetId, flatten: true })
  sessao = attach.sessionId

  await comando(ws, 'Page.enable', {}, sessao)
  await comando(ws, 'Runtime.enable', {}, sessao)

  // Desktop de verdade desde o início. A janela padrão do headless tem 800×600,
  // que fica abaixo do breakpoint `md` — a rodada inteira exercitava a visão de
  // cartões do celular achando que testava a tabela, e a tabela nunca era vista.
  await comando(ws, 'Emulation.setDeviceMetricsOverride', DESKTOP, sessao)

  // Instalado ANTES de qualquer navegação e reinstalado a cada documento: um
  // `console.error` disparado durante a hidratação acontece antes de qualquer
  // script nosso conseguir rodar depois do load. Sem isto o teste conferia uma
  // lista que ninguém preenchia — ou seja, passava sempre.
  await comando(
    ws,
    'Page.addScriptToEvaluateOnNewDocument',
    {
      source: `
        window.__errosCasco = []
        const original = console.error
        console.error = (...args) => {
          window.__errosCasco.push(args.map(String).join(' ').slice(0, 200))
          original(...args)
        }
        window.addEventListener('error', (e) => window.__errosCasco.push('onerror: ' + e.message))
      `,
    },
    sessao,
  )

  /* ------------------------------------------------------------- login */
  await irPara('/painel')
  check('sem sessão, cai no login', (await caminho()).startsWith('/login'))

  await preencher({ email: EMAIL, senha: SENHA })
  await clicar('Entrar')
  await esperarCaminho((p) => p.startsWith('/painel'), 'entrar no painel')
  check('login pelo formulário funciona', true)

  // O nome da empresa vem do banco na hora do login e viaja na sessão. Ficava
  // vazio porque a consulta rodava fora do `withTenant` e a RLS negava — e o
  // sintoma era só um "·" solto ao lado da data. Num sistema multi-tenant, o
  // nome da distribuidora na tela é o que denuncia sessão trocada antes de um
  // lançamento ir para a empresa errada.
  const cabecalho = await texto()
  check(
    'o nome da empresa aparece na tela',
    /Distribuidora|Natuclara/i.test(cabecalho),
    cabecalho.split('\n').slice(0, 4).join(' / '),
  )

  /* ------------------------------------------------------------ senha errada */
  await irPara('/painel')

  /* ----------------------------------------------------------- clientes */
  // Antes e depois: rodada interrompida no meio não deixa herança para a próxima.
  await faxina()
  const semente = await semearVasilhame()

  await irPara('/cadastro/clientes')
  const listaVazia = await texto()
  const partindoDoZero = listaVazia.includes('Nenhum cliente cadastrado')

  if (partindoDoZero) {
    check('lista vazia mostra o estado vazio certo', true)
    await clicar('Cadastrar primeiro cliente')
  } else {
    await clicar('Novo cliente')
  }
  await esperarCaminho((p) => p.includes('/clientes/novo'), 'abrir o formulário')

  /* -------------------------------------------------- validação recusa */
  const nomeRuim = `${PREFIXO} Documento Ruim`
  await preencher({ nome: nomeRuim, documento: '111.222.333-44' })
  await clicar('Cadastrar cliente')
  await esperarPor(
    async () => (await texto()).includes('CPF ou CNPJ inválido'),
    'a mensagem de documento inválido',
  )
  check('CPF inválido é recusado com mensagem clara', true)
  check(
    'o que foi digitado continua no formulário',
    (await js(`return document.querySelector('[name="nome"]').value`)) === nomeRuim,
  )

  /* ------------------------------------------------------ cadastro bom */
  const cnpj = gerarCnpj()
  const nome = `${PREFIXO} Mercado ${Date.now().toString().slice(-6)}`
  await preencher({
    nome,
    tipo: 'mercado',
    documento: cnpj,
    telefone: '(94) 98100-1234',
    cep: '68385-000',
    logradouro: 'Av. Brasil',
    numero: '120',
    bairro: 'Centro',
    cidade: 'Tucumã',
    uf: 'PA',
    pontoReferencia: 'Em frente à praça',
    limiteCredito: '1500,00',
  })
  await clicar('Cadastrar cliente')
  await esperarCaminho((p) => p.startsWith('/cadastro/clientes?novo='), 'voltar para a lista depois de salvar')
  check('cadastro salva e volta para a lista', true)

  // Fotos das telas em estado normal, não só de falha. Defeito de sobreposição
  // — cabeçalho por cima das linhas, coluna espremida — não aparece em
  // asserção de texto nenhuma: o conteúdo está lá, só está no lugar errado.
  await foto('lista-clientes')

  const listaDepois = await texto()
  check('o cliente aparece na lista', listaDepois.includes(nome))
  check('o código foi gerado automaticamente', /\b000\d\b/.test(listaDepois))
  check('o telefone aparece formatado', listaDepois.includes('(94) 98100-1234'))
  check('o CNPJ aparece formatado', listaDepois.includes(cnpj))
  check(
    'a métrica de total acompanha',
    !listaDepois.includes('Nenhum cliente cadastrado'),
  )

  /* --------------------------------------------- documento em duplicata */
  await irPara('/cadastro/clientes/novo')
  await preencher({ nome: `${PREFIXO} Outro Qualquer`, documento: cnpj })
  await clicar('Cadastrar cliente')
  await esperarPor(
    async () => (await texto()).includes('Já existe em'),
    'a mensagem de documento repetido',
  )
  check('documento repetido é barrado apontando o cadastro que já tem', true)

  /* ------------------------------------------------------------ edição */
  await irPara('/cadastro/clientes')
  await clicar(nome)
  await esperarCaminho(
    (p) => /\/cadastro\/clientes\/[0-9a-f-]{36}/.test(p),
    'abrir a ficha do cliente',
  )
  check(
    'a ficha abre com os dados gravados',
    (await js(`return document.querySelector('[name="bairro"]').value`)) === 'Centro',
  )

  await preencher({ bairro: 'Setor Industrial' })
  await clicar('Salvar alterações')
  await esperarCaminho((p) => p === '/cadastro/clientes', 'voltar da edição')
  check('edição persiste', (await texto()).includes('Setor Industrial'))

  /* --------------------------------------------------------- vasilhame */
  //
  // O módulo que motiva a troca de sistema. O que este bloco prova, e nenhum
  // outro prova, é que a operadora consegue dar baixa em galão quebrado sem
  // passar por venda — e que o valor da perda aparece como custo.
  if (semente) {
    await irPara('/vasilhame/baixa')
    const baixa = await texto()
    const MOTIVOS = [
      'Entregue ao cliente',
      'Devolvido pelo cliente',
      'Quebrado',
      'Trincado',
      'Perdido pelo cliente',
      'Enviado à fábrica',
      'Retornou da fábrica',
      'Ajuste de inventário',
    ]
    const faltando = MOTIVOS.filter((m) => !baixa.includes(m))
    check('a baixa oferece os oito motivos', faltando.length === 0, faltando.join(', '))
    await foto('vasilhame-baixa')

    // --- entrega: o cliente passa a dever
    await clicar('Entregue ao cliente', 15_000, 'label')
    await esperarPor(
      async () => (await js(`return !!document.querySelector('[name="clienteId"]')`)) === true,
      'o campo de cliente aparecer para o motivo que exige cliente',
    )
    check('motivo que exige cliente mostra o campo de cliente', true)

    await escolherPorTexto('produtoId', 'Galão 20L')
    await escolherPorTexto('clienteId', nome)
    await preencher({ quantidade: '10' })
    await clicar('Lançar baixa')
    await esperarPor(
      async () => (await texto()).includes('fica com 10'),
      'o recibo confirmando o saldo do cliente',
    )
    check('entrega lançada e o saldo do cliente aparece no recibo', true)

    // --- quebra: o momento que substitui a venda de R$ 0,13
    await clicar('Quebrado', 15_000, 'label')
    const naQuebra = await esperarPor(
      async () => (await texto()).includes('Isto não é uma venda'),
      'o aviso de que perda não gera receita',
    )
    check('perda avisa, na hora, que não gera receita', Boolean(naQuebra))

    await escolherPorTexto('produtoId', 'Galão 20L')
    await escolherPorTexto('clienteId', nome)
    await preencher({ quantidade: '3' })
    const antesDaQuebra = await texto()
    // 3 galões a R$ 38 de custo. O número aparece antes de gravar, que é
    // quando ele ainda serve para a operadora desistir se estiver errado.
    check(
      'o custo da perda aparece antes de gravar',
      antesDaQuebra.includes('114,00'),
      'não achei R$ 114,00 na tela',
    )
    await foto('vasilhame-perda')
    await clicar('Lançar baixa')
    await esperarPor(
      async () => (await texto()).includes('Registrado como custo'),
      'o recibo da perda',
    )
    check('perda lançada como custo, não como venda', true)

    // --- saldo por cliente
    await irPara('/vasilhame/saldos')
    const saldos = await texto()
    await foto('vasilhame-saldos')
    check('o cliente aparece devendo galão', saldos.includes(nome))
    check('o saldo desconta a quebra (10 − 3 = 7)', /\b7\b/.test(saldos), saldos.slice(0, 200))

    // --- extrato, galão a galão
    await clicar(nome)
    await esperarCaminho(
      (p) => /\/vasilhame\/saldos\/[0-9a-f-]{36}/.test(p),
      'abrir o extrato do cliente',
    )
    const extrato = await texto()
    await foto('vasilhame-extrato')
    check(
      'o extrato explica o saldo movimento a movimento',
      extrato.includes('Entregue ao cliente') && extrato.includes('Quebrado'),
    )
    check('o extrato mostra os sinais dos movimentos', extrato.includes('+10'))

    // --- movimentos e o custo do mês
    await irPara('/vasilhame/movimentos')
    const movimentos = await texto()
    await foto('vasilhame-movimentos')
    check(
      'a perda do mês aparece como custo',
      movimentos.includes('Custo do mês, não receita') && movimentos.includes('114,00'),
    )

    // --- estorno: a perda digitada errada não pode custar para sempre
    await clicar('Estornar')
    await clicar('Confirmar')
    await esperarPor(
      async () => !(await texto()).includes('114,00'),
      'a perda estornada sair do custo',
    )
    check('estorno tira a perda do custo do mês', true)

    // --- celular: o dono olha isso fora da loja
    await comando(ws, 'Emulation.setDeviceMetricsOverride', CELULAR, sessao)
    await irPara('/vasilhame/baixa')
    check(
      'no celular a baixa não rola de lado',
      await js('return document.documentElement.scrollWidth <= window.innerWidth + 1'),
      `scrollWidth=${await js('return document.documentElement.scrollWidth')} vs ${await js('return window.innerWidth')}`,
    )
    const baixinhos = await js(`
      const alvos = [...document.querySelectorAll('input[name]:not([type="hidden"]):not(.sr-only), select[name], label:has(input[type="radio"])')]
        .map((e) => ({ nome: e.getAttribute('name') || e.innerText.trim().slice(0, 20), altura: Math.round(e.getBoundingClientRect().height) }))
        .filter((c) => c.altura < 44)
      return JSON.stringify(alvos)
    `)
    check('os alvos de toque da baixa têm 44px', baixinhos === '[]', `abaixo de 44px: ${baixinhos}`)
    await foto('celular-vasilhame-baixa')
    await comando(ws, 'Emulation.setDeviceMetricsOverride', DESKTOP, sessao)
  } else {
    falhas.push('vasilhame não testado — sem conexão de banco para semear os produtos')
  }

  await irPara('/cadastro/clientes')

  /* ---------------------------------------------------------- inativar */
  await clicar(nome)
  await esperarCaminho(
    (p) => /\/cadastro\/clientes\/[0-9a-f-]{36}/.test(p),
    'abrir a ficha de novo',
  )
  await clicar('Inativar')
  await esperarPor(
    async () => (await texto()).includes('Reativar'),
    'o botão virar Reativar',
  )
  check('inativar funciona e não apaga o cadastro', true)

  /* ------------------------------------------------------------ celular */
  await comando(
    ws,
    'Emulation.setDeviceMetricsOverride',
    CELULAR,
    sessao,
  )
  await irPara('/cadastro/clientes')
  check(
    'no celular a lista não rola de lado',
    (await js('return document.documentElement.scrollWidth <= window.innerWidth + 1')),
    `scrollWidth=${await js('return document.documentElement.scrollWidth')} vs ${await js('return window.innerWidth')}`,
  )
  await foto('celular-lista')
  await irPara('/cadastro/clientes/novo')
  await foto('celular-formulario')
  check(
    'no celular o formulário não rola de lado',
    (await js('return document.documentElement.scrollWidth <= window.innerWidth + 1')),
  )
  const menores = await js(`
    // Fora os ocultos: o React injeta \`$ACTION_REF\`/\`$ACTION_KEY\` como
    // inputs de altura zero para a action funcionar sem JavaScript, e eles
    // reprovariam a checagem sem representar nada que o dedo alcance.
    const campos = [...document.querySelectorAll('input[name]:not([type="hidden"]), select[name]')]
      .map((e) => ({ nome: e.name, altura: Math.round(e.getBoundingClientRect().height) }))
      .filter((c) => c.altura < 44)
    return JSON.stringify(campos)
  `)
  check(
    'os campos têm pelo menos 44px de altura no toque',
    menores === '[]',
    `abaixo de 44px: ${menores}`,
  )

  /* ------------------------------------------- as outras telas do menu */
  // Cada tela do menu tem que abrir e mostrar dado do banco. A checagem de
  // "nenhum número inventado" é literal: `demo.ts` não existe mais, então
  // qualquer nome daquele arquivo aparecendo aqui significa que sobrou
  // import morto em algum lugar.
  await comando(ws, 'Emulation.setDeviceMetricsOverride', DESKTOP, sessao)

  await irPara('/financeiro/receber')
  const receber = await texto()
  await foto('contas-a-receber')
  check(
    'Contas a Receber abre lendo do banco',
    receber.includes('Contas a Receber') && receber.includes('Total lançado'),
  )
  check(
    'Contas a Receber sem título mostra o estado vazio',
    receber.includes('Nenhum título lançado'),
  )

  await irPara('/painel')
  const painel = await texto()
  await foto('painel')
  check('Painel Gerencial abre', painel.includes('Painel Gerencial'))

  const INVENTADOS = [
    'Mercado Bom Preço',
    'Distribuidora Norte',
    'Restaurante Sabor da Terra',
    'Padaria Pão Quente',
    'Hotel Xingu',
    'Top Gás Tucumã',
  ]
  const vestigios = INVENTADOS.filter((n) => receber.includes(n) || painel.includes(n))
  check('nenhum dado fictício nas telas', vestigios.length === 0, vestigios.join(', '))

  /* ------------------------------------------------------- interatividade */
  // A prova de que o React assumiu a página.
  //
  // Sem hidratação o sistema ainda navega e ainda grava — formulário e link são
  // HTML puro, e o Next monta os dois para funcionarem sem JavaScript. Mas a
  // busca da tabela, o menu do celular, o seletor de tema e o menu da conta
  // ficam inertes, e nada disso levanta erro em lugar nenhum. É a falha mais
  // silenciosa que este projeto pode ter, e foi por isso que virou checagem
  // fixa: sem ela, dezessete testes verdes escondiam metade da interface morta.
  await comando(ws, 'Emulation.setDeviceMetricsOverride', DESKTOP, sessao)
  await irPara('/cadastro/clientes')
  const estaHidratada = () =>
    js(`
      const alvo = document.querySelector('[aria-label="Abrir menu"], button')
      return alvo ? Object.keys(alvo).some((k) => k.startsWith('__react')) : false
    `)

  // Com prazo, e não instantâneo: em `next dev` o Turbopack compila o pacote do
  // cliente sob demanda, então a primeira visita hidrata segundos depois do
  // `load`. Medir uma vez logo após carregar reprovaria o dev por lentidão e
  // esconderia a diferença entre "demora" e "não acontece".
  let hidratou = false
  const prazo = Date.now() + 20_000
  while (Date.now() < prazo && !(hidratou = await estaHidratada())) await espera(500)
  check('a página hidrata (React assume os cliques)', hidratou)

  /* --------------------------------------------------------------- sair */
  // Testado porque quebrou junto com o "Inativar", pelo mesmo motivo: os dois
  // chamavam Server Action fora de `<form action>`. Um botão de sair que não
  // sai é falha de segurança, não de conveniência — num balcão compartilhado,
  // a próxima pessoa herda a sessão de quem achou que tinha saído.
  await irPara('/painel')

  // Pelo teclado primeiro. A operadora de balcão trabalha de teclado o dia
  // inteiro, e menu que só abre no mouse a obriga a largar a digitação a cada
  // uso — é a diferença entre um sistema que ela tolera e um que ela adota.
  await acionarPeloTeclado('Alan')
  const abriuNoTeclado = await esperarPor(
    async () => (await texto()).includes('Sair'),
    'o menu da conta abrir pelo teclado',
    5_000,
  ).catch(() => false)
  check('o menu da conta abre pelo teclado', abriuNoTeclado)

  if (!abriuNoTeclado) {
    await clicar('Alan')
    await esperarPor(async () => (await texto()).includes('Sair'), 'o menu da conta abrir')
  }
  check('o menu da conta abre', true)

  await clicar('Sair')
  await esperarCaminho((p) => p.startsWith('/login'), 'voltar ao login')
  check('sair encerra a sessão de verdade', true)

  await irPara('/cadastro/clientes')
  check('depois de sair, as telas não abrem mais', (await caminho()).startsWith('/login'))

  /* ------------------------------------------------------ erro no console */
  // Recolhido pelo protocolo durante a rodada inteira, e não lido da página no
  // fim: `window` é por documento, então ler no fim mostraria só a última tela.
  check(
    'nenhum erro de JavaScript na rodada inteira',
    errosDaPagina.length === 0,
    errosDaPagina.slice(0, 3).join(' | '),
  )
} catch (err) {
  falhas.push(`ERRO: ${err.message}`)
  // Foto no momento exato da quebra. Metade das falhas aqui são de tempo — a
  // tela estava carregando, o menu não tinha aberto — e a mensagem sozinha não
  // distingue isso de um defeito real. A imagem distingue em dois segundos.
  await foto('falha')
    .then((p) => falhas.push(`foto do momento da falha: ${p}`))
    .catch(() => {})
} finally {
  chrome.kill()
  await rm(perfil, { recursive: true, force: true }).catch(() => {})
  // Sem `catch` silencioso: faxina que falha deixa cadastro de teste no banco
  // da distribuidora, e isso precisa aparecer no relatório.
  await faxina().catch((err) => falhas.push(`faxina falhou: ${err.message}`))
  await banco?.end({ timeout: 5 }).catch(() => {})
}

console.log(`\n✓ ${ok.length} passaram`)
for (const o of ok) console.log(`   ${o}`)
if (falhas.length) {
  console.log(`\n✗ ${falhas.length} FALHARAM`)
  for (const f of falhas) console.log(`   ${f}`)
  process.exitCode = 1
}
