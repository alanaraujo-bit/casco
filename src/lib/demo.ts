/**
 * Dados de demonstração.
 *
 * Existem para que o cliente veja o sistema com cara de sistema em uso, e não
 * uma tela vazia com "nenhum registro". A escala segue a real levantada na
 * auditoria do Fature Gestão — **R$ 126 mil de faturamento por MÊS**, 17.371
 * unidades/mês, ticket de R$ 6,60 por galão no atacado, 30 clientes de revenda,
 * e só 4 deles com telefone cadastrado. Nomes, documentos e endereços são
 * inventados: nada de dado real de cliente entra no repositório.
 *
 * **Regra deste arquivo: nenhum total é escrito à mão.** Todo número que
 * aparece em mais de uma tela é derivado da mesma lista. A primeira versão
 * tinha `RESUMO` digitado e `CONTAS_RECEBER` gerado, e o painel dizia
 * "R$ 8.940 a receber" enquanto a tela de destino somava R$ 19.851. O dono de
 * distribuidora soma de cabeça — ele acha isso em trinta segundos, e a partir
 * daí não acredita em mais nenhum número do sistema.
 *
 * Este arquivo sai do projeto quando o banco assumir as telas. Está isolado em
 * um módulo só para que essa remoção seja um `rm`, e não uma caçada.
 */

export interface ClienteDemo {
  id: string
  nome: string
  tipo: 'Revenda' | 'Mercado' | 'Restaurante' | 'Consumidor'
  documento: string
  telefone: string
  bairro: string
  cidade: string
  vasilhames: number
  ultimaCompra: string
  diasSemComprar: number
  saldoDevedor: number
}

export interface ContaDemo {
  id: string
  origem: string
  codigo: string
  cliente: string
  emissao: string
  valorTotal: number
  parcela: string
  valorParcela: number
  vencimento: string
  situacao: 'Recebido' | 'Em aberto' | 'Vencido'
  banco: string
  formaPagamento: string
  taxas: number
  dataPagamento: string | null
  valorPago: number | null
}

/** Data de referência da demonstração. Tudo que é "hoje" sai daqui. */
export const HOJE = new Date(2026, 6, 30)

const dd = (d: Date) =>
  `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`

const diasAtras = (n: number) => {
  const d = new Date(HOJE)
  d.setDate(d.getDate() - n)
  return d
}

const diasAFrente = (n: number) => diasAtras(-n)

/* ---------------------------------------------------------------- produtos */

/**
 * O mix em RECEITA, não em unidade.
 *
 * Comparar 15.900 galões de água com 190 botijões de P13 na mesma barra ensina
 * o número errado: a água parece 80× o gás, quando em dinheiro a diferença é
 * de 5×. Unidade vira informação secundária, dentro do rótulo.
 */
export const MIX_PRODUTOS = [
  { rotulo: 'Água 20L retornável', unidades: 15_900, preco: 6.6, cor: 'var(--cat-1)' },
  { rotulo: 'Gás P13', unidades: 190, preco: 110, cor: 'var(--cat-2)' },
  { rotulo: 'Gás P45', unidades: 12, preco: 380, cor: 'var(--cat-3)' },
  { rotulo: 'Água 10L retornável', unidades: 900, preco: 4.5, cor: 'var(--cat-4)' },
  { rotulo: 'Fardo 500ml (12un)', unidades: 210, preco: 9, cor: 'var(--cat-5)' },
].map((p) => ({ ...p, receita: p.unidades * p.preco }))

const FATURAMENTO_MES = MIX_PRODUTOS.reduce((s, p) => s + p.receita, 0)
const UNIDADES_MES = MIX_PRODUTOS.reduce((s, p) => s + p.unidades, 0)

/* ---------------------------------------------------------------- clientes */

const bairros = [
  'Centro',
  'Setor Industrial',
  'Vila Nova',
  'Jardim Paraíso',
  'Bela Vista',
  'Novo Horizonte',
]

// Só 4 dos 24 têm telefone, de propósito. A auditoria encontrou 4 de 30 no
// sistema deles (§1.1). É defeito de cadastro real, e o cabeçalho de métricas
// existe justamente para mostrá-lo — apagar isso seria apagar o argumento.
const COM_TELEFONE = new Set([0, 3, 9, 17])
const SEM_DOCUMENTO = new Set([12, 13, 14, 20, 23])

