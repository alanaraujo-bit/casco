import {
  ArrowLeftRight,
  Boxes,
  ClipboardList,
  Contact,
  FileBarChart,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'

export type ItemNav = {
  rotulo: string
  href: string
}

export type GrupoNav = {
  rotulo: string
  Icone: LucideIcon
  itens: ItemNav[]
}

/**
 * A navegação inteira, em um lugar só.
 *
 * **Os rótulos são os do sistema antigo, de propósito.** "Contas a Receber",
 * "PDV", "DRE", "Fluxo de Caixa Diário", "Conciliação Bancária" — nenhum
 * sinônimo, nenhuma melhoria de nomenclatura. O usuário da LM já sabe operar
 * um sistema; nosso trabalho não é ensinar outro, é entregar o mesmo mapa
 * mental bem executado. Ganhar discussão de nomenclatura não vale perder a
 * adoção.
 *
 * A exceção é o grupo Vasilhame, que não existe lá — e é o motivo da troca.
 *
 * **Pendências a confirmar com o cliente** (ver `docs/00-auditoria-sistema-legado.md` §3):
 * - O legado tem 6 telas de NF-e. Ficam fora até confirmarmos se a LM emite nota.
 * - O legado tem "Serviços" em Vendas e Cadastro. A LM vende água, não serviço —
 *   confirmar se usam.
 * - O legado tem Agenda, Etiquetas e Analytics. Vieram vazios na auditoria;
 *   confirmar se são usados antes de construir.
 */
export const NAVEGACAO: GrupoNav[] = [
  {
    rotulo: 'Painel',
    Icone: LayoutDashboard,
    itens: [{ rotulo: 'Painel Gerencial', href: '/painel' }],
  },
  {
    rotulo: 'Vendas',
    Icone: ShoppingCart,
    itens: [
      { rotulo: 'PDV', href: '/vendas/pdv' },
      { rotulo: 'Vendas de Produtos', href: '/vendas/produtos' },
      { rotulo: 'Orçamento', href: '/vendas/orcamento' },
      { rotulo: 'Comissão', href: '/vendas/comissao' },
    ],
  },
  {
    // Não existe no sistema antigo. É a razão pela qual a LM está trocando:
    // sem lugar para lançar galão quebrado, a operadora registra venda de
    // centavos e contamina o faturamento.
    rotulo: 'Vasilhame',
    Icone: Truck,
    itens: [
      { rotulo: 'Baixa de Vasilhame', href: '/vasilhame/baixa' },
      { rotulo: 'Saldo por Cliente', href: '/vasilhame/saldos' },
      { rotulo: 'Movimentos', href: '/vasilhame/movimentos' },
    ],
  },
  {
    rotulo: 'Cadastro',
    Icone: Contact,
    itens: [
      { rotulo: 'Clientes', href: '/cadastro/clientes' },
      { rotulo: 'Produtos e Serviços', href: '/cadastro/produtos' },
      { rotulo: 'Fornecedores', href: '/cadastro/fornecedores' },
      { rotulo: 'Tabelas de Preço', href: '/cadastro/tabelas-preco' },
    ],
  },
  {
    rotulo: 'Financeiro',
    Icone: Wallet,
    itens: [
      { rotulo: 'Contas a Receber', href: '/financeiro/receber' },
      { rotulo: 'Contas a Pagar', href: '/financeiro/pagar' },
      { rotulo: 'Despesas', href: '/financeiro/despesas' },
      { rotulo: 'Caixa', href: '/financeiro/caixa' },
    ],
  },
  {
    rotulo: 'Estoque',
    Icone: Boxes,
    itens: [
      { rotulo: 'Saldo em Estoque', href: '/estoque/saldo' },
      { rotulo: 'Entradas', href: '/estoque/entradas' },
    ],
  },
  {
    rotulo: 'Relatórios',
    Icone: FileBarChart,
    itens: [
      { rotulo: 'DRE', href: '/relatorios/dre' },
      { rotulo: 'Fluxo de Caixa Diário', href: '/relatorios/caixa-diario' },
      { rotulo: 'Fluxo de Caixa Mensal', href: '/relatorios/caixa-mensal' },
      { rotulo: 'Conciliação Bancária', href: '/relatorios/conciliacao' },
    ],
  },
  {
    rotulo: 'Configurações',
    Icone: Settings,
    itens: [
      { rotulo: 'Empresa', href: '/config/empresa' },
      { rotulo: 'Usuários', href: '/config/usuarios' },
    ],
  },
]

/** Ícone específico de alguns itens; o resto herda o ícone do grupo. */
export const ICONES_ITEM: Record<string, LucideIcon> = {
  '/vendas/pdv': ShoppingCart,
  '/vendas/produtos': Receipt,
  '/vasilhame/baixa': ArrowLeftRight,
  '/vasilhame/saldos': Truck,
  '/cadastro/clientes': Users,
  '/cadastro/produtos': Package,
  '/financeiro/receber': Wallet,
  '/estoque/saldo': Boxes,
  '/relatorios/dre': ClipboardList,
}

/** Todos os itens achatados — para resolver a rota atual e, depois, para busca. */
export const TODOS_ITENS: (ItemNav & { grupo: string; Icone: LucideIcon })[] =
  NAVEGACAO.flatMap((g) =>
    g.itens.map((i) => ({ ...i, grupo: g.rotulo, Icone: ICONES_ITEM[i.href] ?? g.Icone })),
  )

export function acharItem(href: string) {
  return TODOS_ITENS.find((i) => i.href === href)
}
