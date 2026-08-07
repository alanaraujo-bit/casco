import type { ComponentType } from 'react'
import type { LucideIcon } from 'lucide-react'
import { NAVEGACAO } from '@/lib/navegacao'
import { ArtigoBaixaVasilhame } from '@/components/ajuda/artigos/baixa-vasilhame'
import { ArtigoSaldoVasilhame } from '@/components/ajuda/artigos/saldo-vasilhame'
import { ArtigoMovimentosVasilhame } from '@/components/ajuda/artigos/movimentos-vasilhame'
import { ArtigoPdv } from '@/components/ajuda/artigos/pdv'
import { ArtigoAberturaCaixa } from '@/components/ajuda/artigos/abertura-caixa'
import { ArtigoVendasProdutos } from '@/components/ajuda/artigos/vendas-produtos'
import { ArtigoAtualizacoes } from '@/components/ajuda/artigos/atualizacoes'
import { ArtigoCadastroProdutos } from '@/components/ajuda/artigos/cadastro-produtos'
import { ArtigoDesempenhoEntregadores } from '@/components/ajuda/artigos/desempenho-entregadores'

/**
 * O índice da Central de Ajuda — espelha o papel de `NAVEGACAO` em
 * `src/lib/navegacao.ts`, mas para conteúdo em vez de rota de negócio.
 *
 * **Regra dura, igual à do menu:** só entra aqui o que está escrito de
 * verdade. Não existe artigo "em construção" — um grupo sem artigo aparece na
 * Central como "em breve", nunca como link que abre vazio.
 *
 * `AGENTS.md` tem a instrução permanente: toda tela nova concluída pergunta
 * se muda o que a operadora vê ou faz, e se sim, ganha uma entrada aqui antes
 * da etapa contar como pronta.
 */
export type GrupoSlug =
  | 'painel'
  | 'vendas'
  | 'vasilhame'
  | 'cadastro'
  | 'financeiro'
  | 'estoque'
  | 'relatorios'
  | 'atualizacoes'

export type ArtigoAjuda = {
  slug: string
  grupoSlug: GrupoSlug
  titulo: string
  /** Aparece no card da listagem e na busca — uma frase, sem ponto final. */
  resumo: string
  /** Termos que a busca considera além do título e do resumo. */
  palavrasChave: string[]
  Componente: ComponentType
}

export type GrupoAjuda = {
  slug: GrupoSlug
  /** O mesmo rótulo do menu — é o vocabulário que a operadora já procura. */
  rotulo: string
  Icone: LucideIcon
}

const ICONE_POR_GRUPO = new Map(NAVEGACAO.map((g) => [g.rotulo, g.Icone]))
const ICONE_PADRAO = NAVEGACAO[0].Icone

function grupo(slug: GrupoSlug, rotulo: string): GrupoAjuda {
  return { slug, rotulo, Icone: ICONE_POR_GRUPO.get(rotulo) ?? ICONE_PADRAO }
}

/**
 * Os sete grupos do sistema, na mesma ordem do menu. Todos aparecem na
 * Central — os que ainda não têm artigo mostram "em breve" em vez de sumir,
 * para a operadora saber que a ajuda daquela área está a caminho e não que
 * ela procurou no lugar errado.
 */
export const GRUPOS_AJUDA: GrupoAjuda[] = [
  grupo('painel', 'Painel'),
  grupo('vendas', 'Vendas'),
  grupo('vasilhame', 'Vasilhame'),
  grupo('cadastro', 'Cadastro'),
  grupo('financeiro', 'Financeiro'),
  grupo('estoque', 'Estoque'),
  grupo('relatorios', 'Relatórios'),
  grupo('atualizacoes', 'Atualizações'),
]

/**
 * O piloto (Vasilhame) validou o formato; agora os grupos entram um de cada
 * vez, na ordem em que a operadora mais usa o sistema. Vendas é o segundo,
 * por ser a tela que ela abre mais vezes por dia.
 */
