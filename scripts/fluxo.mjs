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
 *     npm run fluxo                       # usa http://localhost:3210
 *     npm run fluxo -- --url https://...  # ou outro alvo
 *     npm run fluxo -- --ver              # com janela, para assistir
 *
 * Sem `--email` o roteiro semeia o próprio dono e o apaga no fim, então roda
 * sozinho, sem credencial de ninguém. `--email x@y.com --senha "..."` entra
 * como uma conta existente, para quando o que se investiga é aquela conta.
 */
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import postgres from 'postgres'
import bcrypt from 'bcryptjs'

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

/**
 * Credenciais do admin descartável da perna de administração.
 *
 * Um admin próprio, criado e apagado a cada rodada, em vez de usar o do Alan
 * ou do Rafael: o roteiro exercita justamente a **troca da senha provisória**,
 * e rodar isso contra uma conta real queimaria a senha de quem ainda não
 * entrou. Também deixa o teste rodável quantas vezes for preciso.
 */
const EMAIL_ADMIN_TESTE = 'teste-fluxo@exemplo.invalid'
const SENHA_ADMIN_PROVISORIA = 'provisoria-do-fluxo'
const SENHA_ADMIN_NOVA = 'definitiva-do-fluxo'

/**
 * O acesso de distribuidora que a perna de gestão de acessos cria e destrói.
 *
 * Mesmo domínio `.invalid` do admin descartável, e pelo mesmo motivo: é o único
 * jeito de a faxina apagar por e-mail sem risco de alcançar gente de verdade.
 * As duas senhas existem porque o roteiro redefine a senha no meio e precisa
 * provar que a nova passou a valer — e que a antiga parou.
 */
const EMAIL_ACESSO_TESTE = 'acesso-fluxo@exemplo.invalid'
const SENHA_ACESSO_PRIMEIRA = 'primeira-do-acesso'
const SENHA_ACESSO_SEGUNDA = 'segunda-do-acesso'

/**
 * O dono descartável com que o roteiro faz login, quando ninguém passa `--email`.
 *
 * Antes o teste exigia a credencial de um dono de verdade, e isso era duas
 * coisas ruins de uma vez: a senha de alguém circulando em linha de comando, e
 * um roteiro que parava de rodar no dia em que aquela pessoa trocasse de senha
 * — ou em que a conta deixasse de existir, que foi exatamente o que aconteceu
 * quando a criação de acesso saiu do terminal e virou tela.
 *
 * `--email` continua valendo e passa a ser o caso especial: serve para rodar o
 * roteiro contra uma conta específica quando se está investigando algo dela.
 */
const EMAIL_DONO_TESTE = 'dono-fluxo@exemplo.invalid'
const SENHA_DONO_TESTE = 'dono-do-fluxo'
const NOME_DONO_TESTE = 'Teste Dono'

const emailLogin = EMAIL ?? EMAIL_DONO_TESTE
const senhaLogin = SENHA ?? SENHA_DONO_TESTE

/** 1440×900: o notebook comum do escritório, e bem acima do breakpoint md. */
const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }
/** iPhone 14. O dono vai olhar o faturamento daqui, fora da loja. */
const CELULAR = { width: 390, height: 844, deviceScaleFactor: 3, mobile: true }

const bancoUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL
const banco = bancoUrl
  ? postgres(bancoUrl, { max: 1, prepare: false, onnotice() {} })
  : null

// Sem `--email` o roteiro semeia o próprio dono, e para isso precisa do banco.
// Falhar aqui, antes de abrir o Chrome, em vez de trinta segundos adiante com
// "login pelo formulário funciona" vermelho e nenhuma pista do porquê.
if (!EMAIL && !banco) {
  console.error(
    'Sem DIRECT_DATABASE_URL não dá para semear o dono de teste.\n' +
      '     Informe uma conta existente: npm run fluxo -- --email x@y.com --senha "..."',
  )
  process.exit(1)
}

async function faxina() {
  if (!banco) return
  // Sem RLS aqui de propósito: roda como dono, e a limpeza precisa alcançar
  // qualquer tenant onde o teste tenha rodado.

  // `replica` desliga os triggers, e é a única forma de apagar movimento de
  // vasilhame: ele é imutável por trigger justamente para que ninguém apague
  // histórico. A exceção vive aqui, no script de teste, e não na aplicação.
  const doTeste = banco`select id from produtos where nome like ${PREFIXO + '%'}`
  const clientesDoTeste = banco`select id from clientes where nome like ${PREFIXO + '%'}`
  /**
   * Toda venda que tocou num produto de teste ou num cliente de teste.
   *
   * Resolvida agora, em memória, e não como subconsulta reusada: as linhas de
   * `venda_itens` são apagadas no meio da faxina, e uma subconsulta que lê essa
   * tabela voltaria vazia justo no `delete from vendas` — deixando o cabeçalho
   * da venda para trás, no faturamento que a operadora lê.
   */
  const idsVendas = (
    await banco`
      select id from vendas
       where id in (select venda_id from venda_itens where produto_id in (${doTeste}))
          or cliente_id in (${clientesDoTeste})
    `
  ).map((v) => v.id)

  await banco`set session_replication_role = 'replica'`
  await banco`delete from vasilhame_movimentos where produto_id in (${doTeste})
                                                 or cliente_id in (${clientesDoTeste})`
  await banco`delete from vasilhame_saldos where produto_id in (${doTeste})
                                             or cliente_id in (${clientesDoTeste})`
  // Movimento de estoque também é imutável por trigger, pelo mesmo motivo do
  // vasilhame: histórico não se apaga. A exceção vive aqui, no teste.
  await banco`delete from estoque_movimentos where produto_id in (${doTeste})`
  await banco`delete from estoque_saldos where produto_id in (${doTeste})`
  await banco`set session_replication_role = 'origin'`

  /**
   * Os títulos do teste, resolvidos antes de sumirem.
   *
   * A baixa de título lança caixa com `origem = 'receber'` e `origem_id` do
   * título. Apagar o título primeiro deixaria esse movimento órfão no Fluxo de
   * Caixa da distribuidora — dinheiro que entrou por um recebimento que não
   * existe mais é exatamente o tipo de linha que ninguém consegue explicar.
   */
  const idsTitulos = (
    await banco`
      select id from contas_receber
       where cliente_id in (${clientesDoTeste})
          ${idsVendas.length > 0 ? banco`or venda_id in ${banco(idsVendas)}` : banco``}
    `
  ).map((t) => t.id)

  if (idsTitulos.length > 0) {
    await banco`delete from caixa_movimentos where origem = 'receber' and origem_id in ${banco(idsTitulos)}`
  }

  // Contas a pagar do teste, e a saída de caixa que o pagamento gerou.
  //
  // O prefixo é procurado em qualquer posição, não só no começo: o título que a
  // compra de estoque gera nasce como "Compra [teste-fluxo] Água 20L", com o
  // nome do produto no meio da frase. Ancorado no início, ele escapava da
  // faxina e ia se acumulando em Contas a Pagar a cada rodada.
  const idsPagar = (
    await banco`select id from contas_pagar where descricao like ${'%' + PREFIXO + '%'}`
  ).map((c) => c.id)
  if (idsPagar.length > 0) {
    await banco`delete from caixa_movimentos where origem = 'pagar' and origem_id in ${banco(idsPagar)}`
    await banco`delete from contas_pagar where id in ${banco(idsPagar)}`
  }

  // Ordem ditada pelas FKs `restrict`: o que aponta para a venda sai antes dela,
  // e o que aponta para o cliente sai antes dele.
  await banco`delete from contas_receber where cliente_id in (${clientesDoTeste})`
  if (idsVendas.length > 0) {
    await banco`delete from caixa_movimentos where origem = 'venda' and origem_id in ${banco(idsVendas)}`
    await banco`delete from contas_receber where venda_id in ${banco(idsVendas)}`
    await banco`delete from pagamentos where venda_id in ${banco(idsVendas)}`
    await banco`delete from venda_itens where venda_id in ${banco(idsVendas)}`
    await banco`delete from vendas where id in ${banco(idsVendas)}`
  }

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
  // E para venda e título, que o teste do PDV passou a criar. O código da venda
  // é o que a operadora dita para o cliente — não pode nascer no 40 porque o
  // fluxo rodou quarenta vezes antes da distribuidora abrir.
  await banco`
    update sequencias s
       set valor = coalesce(
             (select max(v.codigo) from vendas v where v.company_id = s.company_id), 0)
     where s.nome = 'vendas'
  `
  await banco`
    update sequencias s
       set valor = coalesce(
             (select max(t.codigo) from contas_receber t where t.company_id = s.company_id), 0)
     where s.nome = 'contas_receber'
  `
  await banco`
    update sequencias s
       set valor = coalesce(
             (select max(c.codigo) from contas_pagar c where c.company_id = s.company_id), 0)
     where s.nome = 'contas_pagar'
  `

  // O admin descartável da perna de administração. Domínio `.invalid` (RFC
  // 2606) para que nenhum admin de verdade caia nesta cláusula por acidente.
  await banco`delete from plataforma_admins where email = ${EMAIL_ADMIN_TESTE}`

  // E o acesso de distribuidora criado pela tela de acessos. Apaga em vez de
  // desativar: usuário desativado continua ocupando o índice único de e-mail, e
  // a rodada seguinte falharia acusando "e-mail já em uso" — que é a trava
  // funcionando, mas parecendo defeito. Só é possível porque o usuário de teste
  // não vende nada; quem vendeu esbarra no `on delete restrict`, de propósito.
  await banco`delete from users where email = ${EMAIL_ACESSO_TESTE}`
}