const nomes: [string, ClienteDemo['tipo']][] = [
  ['Mercado Bom Preço', 'Mercado'],
  ['Distribuidora Norte', 'Revenda'],
  ['Restaurante Sabor da Terra', 'Restaurante'],
  ['Depósito Central', 'Revenda'],
  ['Padaria Pão Quente', 'Mercado'],
  ['Hotel Xingu', 'Restaurante'],
  ['Mercadinho São José', 'Mercado'],
  ['Top Gás Tucumã', 'Revenda'],
  ['Supermercado Família', 'Mercado'],
  ['Lanchonete do Zé', 'Restaurante'],
  ['Comercial Vieira', 'Revenda'],
  ['Pizzaria Forno a Lenha', 'Restaurante'],
  ['Maria Aparecida Souza', 'Consumidor'],
  ['João Batista Lima', 'Consumidor'],
  ['Ana Cláudia Ferreira', 'Consumidor'],
  ['Conveniência 24h', 'Mercado'],
  ['Açaí do Parque', 'Restaurante'],
  ['Imperial Gás', 'Revenda'],
  ['Escola Pequeno Príncipe', 'Restaurante'],
  ['Farmácia Vida', 'Mercado'],
  ['Raimundo Nonato Silva', 'Consumidor'],
  ['Mercearia da Esquina', 'Mercado'],
  ['Pousada Beira-Rio', 'Restaurante'],
  ['Antônia Barbosa', 'Consumidor'],
]

/** Dias desde a última compra. Alguns clientes sumiram — é o ponto. */
const DIAS_PARADO = [
  1, 2, 1, 3, 2, 4, 1, 28, 3, 2, 41, 5, 9, 2, 6, 1, 3, 19, 7, 2, 34, 4, 11, 2,
]

export const CLIENTES: ClienteDemo[] = nomes.map(([nome, tipo], i) => {
  const dias = DIAS_PARADO[i]
  return {
    id: `c${i + 1}`,
    nome,
    tipo,
    documento: SEM_DOCUMENTO.has(i)
      ? ''
      : tipo === 'Consumidor'
        ? `${300 + i}.${100 + i}.${200 + i}-0${i % 10}`
        : `1${i}.${400 + i}.${500 + i}/0001-${10 + (i % 80)}`,
    telefone: COM_TELEFONE.has(i) ? `(94) 9${8100 + i * 37}-${1000 + i * 53}` : '',
    bairro: bairros[i % bairros.length],
    cidade: i % 7 === 0 ? 'Ourilândia do Norte' : 'Tucumã',
    // Atacado carrega estoque de galão; consumidor final tem 1 ou 2.
    vasilhames:
      tipo === 'Consumidor' ? (i % 2) + 1 : Math.round(60 + ((i * 137) % 340)),
    ultimaCompra: dd(diasAtras(dias)),
    diasSemComprar: dias,
    saldoDevedor: tipo === 'Consumidor' ? 0 : Math.round(((i * 971) % 7400) * 100) / 100,
  }
})

/** Quem parou de comprar. A auditoria diz que o sistema deles não responde isso. */
export const CLIENTES_SUMIDOS = CLIENTES.filter((c) => c.diasSemComprar >= 15).sort(
  (a, b) => b.diasSemComprar - a.diasSemComprar,
)

/* -------------------------------------------------------------- vasilhame */

/** Custo de reposição de um galão de 20L. Base de todo cálculo de perda. */
export const CUSTO_VASILHAME = 38

const EM_PODER_DE_CLIENTES = CLIENTES.reduce((s, c) => s + c.vasilhames, 0)

export const VASILHAME = {
  emPoderDeClientes: EM_PODER_DE_CLIENTES,
  noDeposito: 1_260,
  naFabrica: 480,
  /** Quebrados, trincados ou não devolvidos no mês. */
  perdasMes: 64,
  perdasMesAnterior: 91,
  custoPerdasMes: 64 * CUSTO_VASILHAME,
  /**
   * O número que nenhum sistema dá ao dono: quanto de patrimônio dele está
   * dentro da casa dos outros neste momento.
   */
  patrimonioNaRua: EM_PODER_DE_CLIENTES * CUSTO_VASILHAME,
  /**
   * O que as mesmas baixas viravam no Fature Gestão: venda de centavos, porque
   * não existia lugar para lançar galão quebrado (auditoria §5).
   */
  receitaFalsaNoLegado: 64 * 0.13,
}

