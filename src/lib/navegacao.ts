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
  /** Ainda não construída — a navegação mostra a tela de "em construção". */
  emBreve?: boolean
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
 */
export const NAVEGACAO: GrupoNav[] = [
  {
    rotulo: 'Painel',
    Icone: LayoutDashboard,
    itens: [{ rotulo: 'Painel Gerencial', href: '/painel', emBreve: true }],
  },
  {
    rotulo: 'Vendas',
    Icone: ShoppingCart,
    itens: [
      { rotulo: 'PDV', href: '/vendas/pdv', emBreve: true },
      { rotulo: 'Vendas de Produtos', href: '/vendas/produtos', emBreve: true },
      { rotulo: 'Orçamento', href: '/vendas/orcamento', emBreve: true },
      { rotulo: 'Comissão', href: '/vendas/comissao', emBreve: true },
    ],
  },
  {
    // Não existe no sistema antigo. É a razão pela qual a LM está trocando:
    // sem lugar para lançar galão quebrado, a operadora registra venda de
    // centavos e contamina o faturamento.
    rotulo: 'Vasilhame',
    Icone: Truck,
    itens: [
      { rotulo: 'Baixa de Vasilhame', href: '/vasilhame/baixa', emBreve: true },
      { rotulo: 'Saldo por Cliente', href: '/vasilhame/saldos', emBreve: true },
      { rotulo: 'Movimentos', href: '/vasilhame/movimentos', emBreve: true },
    ],
  },
  {
    rotulo: 'Cadastro',
    Icone: Contact,
    itens: [
      { rotulo: 'Clientes', href: '/cadastro/clientes', emBreve: true },
      { rotulo: 'Produtos e Serviços', href: '/cadastro/produtos', emBreve: true },
      { rotulo: 'Fornecedores', href: '/cadastro/fornecedores', emBreve: true },
      { rotulo: 'Tabelas de Preço', href: '/cadastro/tabelas-preco', emBreve: true },
    ],
  },
  {
    rotulo: 'Financeiro',
    Icone: Wallet,
    itens: [
      { rotulo: 'Contas a Receber', href: '/financeiro/receber', emBreve: true },
      { rotulo: 'Contas a Pagar', href: '/financeiro/pagar', emBreve: true },
      { rotulo: 'Despesas', href: '/financeiro/despesas', emBreve: true },
      { rotulo: 'Caixa', href: '/financeiro/caixa', emBreve: true },
    ],
  },
  {
    rotulo: 'Estoque',
    Icone: Boxes,
    itens: [
      { rotulo: 'Saldo em Estoque', href: '/estoque/saldo', emBreve: true },
      { rotulo: 'Entradas', href: '/estoque/entradas', emBreve: true },
    ],
  },
  {
    rotulo: 'Relatórios',
    Icone: FileBarChart,
    itens: [
      { rotulo: 'DRE', href: '/relatorios/dre', emBreve: true },
      { rotulo: 'Fluxo de Caixa Diário', href: '/relatorios/caixa-diario', emBreve: true },
      { rotulo: 'Fluxo de Caixa Mensal', href: '/relatorios/caixa-mensal', emBreve: true },
      {
        rotulo: 'Conciliação Bancária',
        href: '/relatorios/conciliacao',
        emBreve: true,
      },
    ],
  },
  {
    rotulo: 'Configurações',
    Icone: Settings,
    itens: [
      { rotulo: 'Empresa', href: '/config/empresa', emBreve: true },
      { rotulo: 'Usuários', href: '/config/usuarios', emBreve: true },
    ],
  },
]

/** Ícones por item, usados na busca rápida e no cabeçalho da página. */
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

/** Todos os itens achatados — para busca e para resolver a rota atual. */
export const TODOS_ITENS: (ItemNav & { grupo: string; Icone: LucideIcon })[] =
  NAVEGACAO.flatMap((g) =>
    g.itens.map((i) => ({ ...i, grupo: g.rotulo, Icone: ICONES_ITEM[i.href] ?? g.Icone })),
  )

export function acharItem(href: string) {
  return TODOS_ITENS.find((i) => i.href === href)
}
