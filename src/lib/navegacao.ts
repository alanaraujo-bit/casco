import {
  ArrowLeftRight,
  Boxes,
  Contact,
  FileBarChart,
  History,
  Landmark,
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
 * **O menu mostra só o que funciona.** Esta é a regra dura do arquivo. Cada item
 * em `NAVEGACAO` é uma tela que grava e lê de verdade; nada de rota que abre num
 * cartão "em construção". O sistema que a distribuidora recebe precisa parecer
 * pequeno e inteiro, não grande e oco — menu cheio de porta que não abre ensina,
 * na primeira semana, que não vale a pena clicar. E quem opera balcão o dia
 * inteiro aprende rápido a ignorar o que nunca serviu.
 *
 * O que ainda não existe fica em `PROXIMAS`, logo abaixo: mesma forma, mesmos
 * rótulos, fora da tela. Promover uma tela é mover uma linha de lá para cá —
 * e o critério para mover é o do roadmap: o fluxo real roda de ponta a ponta,
 * no desktop e no celular, com dado de verdade.
 *
 * **Os rótulos são os do sistema antigo, de propósito.** "Contas a Receber",
 * "PDV", "DRE", "Fluxo de Caixa Diário" — nenhum sinônimo, nenhuma melhoria de
 * nomenclatura. O usuário da JM já sabe operar um sistema; nosso trabalho não é
 * ensinar outro, é entregar o mesmo mapa mental bem executado. Ganhar discussão
 * de nomenclatura não vale perder a adoção.
 *
 * A exceção é o grupo Vasilhame, que não existe lá — e é o motivo da troca.
 */
export const NAVEGACAO: GrupoNav[] = [
  {
    rotulo: 'Painel',
    Icone: LayoutDashboard,
    itens: [{ rotulo: 'Painel Gerencial', href: '/painel' }],
  },
  {
    // Primeiro grupo do sistema deles, e o primeiro aqui: é onde a operadora
    // passa o dia. Orçamento e Comissão continuam em `PROXIMAS` — o PDV e a
    // listagem gravam de verdade, os outros dois ainda não existem.
    rotulo: 'Vendas',
    Icone: ShoppingCart,
    itens: [
      { rotulo: 'PDV', href: '/vendas/pdv' },
      { rotulo: 'Vendas de Produtos', href: '/vendas/produtos' },
    ],
  },
  {
    // Não existe no sistema antigo. É a razão pela qual a JM está trocando:
    // sem lugar para lançar galão quebrado, a operadora registra venda de
    // centavos e contamina o faturamento.
    //
    // Vem antes de Cadastro, e não na ordem do sistema deles, porque é a tela
    // que a operadora abre várias vezes por dia — enquanto cadastro se mexe uma
    // vez por semana. A regra da familiaridade fala sobre não renomear e não
    // reorganizar o que eles já conhecem; este grupo eles não conhecem de
    // lugar nenhum, então não há mapa mental a preservar aqui.
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
      { rotulo: 'Produtos', href: '/cadastro/produtos' },
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
      { rotulo: 'Caixa', href: '/financeiro/caixa' },
    ],
  },
  {
    // "Entradas" é o rótulo deles (`Control/WarehouseInputs`), e a tela faz
    // mais do que entrada — lança também ajuste, perda e devolução. Mantido
    // assim mesmo: é o nome que a operadora procura no menu, e "Movimentos de
    // Estoque" seria mais preciso e menos encontrável. O título dentro da tela
    // diz o que ela faz.
    rotulo: 'Estoque',
    Icone: Boxes,
    itens: [
      { rotulo: 'Saldo em Estoque', href: '/estoque/saldo' },
      { rotulo: 'Entradas', href: '/estoque/entradas' },
    ],
  },
]

/**
 * O que ainda não foi construído. **Não é renderizado em lugar nenhum.**
 *
 * Existe para que o mapa completo não se perca entre uma etapa e outra, e para
 * que promover uma tela seja recortar uma linha — sem reabrir a auditoria para
 * lembrar o rótulo exato que eles usam, que é justamente o detalhe que se perde.
 *
 * A ordem dos grupos aqui é a do sistema antigo: Vendas · Vasilhame · Cadastro ·
 * Financeiro · Estoque · Relatórios · Configurações.
 *
 * **Pendências a confirmar com o cliente** (ver `docs/00-auditoria-sistema-legado.md` §3):
 * - O legado tem 6 telas de NF-e. Ficam fora até confirmarmos se a JM emite nota.
 * - O legado tem "Serviços" em Vendas e Cadastro. A JM vende água, não serviço —
 *   confirmar se usam.
 * - O legado tem Agenda, Etiquetas e Analytics. Vieram vazios na auditoria;
 *   confirmar se são usados antes de construir.
 */
export const PROXIMAS: GrupoNav[] = [
  {
    rotulo: 'Vendas',
    Icone: ShoppingCart,
    itens: [
      { rotulo: 'Orçamento', href: '/vendas/orcamento' },
      { rotulo: 'Comissão', href: '/vendas/comissao' },
    ],
  },
  {
    rotulo: 'Financeiro',
    Icone: Wallet,
    itens: [{ rotulo: 'Despesas', href: '/financeiro/despesas' }],
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
  '/vasilhame/movimentos': History,
  '/cadastro/clientes': Users,
  '/cadastro/produtos': Package,
  '/financeiro/receber': Wallet,
  '/financeiro/caixa': Landmark,
  '/estoque/saldo': Boxes,
}

/**
 * Todos os itens visíveis, achatados — resolve a rota atual e, depois, a busca.
 *
 * Só `NAVEGACAO`, nunca `PROXIMAS`: é isto que faz uma rota não construída dar
 * 404 de verdade em vez de "em construção". Se o item não está no menu, digitar
 * a URL na mão não deve revelá-lo.
 */
export const TODOS_ITENS: (ItemNav & { grupo: string; Icone: LucideIcon })[] =
  NAVEGACAO.flatMap((g) =>
    g.itens.map((i) => ({ ...i, grupo: g.rotulo, Icone: ICONES_ITEM[i.href] ?? g.Icone })),
  )

export function acharItem(href: string) {
  return TODOS_ITENS.find((i) => i.href === href)
}