export const MOTIVOS_PERDA = [
  { rotulo: 'Quebrado na entrega', valor: 29, cor: 'var(--cat-6)' },
  { rotulo: 'Trincado', valor: 21, cor: 'var(--cat-5)' },
  { rotulo: 'Não devolvido', valor: 14, cor: 'var(--cat-3)' },
]

/* --------------------------------------------------------- contas a receber */

const formas = ['Dinheiro', 'PIX', 'Cartão Débito', 'Boleto', 'Prazo 30 dias']
const bancos = ['Caixa Loja', 'Banco do Brasil', 'PIX Sicoob', 'Bradesco']

export const CONTAS_RECEBER: ContaDemo[] = Array.from({ length: 46 }, (_, i) => {
  const cliente = CLIENTES[i % CLIENTES.length]
  const total = Math.round((((i * 373) % 4800) + 260) * 100) / 100
  const parcelas = (i % 3) + 1
  const numeroParcela = (i % parcelas) + 1

  // Vencido = venceu e não foi pago. Nunca sorteado: a situação é consequência
  // da data, senão a tela mostra "Vencido" com vencimento no futuro.
  const recebido = i % 2 === 0
  const desloca = recebido ? -((i % 20) + 1) : i % 7 === 3 ? -((i % 12) + 2) : (i % 24) + 1
  const vencimento = diasAtras(-desloca)
  const situacao: ContaDemo['situacao'] = recebido
    ? 'Recebido'
    : vencimento < HOJE
      ? 'Vencido'
      : 'Em aberto'

  const taxas = formas[i % formas.length] === 'Cartão Débito' ? Math.round(total * 0.0149 * 100) / 100 : 0

  return {
    id: `r${i + 1}`,
    origem: i % 5 === 0 ? 'PDV' : 'Venda de Produtos',
    codigo: String(1000 + i),
    cliente: cliente.nome,
    emissao: dd(diasAtras(((i * 3) % 40) + 2)),
    valorTotal: total,
    parcela: `${numeroParcela}/${parcelas}`,
    valorParcela: Math.round((total / parcelas) * 100) / 100,
    vencimento: dd(vencimento),
    situacao,
    banco: bancos[i % bancos.length],
    formaPagamento: formas[i % formas.length],
    taxas,
    dataPagamento: situacao === 'Recebido' ? dd(diasAtras((i % 18) + 1)) : null,
    valorPago: situacao === 'Recebido' ? Math.round((total / parcelas) * 100) / 100 : null,
  }
})

const somaSe = (f: (c: ContaDemo) => boolean) =>
  CONTAS_RECEBER.filter(f).reduce((s, c) => s + c.valorParcela, 0)

/** Vence dentro de N dias e ainda não foi pago. Para-brisa, não retrovisor. */
function venceEm(dias: number) {
  const limite = diasAFrente(dias)
  return CONTAS_RECEBER.filter((c) => {
    if (c.situacao !== 'Em aberto') return false
    const [d, m, a] = c.vencimento.split('/')
    const v = new Date(Number(a), Number(m) - 1, Number(d))
    return v <= limite
  })
}

/* ----------------------------------------------------------------- resumo */

const VENDAS_MES = 638

export const RESUMO = {
  faturamentoMes: FATURAMENTO_MES,
  faturamentoMesAnterior: 126_480,
  unidadesMes: UNIDADES_MES,
  vendasMes: VENDAS_MES,
  vendasHoje: 26,
  vendasOntem: 21,
  ticketMedio: FATURAMENTO_MES / VENDAS_MES,

  aReceber: somaSe((c) => c.situacao !== 'Recebido'),
  aReceberQtd: CONTAS_RECEBER.filter((c) => c.situacao !== 'Recebido').length,
  recebido: somaSe((c) => c.situacao === 'Recebido'),
  emAberto: somaSe((c) => c.situacao === 'Em aberto'),
  vencido: somaSe((c) => c.situacao === 'Vencido'),
  vencidoQtd: CONTAS_RECEBER.filter((c) => c.situacao === 'Vencido').length,

  venceHoje: venceEm(0).length,
  venceEm7: venceEm(7).length,
  venceEm30: venceEm(30).length,

  clientesAtivos: CLIENTES.length,
  clientesSumidos: CLIENTES_SUMIDOS.length,
}