export const ARTIGOS_AJUDA: ArtigoAjuda[] = [
  {
    slug: 'pdv',
    grupoSlug: 'vendas',
    titulo: 'PDV',
    resumo: 'Fechar uma venda de balcão — dinheiro, cartão ou a prazo, com o vasilhame junto',
    palavrasChave: ['pdv', 'balcão', 'venda', 'caixa', 'troco', 'desconto', 'carrinho', 'forma de pagamento', 'entregador', 'entrega'],
    Componente: ArtigoPdv,
  },
  {
    slug: 'vendas-produtos',
    grupoSlug: 'vendas',
    titulo: 'Vendas de Produtos',
    resumo: 'Tudo que foi vendido — o que entrou no caixa, o que ficou a receber e a taxa da maquininha',
    palavrasChave: ['vendas', 'listagem', 'vendido', 'ticket médio', 'taxas', 'a receber'],
    Componente: ArtigoVendasProdutos,
  },
  {
    slug: 'cadastro-produtos',
    grupoSlug: 'cadastro',
    titulo: 'Cadastro de Produtos',
    resumo: 'Nome, preço, custo, estoque, ícone e vasilhame de cada produto que a distribuidora vende',
    palavrasChave: ['produto', 'sku', 'código', 'categoria', 'ícone', 'preço', 'custo', 'estoque mínimo', 'estoque máximo', 'estoque inicial', 'retornável', 'vasilhame', 'ncm'],
    Componente: ArtigoCadastroProdutos,
  },
  {
    slug: 'desempenho-entregadores',
    grupoSlug: 'relatorios',
    titulo: 'Desempenho dos Entregadores',
    resumo: 'Quem entregou mais na semana, quanta água saiu e quanto vasilhame voltou junto',
    palavrasChave: ['entregador', 'entrega', 'ranking', 'desempenho', 'rota', 'semana', 'ticket médio', 'produtividade', 'quem entregou'],
    Componente: ArtigoDesempenhoEntregadores,
  },
  {
    slug: 'baixa-vasilhame',
    grupoSlug: 'vasilhame',
    titulo: 'Baixa de Vasilhame',
    resumo: 'Como lançar entrega, devolução, quebra e perda de vasilhame — sem virar venda',
    palavrasChave: ['baixa', 'quebrado', 'trincado', 'perdido', 'comodato', 'motivo', 'devolução'],
    Componente: ArtigoBaixaVasilhame,
  },
  {
    slug: 'saldo-vasilhame',
    grupoSlug: 'vasilhame',
    titulo: 'Saldo por Cliente',
    resumo: 'Quem está com vasilhame nosso, quantos galões na rua, e quem mais deve',
    palavrasChave: ['saldo', 'na rua', 'devendo', 'extrato', 'maiores devedores'],
    Componente: ArtigoSaldoVasilhame,
  },
  {
    slug: 'movimentos-vasilhame',
    grupoSlug: 'vasilhame',
    titulo: 'Movimentos e Estorno',
    resumo: 'O razão completo de vasilhame, a perda do mês, e como corrigir um lançamento errado',
    palavrasChave: ['movimentos', 'estorno', 'estornar', 'perda', 'extrato', 'histórico'],
    Componente: ArtigoMovimentosVasilhame,
  },
  {
    slug: 'abertura-caixa',
    grupoSlug: 'financeiro',
    titulo: 'Abertura de Caixa',
    resumo: 'Quanto tem na gaveta ao abrir o turno, e quanto disso é fundo de troco',
    palavrasChave: ['abertura', 'caixa', 'troco', 'fundo de troco', 'turno', 'gaveta'],
    Componente: ArtigoAberturaCaixa,
  },
  {
    slug: 'central-de-atualizacoes',
    grupoSlug: 'atualizacoes',
    titulo: 'Central de Atualizações',
    resumo: 'O que mudou no Casco, com curtir/não curtir e o contador do que falta ler',
    palavrasChave: ['atualizações', 'novidades', 'patch notes', 'curtir', 'não lido', 'changelog'],
    Componente: ArtigoAtualizacoes,
  },
]

export function artigosDoGrupo(grupoSlug: GrupoSlug): ArtigoAjuda[] {
  return ARTIGOS_AJUDA.filter((a) => a.grupoSlug === grupoSlug)
}

export function acharArtigo(grupoSlug: string, artigoSlug: string): ArtigoAjuda | undefined {
  return ARTIGOS_AJUDA.find((a) => a.grupoSlug === grupoSlug && a.slug === artigoSlug)
}

/**
 * A mesma lista, sem `Componente` — é o que o campo de busca (componente de
 * cliente) importa. Levar `ARTIGOS_AJUDA` inteiro para o cliente arrastaria o
 * código dos artigos junto no bundle só para comparar título com o que foi
 * digitado.
 */
export type ArtigoBusca = Omit<ArtigoAjuda, 'Componente'>

export const ARTIGOS_BUSCA: ArtigoBusca[] = ARTIGOS_AJUDA.map((a) => ({
  slug: a.slug,
  grupoSlug: a.grupoSlug,
  titulo: a.titulo,
  resumo: a.resumo,
  palavrasChave: a.palavrasChave,
}))

/** Busca simples: título, resumo e palavras-chave, sem diferenciar acento nem caixa. */
const MARCAS_DIACRITICAS = /[̀-ͯ]/g

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(MARCAS_DIACRITICAS, '').toLowerCase()
}

export function buscarArtigos<T extends ArtigoBusca>(consulta: string, lista: T[]): T[] {
  const termo = normalizar(consulta.trim())
  if (!termo) return lista
  return lista.filter((a) => {
    const alvo = normalizar([a.titulo, a.resumo, ...a.palavrasChave].join(' '))
    return alvo.includes(termo)
  })
}
