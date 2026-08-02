import {
  ArrowLeftRight,
  Banknote,
  Boxes,
  CalendarDays,
  CalendarRange,
  Contact,
  CreditCard,
  FileBarChart,
  History,
  Landmark,
  LayoutDashboard,
  Package,
  PackagePlus,
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
 * **Os rótulos são os consagrados do setor, de propósito.** "Contas a Receber",
 * "PDV", "DRE", "Fluxo de Caixa Diário" — nenhum sinônimo, nenhuma melhoria de
 * nomenclatura. Quem opera uma distribuidora já tem esse mapa mental na cabeça;
 * nosso trabalho é executá-lo bem, não reensiná-lo. Ganhar discussão de
 * nomenclatura não vale perder a adoção.
 */
export const NAVEGACAO: GrupoNav[] = [
  {
    rotulo: 'Painel',
    Icone: LayoutDashboard,
    itens: [{ rotulo: 'Painel Gerencial', href: '/painel' }],
  },
  {
    // Primeiro grupo, porque é onde a operadora passa o dia.
    // Orçamento e Comissão continuam em `PROXIMAS` — o PDV e a
    // listagem gravam de verdade, os outros dois ainda não existem.
    rotulo: 'Vendas',
    Icone: ShoppingCart,
    itens: [
      { rotulo: 'PDV', href: '/vendas/pdv' },
      { rotulo: 'Vendas de Produtos', href: '/vendas/produtos' },
    ],
  },
  {
    // O grupo que define o produto: sem lugar para lançar galão quebrado, a
    // operadora acaba registrando venda de centavos e contaminando o
    // faturamento.
    //
    // Vem antes de Cadastro porque é tela que ela abre várias vezes por dia,
    // enquanto cadastro se mexe uma vez por semana. A regra da familiaridade
    // fala sobre não renomear e não reorganizar o que já é convenção do setor;
    // controle de comodato não tem convenção, então não há mapa mental a
    // preservar aqui.
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
      // Por último no grupo, e de propósito: é cadastro, mexe-se uma vez por
      // mês. As três de cima são o dia a dia.
      { rotulo: 'Contas e Formas', href: '/financeiro/contas' },
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
  {
    // Último grupo: é o que o dono abre uma vez por semana, e não a operadora
    // o dia inteiro.
    rotulo: 'Relatórios',
    Icone: FileBarChart,
    itens: [
      { rotulo: 'DRE', href: '/relatorios/dre' },
      { rotulo: 'Fluxo de Caixa Diário', href: '/relatorios/caixa-diario' },
      { rotulo: 'Fluxo de Caixa Mensal', href: '/relatorios/caixa-mensal' },
    ],
  },
]

/**
 * O que ainda não foi construído. **Não é renderizado em lugar nenhum.**
 *
 * Existe para que o mapa completo não se perca entre uma etapa e outra, e para
 * que promover uma tela seja recortar uma linha — com o rótulo exato já
 * decidido, que é justamente o detalhe que se perde.
 *
 * A ordem dos grupos: Vendas · Vasilhame · Cadastro · Financeiro · Estoque ·
 * Relatórios · Configurações.
 *
 * **Pendências a confirmar com o cliente** (ver `docs/` §3):
 * - NF-e são 6 telas. Ficam fora até confirmarmos se a JM emite nota.
 * - "Serviços" em Vendas e Cadastro: a JM vende água, não serviço — confirmar
 *   se usam.
 * - Agenda, Etiquetas e Analytics: confirmar se são usados antes de construir.
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
    itens: [{ rotulo: 'Conciliação Bancária', href: '/relatorios/conciliacao' }],
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
  '/financeiro/pagar': Banknote,
  '/financeiro/caixa': Landmark,
  '/financeiro/contas': CreditCard,
  '/estoque/saldo': Boxes,
  '/estoque/entradas': PackagePlus,
  '/relatorios/dre': FileBarChart,
  '/relatorios/caixa-diario': CalendarDays,
  '/relatorios/caixa-mensal': CalendarRange,
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