/* ---------------------------------------------------------------- séries */

/** Faturamento fechado dos 11 meses anteriores + o mês em curso. */
export const FATURAMENTO_MENSAL = [
  { rotulo: 'Ago', valor: 78_400 },
  { rotulo: 'Set', valor: 84_100 },
  { rotulo: 'Out', valor: 91_600 },
  { rotulo: 'Nov', valor: 103_200 },
  { rotulo: 'Dez', valor: 118_900 },
  { rotulo: 'Jan', valor: 65_300 },
  { rotulo: 'Fev', valor: 71_800 },
  { rotulo: 'Mar', valor: 89_400 },
  { rotulo: 'Abr', valor: 97_100 },
  { rotulo: 'Mai', valor: 112_600 },
  { rotulo: 'Jun', valor: 126_480 },
  { rotulo: 'Jul', valor: FATURAMENTO_MES, parcial: true },
]

/**
 * Vendas dos últimos 7 dias, terminando HOJE.
 *
 * O último ponto é `RESUMO.vendasHoje`, e não um número solto: o cartão mostra
 * "26 vendas hoje" logo acima. Série que não termina no número do cartão faz o
 * usuário achar que um dos dois está errado — e ele está certo em achar.
 */
export const VENDAS_7_DIAS = [
  { rotulo: 'Sex', valor: 34 },
  { rotulo: 'Sáb', valor: 41 },
  { rotulo: 'Dom', valor: 9 },
  { rotulo: 'Seg', valor: 29 },
  { rotulo: 'Ter', valor: 24 },
  { rotulo: 'Qua', valor: 21 },
  { rotulo: 'Hoje', valor: RESUMO.vendasHoje },
]

export const TOP_CLIENTES = CLIENTES.filter((c) => c.tipo !== 'Consumidor')
  .map((c, i) => ({
    nome: c.nome,
    valor: Math.round((18_400 - i * 1_180) * 100) / 100,
    cor: `var(--cat-${(i % 6) + 1})`,
  }))
  .slice(0, 5)

/* --------------------------------------------------------------- atividade */

export type TipoAtividade = 'venda' | 'vasilhame' | 'recebimento' | 'cliente' | 'perda'

export const ATIVIDADE: {
  id: string
  tipo: TipoAtividade
  titulo: string
  detalhe: string
  quando: string
}[] = [
  {
    id: 'a1',
    tipo: 'venda',
    titulo: 'Venda #1042 · Mercado Bom Preço',
    detalhe: '240 × Água 20L · R$ 1.584,00',
    quando: 'há 12 min',
  },
  {
    id: 'a2',
    tipo: 'vasilhame',
    titulo: 'Devolução de vasilhame',
    detalhe: '186 galões · Distribuidora Norte',
    quando: 'há 38 min',
  },
  {
    id: 'a3',
    tipo: 'perda',
    titulo: 'Baixa de vasilhame · quebrado',
    detalhe: '3 galões · custo R$ 114,00 · não entra como venda',
    quando: 'há 1 h',
  },
  {
    id: 'a4',
    tipo: 'recebimento',
    titulo: 'Recebimento em PIX',
    detalhe: 'Padaria Pão Quente · R$ 2.140,00',
    quando: 'há 2 h',
  },
  {
    id: 'a5',
    tipo: 'cliente',
    titulo: 'Novo cliente cadastrado',
    detalhe: 'Lanchonete do Zé · Setor Industrial',
    quando: 'há 3 h',
  },
  {
    id: 'a6',
    tipo: 'venda',
    titulo: 'Venda #1041 · balcão',
    detalhe: '1 × Gás P13 · R$ 110,00',
    quando: 'há 4 h',
  },
]