/**
 * Cria o par de produtos sem o qual a tela de baixa não tem o que mostrar.
 *
 * Semeado pelo banco e não pela interface de propósito: o que está sendo testado
 * aqui é o vasilhame, e fazer o teste passar antes por dois cadastros de produto
 * faria uma falha no formulário de produto reprovar a tela de baixa — que é o
 * tipo de teste que ninguém consegue ler quando fica vermelho.
 */
/**
 * Cria o dono descartável com que o roteiro faz login.
 *
 * Escolhe a distribuidora mais antiga que esteja ativa. Numa instalação com
 * várias, é a do primeiro cliente — que é onde se quer testar. Quem precisar de
 * outra passa `--email` de alguém de lá.
 */
async function semearDono() {
  const [empresa] = await banco`
    select id from companies where ativo order by criado_em limit 1
  `
  if (!empresa) throw new Error('nenhuma distribuidora ativa no banco para semear o dono')

  // O `delete` antes é o que torna o roteiro rodável duas vezes seguidas: sem
  // ele, a sobra da rodada anterior bate no índice único de e-mail.
  await banco`delete from users where email = ${EMAIL_DONO_TESTE}`
  const hash = await bcrypt.hash(SENHA_DONO_TESTE, 12)
  await banco`
    insert into users (id, company_id, nome, email, senha_hash, papel)
         values (${randomUUID()}, ${empresa.id}, ${NOME_DONO_TESTE},
                 ${EMAIL_DONO_TESTE}, ${hash}, 'dono')
  `
}

/**
 * O primeiro nome de quem está logado, que é como o menu da conta se chama.
 *
 * Lido do banco em vez de fixo no código: com `--email` o roteiro entra como
 * outra pessoa, e um 'Alan' escrito à mão aqui faria o teste do menu falhar
 * acusando "o menu da conta não abre" quando o que mudou foi o nome na tela.
 */
async function primeiroNomeDoLogin() {
  if (!banco) return null
  const [u] = await banco`select nome from users where lower(email) = ${emailLogin.toLowerCase()}`
  return u ? u.nome.split(/\s+/)[0] : null
}

async function semearVasilhame() {
  if (!banco) return null
  const [dono] = await banco`select company_id from users where email = ${emailLogin}`
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
  const digitar = () =>
    js(`
      const dados = ${JSON.stringify(campos)}
      const faltando = []
      const vazios = []
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
      return JSON.stringify(faltando)
    `)

  /** Campos que deveriam ter valor e estão vazios. Campo com máscara devolve o
   *  valor reformatado, então comparar igualdade seria briga com a máscara — o
   *  que importa é ter sobrado alguma coisa. */
  const vazios = () =>
    js(`
      const dados = ${JSON.stringify(campos)}
      return JSON.stringify(Object.entries(dados)
        .filter(([nome, valor]) => {
          const el = document.querySelector(\`[name="\${nome}"]\`)
          return valor !== '' && el && el.value === ''
        })
        .map(([nome]) => nome))
    `)

  const faltando = JSON.parse(await digitar())
  if (faltando.length) {
    throw new Error(`campos inexistentes no formulário: ${faltando.join(', ')}`)
  }

  /*
   * Confere que o valor GRUDOU, e não só que entrou.
   *
   * O React 19 limpa o `<form action>` quando a action termina — o mesmo
   * comportamento que o `AGENTS.md` documenta. A limpeza **não** vem no commit
   * que mostra a mensagem de erro, vem depois dele: o roteiro via a mensagem,
   * digitava, e a limpeza chegava em seguida e apagava tudo. O envio seguinte
   * ia vazio, e a falha aparecia como "a tela não avançou" — três telas longe
   * da causa, com uma foto de dois campos em branco que não explicava nada.
   *
   * Uma leitura só não basta, e foi o que reprovou contra produção depois de
   * passar no `next dev`: lá a action responde em milissegundos e a limpeza
   * chega antes da conferência; na Vercel ela demora meio segundo e chegava
   * *depois*, com o roteiro já convencido de que os campos estavam bons. Por
   * isso o critério é estabilidade — três leituras seguidas, ~600ms, que é
   * mais do que a folga entre a resposta da action e a limpeza.
   *
   * É artefato de velocidade de máquina, não defeito do produto: a pessoa vê a
   * mensagem e a limpeza no mesmo instante, e leva quase um segundo até o
   * primeiro caractere. Mas teste que perde a corrida falha uma vez a cada
   * cinco, e teste instável não prova nada.
   */
  let seguidas = 0
  for (let leitura = 0; leitura < 25 && seguidas < 3; leitura++) {
    await espera(200)
    if (JSON.parse(await vazios()).length) {
      seguidas = 0
      await digitar()
    } else {
      seguidas++
    }
  }

  if (seguidas < 3) {
    throw new Error(`o formulário limpou os campos: ${JSON.parse(await vazios()).join(', ')}`)
  }
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

/**
 * Clica num botão **da linha de um acesso específico**, achada pelo e-mail.
 *
 * Existe por um estrago de verdade: `clicar('Redefinir senha')` pega o primeiro
 * botão com esse texto na página, e a lista de acessos tem um por pessoa. O
 * roteiro redefiniu a senha, desativou e reativou a conta de quem estava no
 * topo da lista — uma pessoa de verdade, na distribuidora de verdade — e depois
 * falhou ao entrar com o acesso de teste, cuja senha nunca havia mudado. A
 * falha aparecia como "senha errada", a três telas do dano.
 *
 * Um teste que escreve no banco do cliente não pode mirar "o primeiro botão".
 * Aqui ele sobe do botão até o cartão que contém o e-mail alvo, e desiste se o
 * ancestral já contiver mais de um e-mail — sinal de que subiu demais e está
 * prestes a acertar a lista inteira.
 */
async function clicarNaLinhaDoAcesso(rotulo, email = EMAIL_ACESSO_TESTE, ms = 15_000) {
  const limite = Date.now() + ms
  while (Date.now() < limite) {
    const caixa = await js(`
      const rotulo = ${JSON.stringify(rotulo)}
      const email = ${JSON.stringify(email)}
      const daLinha = (botao) => {
        let n = botao.parentElement
        while (n) {
          const t = n.innerText || ''
          const arrobas = (t.match(/@/g) || []).length
          if (arrobas > 1) return false
          if (arrobas === 1) return t.includes(email)
          n = n.parentElement
        }
        return false
      }
      const el = [...document.querySelectorAll('button')]
        .filter((b) => (b.innerText || '').trim().includes(rotulo) && !b.disabled)
        .find(daLinha)
      if (!el) return null
      el.scrollIntoView({ block: 'center' })
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.height === 0) return null
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    `).catch(() => null)

    if (caixa) {
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
            pointerType: 'mouse',
          },
          sessao,
        )
      }
      return
    }
    await espera(200)
  }
  throw new Error(`não achei "${rotulo}" na linha de ${email}`)
}

