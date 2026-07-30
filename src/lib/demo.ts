/**
 * Dados de demonstração.
 *
 * Existem para que o cliente veja o sistema com cara de sistema em uso, e não
 * uma tela vazia com "nenhum registro". Os números seguem a ordem de grandeza
 * real levantada na auditoria do Fature Gestão (faturamento anual na casa dos
 * R$ 86 mil, 111 lançamentos em Contas a Receber, 106 vendas, ~30 clientes de
 * revenda) — mas **nomes, documentos e endereços são inventados**. Nada de
 * dado real de cliente entra no repositório.
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
  vencimento: string
  situacao: 'Recebido' | 'Em aberto' | 'Vencido'
  banco: string
  formaPagamento: string
  dataPagamento: string | null
  valorPago: number | null
}

/* ----------------------------------------------------------------- resumo */

export const RESUMO = {
  faturamentoMes: 12_480.5,
  faturamentoMesAnterior: 11_218.0,
  vendasHoje: 38,
  vendasHojeAnterior: 31,
  aReceber: 8_940.75,
  vencido: 1_284.3,
  vencidoQtd: 7,
  clientesAtivos: 34,
  clientesNovosMes: 3,
  ticketMedio: 41.6,
  ticketMedioAnterior: 43.1,
}

export const FATURAMENTO_MENSAL = [
  { rotulo: 'Ago', valor: 6_140 },
  { rotulo: 'Set', valor: 6_890 },
  { rotulo: 'Out', valor: 7_420 },
  { rotulo: 'Nov', valor: 8_180 },
  { rotulo: 'Dez', valor: 9_930 },
  { rotulo: 'Jan', valor: 8_260 },
  { rotulo: 'Fev', valor: 7_910 },
  { rotulo: 'Mar', valor: 9_040 },
  { rotulo: 'Abr', valor: 9_480 },
  { rotulo: 'Mai', valor: 10_620 },
  { rotulo: 'Jun', valor: 11_218 },
  { rotulo: 'Jul', valor: 12_480 },
]

export const ENTREGAS_SEMANA = [
  { rotulo: 'Seg', valor: 42 },
  { rotulo: 'Ter', valor: 38 },
  { rotulo: 'Qua', valor: 51 },
  { rotulo: 'Qui', valor: 47 },
  { rotulo: 'Sex', valor: 63 },
  { rotulo: 'Sáb', valor: 71 },
  { rotulo: 'Dom', valor: 18 },
]

/* -------------------------------------------------------------- vasilhame */

export const VASILHAME = {
  emPoderDeClientes: 412,
  noDeposito: 168,
  naFabrica: 60,
  /** Quebrados/perdidos no mês. É o número que hoje some dentro do sistema. */
  perdasMes: 9,
  perdasMesAnterior: 14,
  /** Prejuízo das perdas, ao custo de reposição do vasilhame. */
  custoPerdasMes: 342.0,
}

export const MOTIVOS_PERDA = [
  { rotulo: 'Quebrado na entrega', valor: 4, cor: 'var(--cat-6)' },
  { rotulo: 'Trincado', valor: 3, cor: 'var(--cat-5)' },
  { rotulo: 'Não devolvido', valor: 2, cor: 'var(--cat-3)' },
]

/* ---------------------------------------------------------------- produtos */

export const MIX_PRODUTOS = [
  { rotulo: 'Água 20L retornável', valor: 7_842, cor: 'var(--cat-1)' },
  { rotulo: 'Gás P13', valor: 2_610, cor: 'var(--cat-2)' },
  { rotulo: 'Água 10L retornável', valor: 1_120, cor: 'var(--cat-4)' },
  { rotulo: 'Fardo 500ml', valor: 618, cor: 'var(--cat-5)' },
  { rotulo: 'Gás P45', valor: 290, cor: 'var(--cat-3)' },
]

export const TOP_CLIENTES = [
  { nome: 'Mercado Bom Preço', valor: 1_842.0, cor: 'var(--cat-1)' },
  { nome: 'Restaurante Sabor da Terra', valor: 1_265.5, cor: 'var(--cat-2)' },
  { nome: 'Padaria Pão Quente', valor: 980.0, cor: 'var(--cat-4)' },
  { nome: 'Depósito Central', valor: 874.0, cor: 'var(--cat-5)' },
  { nome: 'Hotel Xingu', valor: 712.0, cor: 'var(--cat-3)' },
]

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
    detalhe: '24 × Água 20L · R$ 288,00',
    quando: 'há 12 min',
  },
  {
    id: 'a2',
    tipo: 'vasilhame',
    titulo: 'Devolução de vasilhame',
    detalhe: '18 galões · Restaurante Sabor da Terra',
    quando: 'há 38 min',
  },
  {
    id: 'a3',
    tipo: 'perda',
    titulo: 'Baixa de vasilhame · quebrado',
    detalhe: '2 galões · custo R$ 76,00 · não é venda',
    quando: 'há 1 h',
  },
  {
    id: 'a4',
    tipo: 'recebimento',
    titulo: 'Recebimento em dinheiro',
    detalhe: 'Padaria Pão Quente · R$ 420,00',
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
    titulo: 'Venda #1041 · consumidor',
    detalhe: '1 × Gás P13 · R$ 110,00',
    quando: 'há 4 h',
  },
]

/* ---------------------------------------------------------------- clientes */

const bairros = [
  'Centro',
  'Setor Industrial',
  'Vila Nova',
  'Jardim Paraíso',
  'Bela Vista',
  'Novo Horizonte',
]

const nomes: [string, ClienteDemo['tipo']][] = [
  ['Mercado Bom Preço', 'Mercado'],
  ['Restaurante Sabor da Terra', 'Restaurante'],
  ['Padaria Pão Quente', 'Mercado'],
  ['Depósito Central', 'Revenda'],
  ['Hotel Xingu', 'Restaurante'],
  ['Mercadinho São José', 'Mercado'],
  ['Lanchonete do Zé', 'Restaurante'],
  ['Distribuidora Norte', 'Revenda'],
  ['Supermercado Família', 'Mercado'],
  ['Pizzaria Forno a Lenha', 'Restaurante'],
  ['Conveniência 24h', 'Mercado'],
  ['Açaí do Parque', 'Restaurante'],
  ['Maria Aparecida Souza', 'Consumidor'],
  ['João Batista Lima', 'Consumidor'],
  ['Ana Cláudia Ferreira', 'Consumidor'],
  ['Oficina do Pedro', 'Revenda'],
  ['Escola Pequeno Príncipe', 'Restaurante'],
  ['Farmácia Vida', 'Mercado'],
  ['Borracharia do Tião', 'Revenda'],
  ['Sorveteria Gelo Bom', 'Restaurante'],
  ['Raimundo Nonato Silva', 'Consumidor'],
  ['Mercearia da Esquina', 'Mercado'],
  ['Pousada Beira-Rio', 'Restaurante'],
  ['Antônia Barbosa', 'Consumidor'],
]

export const CLIENTES: ClienteDemo[] = nomes.map(([nome, tipo], i) => ({
  id: `c${i + 1}`,
  nome,
  tipo,
  documento:
    tipo === 'Consumidor'
      ? `${300 + i}.${100 + i}.${200 + i}-0${i % 10}`
      : `1${i}.${400 + i}.${500 + i}/0001-${10 + (i % 80)}`,
  telefone: `(94) 9${8000 + i * 37}-${1000 + i * 53}`.slice(0, 15),
  bairro: bairros[i % bairros.length],
  cidade: i % 7 === 0 ? 'Ourilândia do Norte' : 'Tucumã',
  vasilhames: tipo === 'Consumidor' ? (i % 3) + 1 : ((i * 7) % 38) + 4,
  ultimaCompra: `${String((i % 28) + 1).padStart(2, '0')}/07/2026`,
  saldoDevedor: tipo === 'Consumidor' ? 0 : Math.round(((i * 137) % 900) * 100) / 100,
}))

/* --------------------------------------------------------- contas a receber */

const formas = ['Dinheiro', 'PIX', 'Cartão Débito', 'Boleto', 'Prazo 30 dias']
const bancos = ['Caixa Loja', 'Banco do Brasil', 'PIX Sicoob', 'Bradesco']

export const CONTAS_RECEBER: ContaDemo[] = Array.from({ length: 46 }, (_, i) => {
  const cliente = CLIENTES[i % CLIENTES.length]
  const total = Math.round((((i * 91) % 1400) + 60) * 100) / 100
  const parcelas = (i % 3) + 1
  const situacao: ContaDemo['situacao'] =
    i % 7 === 3 ? 'Vencido' : i % 2 === 0 ? 'Recebido' : 'Em aberto'
  const dia = String((i % 28) + 1).padStart(2, '0')
  return {
    id: `r${i + 1}`,
    origem: i % 5 === 0 ? 'PDV' : 'Venda de Produtos',
    codigo: String(1000 + i),
    cliente: cliente.nome,
    emissao: `${dia}/07/2026`,
    valorTotal: total,
    parcela: `${(i % parcelas) + 1}/${parcelas}`,
    vencimento: `${dia}/08/2026`,
    situacao,
    banco: bancos[i % bancos.length],
    formaPagamento: formas[i % formas.length],
    dataPagamento: situacao === 'Recebido' ? `${dia}/07/2026` : null,
    valorPago: situacao === 'Recebido' ? total : null,
  }
})