/**
 * Encerra a sessão, venha ela de onde vier.
 *
 * No painel da Aionix "Sair" é um botão à vista; no shell da distribuidora ele
 * mora dentro do menu da conta, que precisa ser aberto antes. Um trecho do
 * roteiro que assume um dos dois casos falha no outro — e falha como "não achei
 * nada clicável com Sair", que não diz nada sobre a causa. O gatilho é achado
 * pelo `aria-label`, e não pelo nome da pessoa, porque quem está logado muda ao
 * longo da rodada: dona, acesso de teste, admin da Aionix.
 */
async function sair() {
  const aVista = await js(`
    return [...document.querySelectorAll('button, a, [role="menuitem"]')]
      .some((e) => (e.innerText || '').trim().includes('Sair'))
  `)
  if (!aVista) {
    await clicar('', 15_000, '[aria-label^="Conta de"]')
    await esperarPor(async () => (await texto()).includes('Sair'), 'o menu da conta abrir')
  }
  await clicar('Sair')
}

/* -------------------------------------------------------------- roteiro */

await mkdir(PASTA_FOTOS, { recursive: true })

// Antes do Chrome: sem login não há roteiro, e descobrir isso com o navegador
// aberto só atrasa o erro.
if (!EMAIL) await semearDono()
const nomeNaConta = (await primeiroNomeDoLogin()) ?? 'Conta'

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

  await preencher({ email: emailLogin, senha: senhaLogin })
  await clicar('Entrar')
  await esperarCaminho((p) => p.startsWith('/painel'), 'entrar no painel')
  check('login pelo formulário funciona', true)

  /**
   * Aquece todas as telas do menu antes do roteiro começar.
   *
   * O `next dev` compila rota por rota, no primeiro acesso — e a compilação de
   * uma tela nova estoura sozinha os 15s de espera dos passos seguintes. A
   * falha aparecia num lugar aleatório do roteiro, diferente a cada rodada, e
   * sempre longe da causa: "esperando voltar ao painel" quando o que houve foi
   * o Turbopack compilando outra coisa.
   *
   * Aquecer aqui vale por si só: é a checagem de que **toda tela do menu abre**
   * — a mais barata que existe, e a que pega import quebrado antes que ele
   * apareça disfarçado de timeout três telas adiante.
   */
  const rotas = [
    '/painel',
    '/vendas/pdv',
    '/vendas/produtos',
    '/vasilhame/baixa',
    '/vasilhame/saldos',
    '/vasilhame/movimentos',
    '/cadastro/clientes',
    '/cadastro/clientes/novo',
    '/cadastro/produtos',
    '/cadastro/fornecedores',
    '/cadastro/tabelas-preco',
    '/financeiro/receber',
    '/financeiro/pagar',
    '/financeiro/pagar/nova',
    '/financeiro/caixa',
    '/estoque/saldo',
    '/estoque/entradas',
    '/estoque/entradas/nova',
  ]
  const naoAbriram = []
  for (const rota of rotas) {
    await irPara(rota)
    // Cair no login significa sessão perdida; qualquer outro caminho significa
    // redirecionamento inesperado. Os dois são falha de tela, não de espera.
    if (!(await caminho()).startsWith(rota)) naoAbriram.push(`${rota} → ${await caminho()}`)
  }
  check('todas as telas do menu abrem', naoAbriram.length === 0, naoAbriram.join(' | '))

  await irPara('/painel')

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

  /* ---------------------------------------------------------------- PDV
   *
   * O que este bloco prova, e nenhum outro prova: uma venda de balcão não é
   * uma linha em `vendas`. Ela é receita, saída de estoque, entrada de caixa
   * (ou título a receber) e galão que passou a ser dívida do cliente — tudo na
   * mesma transação. É por isso que a conferência não para no recibo: ela vai
   * ver o saldo de vasilhame e a listagem de Contas a Receber depois.
   */
  if (semente) {
    await irPara('/vendas/pdv')
    const pdv = await texto()
    check('o PDV lista os produtos com preço', pdv.includes('Água 20L') && pdv.includes('12,00'))

    // --- venda em dinheiro, com vasilhame e troco
    await clicar(PREFIXO + ' Água 20L')
    await clicar(PREFIXO + ' Água 20L')
    await clicar(PREFIXO + ' Água 20L')
    await esperarPor(
      async () => (await texto()).includes('36,00'),
      'o carrinho somar 3 × R$ 12,00',
    )
    check('clicar no produto três vezes soma três unidades', true)

    await escolherPorTexto('clienteId', nome)
    await esperarPor(
      async () => (await texto()).includes('Galões vazios que ele trouxe'),
      'o contador de vasilhame aparecer no item retornável',
    )
    check('produto retornável pergunta pelo vasilhame devolvido', true)

    await escolherPorTexto('formaId', 'Dinheiro')
    await preencher({ valorRecebido: '50' })
    const antesDeFechar = await esperarPor(
      async () => (await texto()).includes('14,00'),
      'o troco de R$ 14,00 aparecer antes de fechar',
    )
    check('o troco é calculado antes de fechar a venda', Boolean(antesDeFechar))
    await foto('pdv-carrinho')

    await clicar('Fechar venda')
    // Esperar por uma frase que **só** existe no recibo. "Venda" e "Troco" já
    // estão na tela antes de fechar — o resumo mostra os dois — e esperar por
    // elas voltava na hora, com a action ainda em voo. O roteiro navegava para
    // a tela seguinte, o pedido morria no meio, e a falha aparecia três
    // checagens adiante como "a venda não está na listagem".
    await esperarPor(
      async () => (await texto()).includes('Ver na listagem de vendas'),
      'o recibo da venda',
    )
    const recibo = await texto()
    check('a venda fecha e o recibo mostra o troco', recibo.includes('14,00'))
    check(
      'o recibo diz quantos galões o cliente ficou devendo',
      /gal(ã|a)o\(ões\) entregue/i.test(recibo),
      recibo.slice(0, 400),
    )
    await foto('pdv-recibo')

    // O saldo do comodato subiu pelos galões da venda: eram 10 (a quebra de 3
    // foi estornada logo acima) e a venda entregou mais 3.
    await irPara('/vasilhame/saldos')
    check(
      'a venda lançou o comodato no saldo do cliente (10 + 3 = 13)',
      /\b13\b/.test(await texto()),
      (await texto()).slice(0, 300),
    )

    await irPara('/vendas/produtos')
    const listagem = await texto()
    await foto('vendas-listagem')
    check('a venda aparece na listagem com o valor', listagem.includes('36,00'))
    check('a listagem mostra a operação e a forma', listagem.includes('PDV') && listagem.includes('Dinheiro'))

    // --- venda a prazo: nada entra no caixa, e nasce título a receber
    await irPara('/vendas/pdv')
    await clicar(PREFIXO + ' Água 20L')
    await clicar(PREFIXO + ' Água 20L')
    await escolherPorTexto('clienteId', nome)
    // Esperar o contador de vasilhame antes de seguir prova que o cliente foi
    // de fato selecionado. Sem esta espera o roteiro às vezes fechava a venda
    // com o combo ainda vazio, o servidor recusava — a prazo exige cliente — e
    // a falha aparecia como "o recibo não chegou", sem dizer que faltou cliente.
    await esperarPor(
      async () => (await texto()).includes('Galões vazios que ele trouxe'),
      'o cliente entrar na venda a prazo',
    )
    await escolherPorTexto('formaId', 'A Prazo')
    await esperarPor(
      async () => (await texto()).includes('Nada entra no caixa agora'),
      'o aviso de que a prazo não é dinheiro em caixa',
    )
    check('o a prazo avisa que não entra no caixa', true)

    await clicar('Fechar venda')
    // Mesma armadilha: "Contas a Receber" está no menu lateral o tempo todo.
    await esperarPor(
      async () => (await texto()).includes('Ver na listagem de vendas'),
      'o recibo do a prazo',
    )
    const reciboAPrazo = await texto()
    check(
      'venda a prazo vira título em Contas a Receber',
      /T[íi]tulo gerado em Contas a Receber/.test(reciboAPrazo),
      reciboAPrazo.slice(0, 400),
    )

    await irPara('/financeiro/receber')
    const titulos = await texto()
    await foto('receber-do-pdv')
    check(
      'o título gerado pelo PDV aparece em Contas a Receber',
      titulos.includes(nome) && titulos.includes('24,00'),
      titulos.slice(0, 300),
    )

    // --- baixa do título: o dinheiro do a prazo entrando no caixa
    //
    // O seletor mira o link da linha (`/financeiro/receber/<uuid>`) e não o
    // texto "Receber": o item de menu "Contas a Receber" também contém essa
    // palavra, e o roteiro clicaria na barra lateral.
    await clicar('Receber', 15_000, 'a[href^="/financeiro/receber/"]')
    await esperarCaminho(
      (p) => /\/financeiro\/receber\/[0-9a-f-]{36}/.test(p),
      'abrir a baixa do título',
    )
    const baixa = await texto()
    check(
      'a baixa já vem preenchida com o valor cobrado',
      baixa.includes('24,00'),
      baixa.slice(0, 300),
    )
    await foto('receber-baixa')

    await clicar('Confirmar recebimento')
    await esperarPor(
      async () => (await texto()).includes('Voltar para Contas a Receber'),
      'o recibo da baixa',
    )
    check('receber o título confirma na tela com o valor e a conta', true)

    await irPara('/financeiro/receber')
    check(
      'o título baixado aparece como Recebido',
      (await texto()).includes('Recebido'),
      (await texto()).slice(0, 300),
    )

    // --- desfazer: o título volta a ficar em aberto, e o caixa não perde a linha
    await clicar('Ver baixa', 15_000, 'a[href^="/financeiro/receber/"]')
    await esperarPor(
      async () => (await texto()).includes('Desfazer baixa'),
      'a tela do título já recebido',
    )
    await clicar('Desfazer baixa')
    await clicar('Confirmar: título volta a ficar em aberto')
    await esperarPor(
      async () => (await texto()).includes('Confirmar recebimento'),
      'o título voltar a ficar em aberto',
    )
    check('desfazer a baixa devolve o título para em aberto', true)

    // Recebe de novo, para o restante da rodada encontrar o caixa movimentado.
    await clicar('Confirmar recebimento')
    await esperarPor(
      async () => (await texto()).includes('Voltar para Contas a Receber'),
      'a segunda baixa do mesmo título',
    )
    check('o título pode ser recebido de novo depois de desfeito', true)

    // --- caixa: o dinheiro das duas pontas chegando no mesmo lugar
    //
    // A venda em dinheiro (R$ 36,00) entrou na hora; o título do a prazo
    // (R$ 24,00) entrou na baixa. Conferir os dois juntos é o que prova que
    // Contas a Receber e Fluxo de Caixa contam a mesma história — que é
    // exatamente onde o sistema antigo diverge, por lançar as duas coisas em
    // telas separadas.
    await irPara('/financeiro/caixa')
    const caixa = await texto()
    await foto('financeiro-caixa')
    check(
      'a venda em dinheiro aparece no caixa',
      caixa.includes('36,00'),
      caixa.slice(0, 400),
    )
    check(
      'o título baixado aparece no caixa',
      caixa.includes('24,00'),
      caixa.slice(0, 400),
    )
    check('o caixa mostra o saldo por conta', caixa.includes('Caixa Loja'))
    check(
      'o caixa registra o estorno da baixa desfeita, em vez de apagar a entrada',
      caixa.includes('Baixa desfeita'),
      caixa.slice(0, 400),
    )

    /* ------------------------------------------------------ contas a pagar
     *
     * O outro lado do caixa. O que este trecho prova é o parcelamento — um
     * lançamento de R$ 300 em 3× tem que virar três contas de R$ 100, cada uma
     * com seu vencimento, e não uma conta de R$ 300 com um campo "parcelas" ao
     * lado. É essa forma que faz "o que vence esta semana" ter resposta.
     */
    await irPara('/financeiro/pagar/nova')
    await clicar('Custo', 15_000, 'label')
    await preencher({
      descricao: `${PREFIXO} Compra de garrafões`,
      categoria: 'Vasilhame',
      valorPrevisto: '300,00',
    })
    await escolherPorTexto('parcelas', '3×')
    await foto('pagar-lancamento')
    await clicar('Lançar conta')
    await esperarPor(
      async () => (await texto()).includes('Ver Contas a Pagar'),
      'a confirmação do lançamento',
    )
    const lancou = await texto()
    check(
      'lançar em 3× cria três parcelas e diz quando vence a primeira',
      lancou.includes('3 parcelas'),
      lancou.slice(0, 300),
    )

    await irPara('/financeiro/pagar')
    const pagar = await texto()
    await foto('contas-a-pagar')
    check(
      'as três parcelas aparecem com R$ 100,00 cada',
      (pagar.match(/100,00/g) ?? []).length >= 3,
      pagar.slice(0, 400),
    )
    check('a conta lançada como custo aparece separada de despesa', pagar.includes('Custo'))

    // --- pagar a primeira parcela: sai do caixa
    await clicar('Pagar', 15_000, 'a[href^="/financeiro/pagar/"]')
    await esperarCaminho(
      (p) => /\/financeiro\/pagar\/[0-9a-f-]{36}/.test(p),
      'abrir o pagamento da conta',
    )
    await clicar('Confirmar pagamento')
    await esperarPor(
      async () => (await texto()).includes('Voltar para Contas a Pagar'),
      'a confirmação do pagamento',
    )
    check('pagar a conta confirma na tela e diz de onde o dinheiro saiu', true)

    await irPara('/financeiro/caixa')
    const caixaComSaida = await texto()
    check(
      'o pagamento aparece como saída no caixa',
      caixaComSaida.includes('Compra de garrafões') && caixaComSaida.includes('100,00'),
      caixaComSaida.slice(0, 400),
    )

    // --- celular: o balcão também é atendido com o telefone na mão
    await comando(ws, 'Emulation.setDeviceMetricsOverride', CELULAR, sessao)
    await irPara('/vendas/pdv')
    check(
      'no celular o PDV não rola de lado',
      await js('return document.documentElement.scrollWidth <= window.innerWidth + 1'),
      `scrollWidth=${await js('return document.documentElement.scrollWidth')} vs ${await js('return window.innerWidth')}`,
    )
    const pequenos = await js(`
      const alvos = [...document.querySelectorAll('input[name]:not([type="hidden"]), select[name], textarea[name]')]
        .map((e) => ({ nome: e.name, altura: Math.round(e.getBoundingClientRect().height) }))
        .filter((c) => c.altura < 44)
      return JSON.stringify(alvos)
    `)
    check('os campos do PDV têm 44px no toque', pequenos === '[]', `abaixo de 44px: ${pequenos}`)
    await foto('celular-pdv')
    await comando(ws, 'Emulation.setDeviceMetricsOverride', DESKTOP, sessao)
  } else {
    falhas.push('PDV não testado — sem conexão de banco para semear os produtos')
  }

  /* ------------------------------------------------------------- estoque
   *
   * O que este bloco prova, e nenhum outro prova: o estoque sabe subir.
   *
   * Ele roda depois do PDV de propósito. As vendas acima consumiram 5 unidades
   * de um produto que nunca teve entrada, então o saldo chega aqui negativo —
   * que era o estado permanente do sistema antes desta etapa, e é o ponto de
   * partida honesto para testar a entrada.
   */
  if (semente) {
    await irPara('/estoque/saldo')
    const saldo = await texto()
    await foto('estoque-saldo')
    check('o saldo lista o produto que controla estoque', saldo.includes('Água 20L'))
    check(
      'a venda do PDV deixou o saldo negativo, e a tela mostra',
      /[-−]\s?5\b/.test(saldo),
      saldo.slice(0, 400),
    )

    // --- produção: o caminho que a JM usa todo dia
    await irPara('/estoque/entradas/nova')
    const nova = await texto()
    const TIPOS = ['Produção', 'Compra', 'Ajuste de inventário', 'Perda', 'Devolução de cliente']
    const semTipo = TIPOS.filter((t) => !nova.includes(t))
    check('o lançamento oferece os cinco tipos', semTipo.length === 0, semTipo.join(', '))

    await clicar('Produção', 15_000, 'label')
    await escolherPorTexto('produtoId', 'Água 20L')
    await preencher({ quantidade: '100', custoUnitario: '2,50' })
    // O saldo resultante aparece **antes** de gravar: é quando ele ainda serve
    // para a operadora desistir se o número estiver errado.
    await esperarPor(
      async () => (await texto()).includes('95'),
      'o saldo previsto (−5 + 100) aparecer antes de gravar',
    )
    check('a tela mostra onde o saldo vai parar antes de gravar', true)
    await foto('estoque-producao')

    await clicar('Lançar movimento')
    /*
     * Esperar pelo recibo **daquele** lançamento, e não por "Saldo agora".
     *
     * O recibo anterior continua na tela — é o ponto dele, a operadora confere
     * o que gravou antes de seguir. Uma espera por texto genérico casava com o
     * recibo de antes e voltava na hora, com a action ainda em voo: o roteiro
     * começava a preencher o lançamento seguinte e a resposta chegava por cima.
     * Mesma armadilha já anotada no bloco do PDV.
     */
    await esperarPor(
      async () => (await texto()).includes('Produção:'),
      'o recibo da produção',
    )
    const reciboProducao = await texto()
    check('produção lançada e o saldo sai do negativo', reciboProducao.includes('95'))
    check(
      'o recibo mostra o custo médio resultante',
      reciboProducao.includes('2,50'),
      reciboProducao.slice(0, 300),
    )

    // --- ajuste: ela digita o que contou, não a diferença
    await clicar('Ajuste de inventário', 15_000, 'label')
    await preencher({ contagem: '90' })
    await esperarPor(
      async () => /Lançamento:\s*[-−]\s?5/.test(await texto()),
      'o ajuste calcular a diferença entre o contado e o sistema',
    )
    check('o ajuste faz a subtração no lugar da operadora', true)
    await clicar('Lançar movimento')
    await esperarPor(
      async () => (await texto()).includes('Ajuste de inventário:'),
      'o recibo do ajuste',
    )
    check('ajuste lançado pela contagem física', (await texto()).includes('90'))

    // --- compra a prazo: a mercadoria entra e a dívida nasce juntas
    await clicar('Compra', 15_000, 'label')
    await escolherPorTexto('produtoId', 'Água 20L')
    await preencher({ quantidade: '10', custoUnitario: '3,00' })
    await clicar('Gerar título em Contas a Pagar', 15_000, 'label')
    await esperarPor(
      async () => (await js(`return !!document.querySelector('[name="vencimento"]')`)) === true,
      'o campo de vencimento aparecer ao marcar o título',
    )
    check('marcar o título pede o vencimento', true)
    await foto('estoque-compra')

    const marcado = await js(
      `return document.querySelector('[name="gerarContaPagar"]')?.checked === true`,
    )
    const qtdAntesDeEnviar = await js(
      `return document.querySelector('[name="quantidade"]')?.value ?? '(sem campo)'`,
    )
    await clicar('Lançar movimento')
    /*
     * Esperar pelo recibo **da compra**, e não por "Saldo agora".
     *
     * O recibo do lançamento anterior continua na tela — é o ponto dele, a
     * operadora confere o que gravou antes de seguir. Uma espera por texto
     * genérico casava com o recibo do ajuste e voltava na hora, com a action da
     * compra ainda em voo: a checagem seguinte lia a tela antiga e acusava um
     * bug que não existia. É a mesma armadilha já anotada no bloco do PDV.
     */
    await esperarPor(
      async () => {
        const t = await texto()
        return t.includes('Compra:') || t.includes('Não foi')
      },
      'o recibo da compra',
    )
    const reciboCompra = await texto()
    const recorte = await js(
      `return [...document.querySelectorAll('[role="alert"], [role="status"]')].map((e) => e.innerText).join(' | ')`,
    )
    check(
      'a compra gera o título em Contas a Pagar',
      reciboCompra.includes('Título de') && reciboCompra.includes('30,00'),
      `checkbox=${marcado} quantidade=${qtdAntesDeEnviar} · na tela: ${recorte}`,
    )

    await irPara('/financeiro/pagar')
    const pagar = await texto()
    check(
      'o título da compra chega em Contas a Pagar',
      pagar.includes('Água 20L') && pagar.includes('30,00'),
      pagar.slice(0, 400),
    )

    // --- estorno: a compra digitada errada não pode inflar o custo médio
    await irPara('/estoque/entradas')
    const movimentos = await texto()
    await foto('estoque-movimentos')
    check(
      'o razão mostra os lançamentos com tipo e sinal',
      movimentos.includes('Produção') && movimentos.includes('Compra') && movimentos.includes('+100'),
    )

    await clicar('Estornar')
    await clicar('Confirmar')
    await esperarPor(
      async () => (await texto()).includes('estornado'),
      'o movimento marcado como estornado',
    )
    check('a compra errada pode ser estornada', true)

    // O custo médio tem que voltar ao que era antes da compra. Sem a remoção da
    // camada no trigger da 0011, a quantidade voltava e o custo ficava inflado
    // — e o CMV do mês sairia errado sem nenhuma linha visível explicando.
    await irPara('/estoque/saldo')
    const depoisDoEstorno = await texto()
    check(
      'o estorno devolve o custo médio ao valor anterior',
      depoisDoEstorno.includes('2,50'),
      depoisDoEstorno.slice(0, 400),
    )

    // --- extrato: o histórico explica o saldo linha a linha
    await clicar(PREFIXO + ' Água 20L')
    await esperarCaminho(
      (p) => /\/estoque\/saldo\/[0-9a-f-]{36}/.test(p),
      'abrir o extrato do produto',
    )
    const extrato = await texto()
    await foto('estoque-extrato')
    check(
      'o extrato lista os movimentos do produto',
      extrato.includes('Produção') && extrato.includes('Ajuste de inventário'),
    )
    check('o extrato traz o saldo corrente para auditar a conta', extrato.includes('+100'))

    // --- celular: o dono confere o estoque fora da loja
    await comando(ws, 'Emulation.setDeviceMetricsOverride', CELULAR, sessao)
    await irPara('/estoque/entradas/nova')
    check(
      'no celular o lançamento de estoque não rola de lado',
      await js('return document.documentElement.scrollWidth <= window.innerWidth + 1'),
      `scrollWidth=${await js('return document.documentElement.scrollWidth')} vs ${await js('return window.innerWidth')}`,
    )
    const miudos = await js(`
      const alvos = [...document.querySelectorAll('input[name]:not([type="hidden"]):not([type="checkbox"]):not(.sr-only), select[name], label:has(input[type="radio"])')]
        .map((e) => ({ nome: e.getAttribute('name') || e.innerText.trim().slice(0, 20), altura: Math.round(e.getBoundingClientRect().height) }))
        .filter((c) => c.altura < 44)
      return JSON.stringify(alvos)
    `)
    check('os alvos de toque do estoque têm 44px', miudos === '[]', `abaixo de 44px: ${miudos}`)
    await foto('celular-estoque')

    await irPara('/estoque/saldo')
    check(
      'no celular o saldo em estoque não rola de lado',
      await js('return document.documentElement.scrollWidth <= window.innerWidth + 1'),
      `scrollWidth=${await js('return document.documentElement.scrollWidth')} vs ${await js('return window.innerWidth')}`,
    )
    await comando(ws, 'Emulation.setDeviceMetricsOverride', DESKTOP, sessao)
  } else {
    falhas.push('estoque não testado — sem conexão de banco para semear os produtos')
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
  // Esta tela era conferida vazia — não havia como um título nascer. Agora há:
  // a venda fiada do PDV, algumas linhas acima, gerou um. Conferir o vazio aqui
  // passaria a exigir que o PDV **não** tivesse funcionado.
  check(
    'o título do PDV chega com a situação derivada de vencimento e pagamento',
    receber.includes('Em aberto'),
    receber.slice(0, 300),
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
  await acionarPeloTeclado(nomeNaConta)
  const abriuNoTeclado = await esperarPor(
    async () => (await texto()).includes('Sair'),
    'o menu da conta abrir pelo teclado',
    5_000,
  ).catch(() => false)
  check('o menu da conta abre pelo teclado', abriuNoTeclado)

  if (!abriuNoTeclado) {
    await clicar(nomeNaConta)
    await esperarPor(async () => (await texto()).includes('Sair'), 'o menu da conta abrir')
  }
  check('o menu da conta abre', true)

  await clicar('Sair')
  await esperarCaminho((p) => p.startsWith('/login'), 'voltar ao login')
  check('sair encerra a sessão de verdade', true)

  await irPara('/cadastro/clientes')
  check('depois de sair, as telas não abrem mais', (await caminho()).startsWith('/login'))

  /* ------------------------------------------------ administração (Aionix)
   *
   * O primeiro acesso de um admin, de ponta a ponta: entrar com a senha
   * provisória, ser trancado na troca, escolher a definitiva, ver a lista de
   * distribuidoras, entrar numa, e sair dela.
   *
   * A perna que mais importa é a da tranca. "Trocar a senha no primeiro
   * acesso" é o tipo de regra que se escreve num redirect e funciona no
   * caminho feliz — e falha no dia em que alguém digita `/painel` direto na
   * barra de endereço, que é exatamente o que este roteiro faz abaixo.
   */
  if (banco) {
    await banco`delete from plataforma_admins where email = ${EMAIL_ADMIN_TESTE}`
    const hashProvisorio = await bcrypt.hash(SENHA_ADMIN_PROVISORIA, 12)
    await banco`
      insert into plataforma_admins (id, nome, email, senha_hash, senha_provisoria)
           values (${randomUUID()}, 'Teste Fluxo', ${EMAIL_ADMIN_TESTE}, ${hashProvisorio}, true)
    `

    await irPara('/login')
    await preencher({ email: EMAIL_ADMIN_TESTE, senha: SENHA_ADMIN_PROVISORIA })
    await clicar('Entrar')
    await esperarCaminho((p) => p.startsWith('/admin/senha'), 'cair na troca de senha')
    check('admin com senha provisória cai direto na troca de senha', true)

    // A tranca. Digitar a URL na mão é o caminho que passa por fora de todo
    // link da interface — se a regra só existisse no `redirect` do login, isto
    // abriria o sistema inteiro com a senha que nós entregamos por WhatsApp.
    await irPara('/painel')
    check(
      'senha provisória não abre o sistema nem pela URL',
      (await caminho()).startsWith('/admin/senha'),
      await caminho(),
    )
    await irPara('/admin')
    check(
      'senha provisória não abre nem o painel da Aionix',
      (await caminho()).startsWith('/admin/senha'),
      await caminho(),
    )

    await foto('admin-troca-senha')

    // Senhas diferentes: erro claro, e a pessoa continua na tela.
    await preencher({ senha: SENHA_ADMIN_NOVA, confirmacao: 'outra-coisa-qualquer' })
    await clicar('Salvar e entrar')
    await esperarPor(
      async () => (await texto()).includes('não conferem'),
      'a mensagem de senhas diferentes',
    )
    check('senhas diferentes são recusadas com mensagem clara', true)

    // Curta demais: o mínimo é 10, e a mensagem precisa dizer isso.
    await preencher({ senha: 'curta', confirmacao: 'curta' })
    await clicar('Salvar e entrar')
    await esperarPor(
      async () => (await texto()).includes('10 caracteres'),
      'a mensagem de senha curta',
    )
    check('senha curta é recusada com mensagem clara', true)

    await preencher({ senha: SENHA_ADMIN_NOVA, confirmacao: SENHA_ADMIN_NOVA })
    await clicar('Salvar e entrar')
    await esperarCaminho((p) => p === '/admin', 'chegar no painel da Aionix')
    check('trocar a senha destranca e leva ao painel', true)

    const painelAdmin = await texto()
    await foto('admin-painel')
    check('o painel lista as distribuidoras', painelAdmin.includes('Distribuidoras'))
    check(
      'a distribuidora do cliente aparece na lista',
      /Distribuidora|Natuclara/i.test(painelAdmin),
      painelAdmin.split('\n').slice(0, 6).join(' / '),
    )

    /* ------------------------------------------- acessos da distribuidora
     *
     * Criar login saiu do terminal e virou tela. O que este trecho prova não é
     * que o formulário grava — é que o acesso criado por ele **entra no
     * sistema**, que desativar de fato fecha a porta, e que a senha redefinida
     * é a que passa a valer. Uma tela de gestão de acesso que grava a linha
     * certa e produz um login que não funciona é pior que não ter tela: o admin
     * repassa a senha por telefone e descobre pelo cliente.
     */
    await clicar('Acessos')
    await esperarCaminho((p) => p.startsWith('/admin/empresas/'), 'abrir a tela de acessos')
    const telaAcessos = await texto()
    await foto('admin-acessos')
    check('a tela de acessos abre com o nome da distribuidora', /Natuclara|Distribuidora/i.test(telaAcessos))

    // Senha curta: o mínimo é 8, e a mensagem tem que dizer isso. Aqui a pessoa
    // está inventando senha para outra pessoa, com ela no telefone — mensagem
    // vaga vira tentativa e erro no meio da ligação.
    await preencher({
      nome: PREFIXO + ' Operador',
      email: EMAIL_ACESSO_TESTE,
      senha: 'curta',
      papel: 'operador',
    })
    await clicar('Criar acesso')
    await esperarPor(
      async () => (await texto()).includes('8 caracteres'),
      'a mensagem de senha curta no acesso',
    )
    check('acesso com senha curta é recusado com mensagem clara', true)

    // E o que já estava digitado continua lá. É a regra do React 19 anotada no
    // AGENTS.md: sem devolver os valores, o admin redigita nome e e-mail por
    // causa de uma senha de sete caracteres.
    check(
      'o formulário de acesso não perde o que foi digitado ao errar',
      await js(`
        const v = (n) => (document.querySelector('[name="' + n + '"]') || {}).value || ''
        return v('nome').includes('Operador') && v('email').includes('acesso-fluxo')
      `),
    )

    await preencher({
      nome: PREFIXO + ' Operador',
      email: EMAIL_ACESSO_TESTE,
      senha: SENHA_ACESSO_PRIMEIRA,
      papel: 'operador',
    })
    await clicar('Criar acesso')
    await esperarPor(
      async () => (await texto()).includes('Acesso de'),
      'a confirmação do acesso criado',
    )
    check('criar acesso confirma na tela', true)
    check('o acesso novo aparece na lista', (await texto()).includes(EMAIL_ACESSO_TESTE))

    // E-mail repetido: o índice é global, então a mensagem não pode ser
    // "já existe nesta empresa" — pode ser de outra distribuidora.
    await preencher({
      nome: PREFIXO + ' Repetido',
      email: EMAIL_ACESSO_TESTE,
      senha: SENHA_ACESSO_PRIMEIRA,
      papel: 'operador',
    })
    await clicar('Criar acesso')
    await esperarPor(
      async () => (await texto()).includes('já é login'),
      'a recusa do e-mail repetido',
    )
    check('e-mail repetido é recusado com mensagem clara', true)

    // A prova que interessa: o login criado abre o sistema.
    await clicar('Sair')
    await esperarCaminho((p) => p.startsWith('/login'), 'sair da Aionix')
    await preencher({ email: EMAIL_ACESSO_TESTE, senha: SENHA_ACESSO_PRIMEIRA })
    await clicar('Entrar')
    await esperarCaminho((p) => p.startsWith('/painel'), 'entrar com o acesso recém-criado')
    check('o acesso criado no painel realmente entra no sistema', true)
    await foto('acesso-criado-dentro')

    // Aqui a sessão é a de um operador dentro da distribuidora: o "Sair" está
    // no menu da conta, não à vista como no painel da Aionix.
    await sair()
    await esperarCaminho((p) => p.startsWith('/login'), 'sair do acesso de teste')

    const voltarComoAdmin = async () => {
      await preencher({ email: EMAIL_ADMIN_TESTE, senha: SENHA_ADMIN_NOVA })
      await clicar('Entrar')
      await esperarCaminho((p) => p === '/admin', 'voltar ao painel da Aionix')
      await clicar('Acessos')
      await esperarCaminho((p) => p.startsWith('/admin/empresas/'), 'reabrir a tela de acessos')
    }

    await voltarComoAdmin()

    // Redefinir e desativar na mesma passagem, para conferir a interação entre
    // os dois: senha nova correta **e** acesso desativado tem que ser recusado.
    // Testar só o desativado com a senha antiga não provaria nada — a recusa
    // poderia estar vindo da senha.
    await clicarNaLinhaDoAcesso('Redefinir senha')
    await preencher({ novaSenha: SENHA_ACESSO_SEGUNDA })
    await clicarNaLinhaDoAcesso('Salvar senha')
    await esperarPor(
      async () => (await texto()).includes('Senha redefinida'),
      'a confirmação da senha redefinida',
    )
    check('redefinir senha confirma na tela', true)

    await clicarNaLinhaDoAcesso('Desativar')
    await esperarPor(
      async () => (await texto()).includes('Desativado'),
      'o selo de acesso desativado',
    )
    check('desativar marca o acesso na lista', true)
    await foto('admin-acesso-desativado')

    await clicar('Sair')
    await esperarCaminho((p) => p.startsWith('/login'), 'sair para testar o acesso desativado')
    await preencher({ email: EMAIL_ACESSO_TESTE, senha: SENHA_ACESSO_SEGUNDA })
    await clicar('Entrar')
    await esperarPor(
      async () => (await texto()).includes('E-mail ou senha incorretos'),
      'a recusa do acesso desativado',
    )
    check('acesso desativado não entra, nem com a senha certa', true)

    await voltarComoAdmin()
    await clicarNaLinhaDoAcesso('Reativar')
    await esperarPor(
      async () => !(await texto()).includes('Desativado'),
      'o selo de desativado sumir',
    )
    check('reativar devolve o acesso à lista de ativos', true)

    await clicar('Sair')
    await esperarCaminho((p) => p.startsWith('/login'), 'sair para testar a senha nova')
    await preencher({ email: EMAIL_ACESSO_TESTE, senha: SENHA_ACESSO_SEGUNDA })
    await clicar('Entrar')
    await esperarCaminho((p) => p.startsWith('/painel'), 'entrar com a senha redefinida')
    check('a senha redefinida é a que vale, e reativar reabre a porta', true)

    await sair()
    await esperarCaminho((p) => p.startsWith('/login'), 'sair do acesso reativado')
    await preencher({ email: EMAIL_ACESSO_TESTE, senha: SENHA_ACESSO_PRIMEIRA })
    await clicar('Entrar')
    await esperarPor(
      async () => (await texto()).includes('E-mail ou senha incorretos'),
      'a recusa da senha antiga do acesso',
    )
    check('a senha antiga do acesso deixa de funcionar depois de redefinida', true)

    await preencher({ email: EMAIL_ADMIN_TESTE, senha: SENHA_ADMIN_NOVA })
    await clicar('Entrar')
    await esperarCaminho((p) => p === '/admin', 'voltar ao painel da Aionix')

    await clicar('Entrar')
    await esperarCaminho((p) => p.startsWith('/painel'), 'entrar na distribuidora')
    const dentro = await texto()
    await foto('admin-dentro-da-empresa')
    check('admin entra na distribuidora e cai no painel dela', true)

    // A faixa é a defesa contra o erro mais caro que este acesso permite:
    // lançar na empresa errada com três abas abertas.
    check(
      'a faixa avisa em qual empresa o admin está',
      dentro.includes('Acesso Aionix em'),
      dentro.split('\n').slice(0, 3).join(' / '),
    )

    // A faixa é o elemento mais apertado do sistema no celular: ícone, nome da
    // empresa e um botão na mesma linha de 390px. Se ela empurrar a página
    // para o lado, todas as telas herdam a rolagem horizontal — e o suporte
    // pelo celular acontece justamente na rua, que é quando ele é urgente.
    await comando(ws, 'Emulation.setDeviceMetricsOverride', CELULAR, sessao)
    await irPara('/painel')
    await foto('celular-admin-dentro-da-empresa')
    check(
      'no celular a faixa de admin não empurra a página para o lado',
      await js('return document.documentElement.scrollWidth <= window.innerWidth + 1'),
      `scrollWidth=${await js('return document.documentElement.scrollWidth')} vs ${await js('return window.innerWidth')}`,
    )
    // O nome da empresa, e não o texto "Acesso Aionix em": no celular o rótulo
    // some para dar a largura inteira ao nome, que é a única coisa que a faixa
    // precisa conseguir dizer ali. Conferir o rótulo seria conferir o enfeite.
    check(
      'no celular a faixa continua dizendo a empresa',
      /Natuclara|Distribuidora/i.test(await texto()),
      (await texto()).split('\n').slice(0, 3).join(' / '),
    )

    // Clicado ainda no celular, de propósito, e pelo `aria-label`: no telefone
    // o rótulo visível encolhe para "Sair", e é o rótulo acessível que segura
    // a frase inteira. Procurar por ele aqui prova as duas coisas de uma vez —
    // que o botão existe no tamanho pequeno e que continua se anunciando.
    await clicar('Sair', 15_000, '[aria-label="Sair da empresa"]')
    await esperarCaminho((p) => p === '/admin', 'voltar ao painel da Aionix')
    check('sair da empresa volta ao painel sem pedir login de novo', true)

    await foto('celular-admin-painel')
    check(
      'no celular o painel da Aionix não rola de lado',
      await js('return document.documentElement.scrollWidth <= window.innerWidth + 1'),
      `scrollWidth=${await js('return document.documentElement.scrollWidth')} vs ${await js('return window.innerWidth')}`,
    )
    check(
      'no celular o botão de entrar mantém os 44px de toque',
      await js(`
        const b = [...document.querySelectorAll('button')]
          .find((e) => (e.innerText || '').trim().startsWith('Entrar'))
        return b ? Math.round(b.getBoundingClientRect().height) >= 44 : false
      `),
    )
    await comando(ws, 'Emulation.setDeviceMetricsOverride', DESKTOP, sessao)

    // E a senha nova de fato substituiu a provisória: sai, entra com ela, e
    // desta vez o sistema não pede troca nenhuma.
    await clicar('Sair')
    await esperarCaminho((p) => p.startsWith('/login'), 'sair da Aionix')
    await preencher({ email: EMAIL_ADMIN_TESTE, senha: SENHA_ADMIN_NOVA })
    await clicar('Entrar')
    await esperarCaminho((p) => p === '/admin', 'entrar com a senha definitiva')
    check('a senha nova vale e não pede troca de novo', true)

    // E a provisória morreu junto. Sair antes é obrigatório: com sessão de
    // admin no cookie, o `/login` redireciona para `/admin` e o teste
    // "passaria" sem nunca ter chegado ao formulário.
    await clicar('Sair')
    await esperarCaminho((p) => p.startsWith('/login'), 'voltar ao login')
    await preencher({ email: EMAIL_ADMIN_TESTE, senha: SENHA_ADMIN_PROVISORIA })
    await clicar('Entrar')
    await esperarPor(
      async () => (await texto()).includes('E-mail ou senha incorretos'),
      'a recusa da senha provisória antiga',
    )
    check('a senha provisória deixa de funcionar depois da troca', true)
  }

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
  // O dono descartável sai aqui e não dentro da `faxina()`: ela também roda no
  // meio do roteiro, com esse login em uso — apagar o usuário da sessão ativa
  // derrubaria a rodada de um jeito difícil de ler.
  if (!EMAIL && banco) {
    await banco`delete from users where email = ${EMAIL_DONO_TESTE}`.catch((err) =>
      falhas.push(`não consegui apagar o dono de teste: ${err.message}`),
    )
  }
  await banco?.end({ timeout: 5 }).catch(() => {})
}

console.log(`\n✓ ${ok.length} passaram`)
for (const o of ok) console.log(`   ${o}`)
if (falhas.length) {
  console.log(`\n✗ ${falhas.length} FALHARAM`)
  for (const f of falhas) console.log(`   ${f}`)
  process.exitCode = 1
}
