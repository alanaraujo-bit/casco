'use client'

import { AvisoErro } from '@/components/ui/aviso-erro'
import { useActionState, useEffect, useMemo, useRef, useState } from 'react'
import { useFormStatus } from 'react-dom'
import Link from 'next/link'
import {
  Check,
  CircleAlert,
  Minus,
  Package,
  Plus,
  Printer,
  Receipt,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  Wallet,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn, moeda } from '@/lib/utils'
import { avisarMudanca } from '@/lib/sincronizar'
import { centavos, deCentavos, paraNumero, type EstadoVenda } from '@/modules/vendas/esquema'
import { caminhoIconeProduto } from '@/modules/produtos/icones'
import { caminhoIconeDinheiro } from '@/modules/financeiro/icones-dinheiro'
import type { FormaPagamentoOpcao } from '@/modules/financeiro/consultas'
import type { TipoPagamento } from '@/db/schema'
import type {
  ClienteVenda,
  EntregadorVenda,
  PrecoTabela,
  ProdutoVenda,
} from '@/modules/vendas/consultas'

type Props = {
  acao: (anterior: EstadoVenda, form: FormData) => Promise<EstadoVenda>
  produtos: ProdutoVenda[]
  precos: PrecoTabela[]
  clientes: ClienteVenda[]
  entregadores: EntregadorVenda[]
  formas: FormaPagamentoOpcao[]
  tabelaPadraoId: string | null
  /** Escopa o rascunho salvo no navegador — ver a nota em `chaveRascunho`. */
  companyId: string
}

interface LinhaCarrinho {
  produtoId: string
  quantidade: number
  vasilhameDevolvido: number
}

/** Cédulas e moedas do Real que `quebrarTroco` conhece, da maior para a menor. */
const VALORES_TROCO = [20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 25, 10, 5] as const

/**
 * Quebra um valor em centavos nas cédulas e moedas do Real, maior para menor
 * — a mesma conta que a operadora faz de cabeça ao separar o troco na
 * gaveta, só que sem a chance de errar por contar rápido demais.
 */
function quebrarTroco(centavosTotal: number) {
  let resto = Math.round(centavosTotal)
  const partes: { centavos: number; quantidade: number }[] = []
  for (const valor of VALORES_TROCO) {
    const quantidade = Math.floor(resto / valor)
    if (quantidade > 0) {
      partes.push({ centavos: valor, quantidade })
      resto -= quantidade * valor
    }
  }
  return partes
}

/**
 * O troco em cédulas e moedas — não só o número.
 *
 * Existe porque "R$ 14,00 de troco" ainda deixa a operadora contando na
 * cabeça quais notas separar. Aqui a conta já vem feita: a foto de cada
 * cédula/moeda aparece uma vez, com a quantidade necessária no canto — a
 * mesma biblioteca de ícones prontos do cadastro de produto (ver
 * `caminhoIconeDinheiro`), não uma cor ou um texto tentando parecer dinheiro.
 *
 * Só a altura é fixa (`h-14`): nota real é retangular (~2,1:1) e moeda é
 * quadrada, e uma largura também fixa espremeria a nota numa caixa redonda
 * que não é a forma dela. A largura acompanha a proporção de cada arquivo em
 * `public/icones-dinheiro/`.
 */
function QuebraDeTroco({ centavos }: { centavos: number }) {
  const partes = useMemo(() => quebrarTroco(centavos), [centavos])
  if (partes.length === 0) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" aria-label="Cédulas e moedas para o troco">
      {partes.map((p) => (
        <div key={p.centavos} className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={caminhoIconeDinheiro(p.centavos)!}
            alt={moeda(deCentavos(p.centavos))}
            className="h-14 w-auto shrink-0 drop-shadow-sm"
          />
          <span className="absolute -right-1.5 -top-1.5 grid size-5 place-items-center rounded-full bg-zinc-900 text-2xs font-bold text-white shadow-sm">
            {p.quantidade}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * As teclas dos nove primeiros produtos da grade, na ordem em que aparecem.
 *
 * `F1`–`F12` foi a primeira tentativa e não sobreviveu ao Chrome: metade
 * delas é atalho do próprio navegador antes de chegar à página —
 * `F5`/`F6` recarregam ou saltam para a barra de endereço, `F11` alterna a
 * tela cheia do SISTEMA (não a nossa, que é outro botão), `F12` abre as
 * ferramentas de desenvolvedor — e `preventDefault()` não segura nenhuma
 * delas, porque são tratadas antes do JavaScript da página rodar. O teclado
 * numérico não tem esse problema: nenhum navegador reserva `1`–`9` sozinhos
 * (só combinados com Ctrl, que o atalho abaixo ignora de propósito).
 */
const ATALHOS_PRODUTO = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const
/** Fecha a venda. Fora da faixa de produtos, para nunca disputar com um deles. */
const ATALHO_FECHAR = '0'

/**
 * Troca a forma de pagamento sem tocar no mouse — só as duas que decidem
 * sozinhas, sem exigir escolher máquina/bandeira: dinheiro e Pix são a
 * decisão inteira do cliente falando "vou pagar em...", então valem o atalho
 * de uma letra. Débito e crédito no balcão ainda dependem de qual forma
 * cadastrada bate com a maquininha física, e isso a operadora escolhe olhando
 * a lista — atalho ali adivinharia errado.
 */
const ATALHOS_FORMA: Partial<Record<TipoPagamento, string>> = { dinheiro: 'd', pix: 'p' }

/** O que sobrevive a um recarregamento de página ou uma troca de aba. */
interface RascunhoVenda {
  carrinho: LinhaCarrinho[]
  clienteId: string
  entregadorId: string
  formaId: string
  desconto: string
  descontoModo: 'reais' | 'percentual'
  parcelas: string
  valorRecebido: string
  observacao: string
}

/**
 * O PDV.
 *
 * Três decisões carregam a tela inteira:
 *
 * **O carrinho é uma lista, não um formulário.** A operadora clica no produto e
 * ele entra; clicar de novo soma um. Não existe "adicionar item" com quantidade,
 * preço e botão confirmar — esse é o desenho que faz uma venda de três vasilhames
 * levar nove cliques.
 *
 * **O preço aparece, mas quem decide é o servidor.** A tela resolve a tabela do
 * cliente para mostrar o valor certo na hora; o total gravado é recalculado no
 * `fecharVenda`. Se os dois discordarem, o banco vence — e a diferença nunca
 * chega a existir, porque as duas leem a mesma tabela de preço.
 *
 * **Vasilhame vive dentro do item.** Ao vender um produto retornável, aparece
 * na linha um contador de "vasilhames que ele trouxe". É o momento em que a pergunta
 * é feita de verdade no balcão — e é a única forma de o comodato não depender de
 * alguém lembrar de abrir outra tela depois que o cliente já foi embora.
 */
export function Pdv({
  acao,
  produtos,
  precos,
  clientes,
  entregadores,
  formas,
  tabelaPadraoId,
  companyId,
}: Props) {
  const [estado, enviar] = useActionState<EstadoVenda, FormData>(acao, {})

  /**
   * A chave leva o `companyId` porque este é o rascunho que a `FaixaAdmin`
   * existe para proteger: suporte com duas empresas abertas no mesmo
   * navegador não pode ver o carrinho de uma vazar para dentro da outra ao
   * trocar de aba. `localStorage` (e não `sessionStorage`) porque a queixa
   * era justamente essa — fechar o navegador não pode ser a mesma coisa que
   * cancelar a venda.
   */
  const chaveRascunho = `casco:pdv:rascunho:${companyId}`

  const [carrinho, setCarrinho] = useState<LinhaCarrinho[]>([])
  const [clienteId, setClienteId] = useState('')
  const [entregadorId, setEntregadorId] = useState('')
  const [formaId, setFormaId] = useState(
    formas.find((f) => f.tipo === 'dinheiro')?.id ?? formas[0]?.id ?? '',
  )
  const [desconto, setDesconto] = useState('')
  /**
   * Em que unidade a operadora está digitando o desconto.
   *
   * O servidor não sabe disso e não precisa: `esquemaVenda` só aceita
   * `desconto` em reais, então a conversão acontece aqui e o campo enviado
   * (`descontoInput`, abaixo) sempre carrega o valor já convertido. Guardar o
   * modo do lado do cliente é o que permite a operadora alternar sem perder o
   * número — ela decide se pensa em "R$ 5" ou em "10%", a venda não muda.
   */
  const [descontoModo, setDescontoModo] = useState<'reais' | 'percentual'>('reais')
  const [parcelas, setParcelas] = useState('1')
  const [valorRecebido, setValorRecebido] = useState('')
  const [observacao, setObservacao] = useState('')
  const [busca, setBusca] = useState('')

  const buscaRef = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)

  /**
   * Só passa a gravar depois de ler — sem essa trava, o efeito de
   * persistência dispararia no primeiro render (com o carrinho ainda vazio,
   * antes do rascunho ser lido) e apagaria o rascunho salvo antes mesmo de a
   * tela mostrar que ele existia.
   */
  const [rascunhoLido, setRascunhoLido] = useState(false)

  useEffect(() => {
    try {
      const bruto = localStorage.getItem(chaveRascunho)
      if (bruto) {
        const rascunho = JSON.parse(bruto) as Partial<RascunhoVenda>
        // Cada campo é validado contra o que a tela tem agora, e não contra o
        // que tinha quando o rascunho foi salvo: produto excluído, cliente
        // inativado ou forma de pagamento removida entre uma sessão e outra
        // não pode voltar como um valor fantasma que o `<select>` não lista e
        // o servidor recusa sem dizer por quê.
        const carrinhoValido = (rascunho.carrinho ?? []).filter(
          (l) =>
            produtos.some((p) => p.id === l.produtoId) &&
            Number.isInteger(l.quantidade) &&
            l.quantidade > 0,
        )
        if (carrinhoValido.length > 0) setCarrinho(carrinhoValido)
        if (rascunho.clienteId && clientes.some((c) => c.id === rascunho.clienteId)) {
          setClienteId(rascunho.clienteId)
        }
        if (rascunho.entregadorId && entregadores.some((e) => e.id === rascunho.entregadorId)) {
          setEntregadorId(rascunho.entregadorId)
        }
        if (rascunho.formaId && formas.some((f) => f.id === rascunho.formaId)) {
          setFormaId(rascunho.formaId)
        }
        if (rascunho.desconto) setDesconto(rascunho.desconto)
        if (rascunho.descontoModo === 'percentual') setDescontoModo('percentual')
        if (rascunho.parcelas) setParcelas(rascunho.parcelas)
        if (rascunho.valorRecebido) setValorRecebido(rascunho.valorRecebido)
        if (rascunho.observacao) setObservacao(rascunho.observacao)
      }
    } catch {
      // Rascunho corrompido (versão antiga do formato, JSON quebrado por
      // edição manual do storage): melhor começar em branco do que travar a
      // tela de venda mais usada do sistema.
    }
    setRascunhoLido(true)
    // Só ao montar: os parâmetros (`produtos`, `clientes`, `formas`) são os do
    // carregamento inicial da página, e re-rodar a cada referência nova deles
    // reaplicaria o rascunho por cima do que a operadora já digitou.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!rascunhoLido) return
    const vazio =
      carrinho.length === 0 &&
      !clienteId &&
      !entregadorId &&
      !desconto &&
      !valorRecebido &&
      !observacao &&
      parcelas === '1'
    if (vazio) {
      localStorage.removeItem(chaveRascunho)
      return
    }
    const rascunho: RascunhoVenda = {
      carrinho,
      clienteId,
      entregadorId,
      formaId,
      desconto,
      descontoModo,
      parcelas,
      valorRecebido,
      observacao,
    }
    localStorage.setItem(chaveRascunho, JSON.stringify(rascunho))
  }, [
    rascunhoLido,
    chaveRascunho,
    carrinho,
    clienteId,
    entregadorId,
    formaId,
    desconto,
    descontoModo,
    parcelas,
    valorRecebido,
    observacao,
  ])

  const cliente = clientes.find((c) => c.id === clienteId) ?? null
  const forma = formas.find((f) => f.id === formaId) ?? null
  const aPrazo = forma?.tipo === 'a_prazo'

  /* ------------------------------------------------------------------ preço */

  /**
   * A mesma cascata do servidor: tabela do cliente → tabela padrão → preço do
   * cadastro. Repetida aqui porque o número precisa aparecer antes do envio;
   * se um dia divergirem, quem grava é o servidor.
   */
  const tabelaId = cliente?.tabelaPrecoId ?? tabelaPadraoId
  const precoDe = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const p of precos) {
      if (p.tabelaId === tabelaId) mapa.set(p.produtoId, centavos(Number(p.preco)))
    }
    return (produtoId: string) =>
      mapa.get(produtoId) ??
      centavos(Number(produtos.find((p) => p.id === produtoId)?.precoPadrao ?? 0))
  }, [precos, produtos, tabelaId])

  const porId = useMemo(() => new Map(produtos.map((p) => [p.id, p])), [produtos])

  /* --------------------------------------------------------------- carrinho */

  /**
   * Teto de quantidade: o saldo em estoque, para quem controla estoque; sem
   * teto para quem não controla (serviço, item que não passa por depósito).
   * `fecharVenda` confere de novo contra o saldo de verdade dentro da
   * transação — este teto aqui é só o que evita a operadora catar no carrinho
   * o que o servidor ia recusar de qualquer jeito.
   */
  function maximoDoProduto(produtoId: string): number {
    const p = porId.get(produtoId)
    if (!p || !p.controlaEstoque) return 9999
    return Math.max(0, Math.min(9999, p.emEstoque))
  }

  function adicionar(produtoId: string) {
    const maximo = maximoDoProduto(produtoId)
    if (maximo <= 0) return
    setCarrinho((atual) => {
      const existente = atual.find((l) => l.produtoId === produtoId)
      if (existente) {
        if (existente.quantidade >= maximo) return atual
        return atual.map((l) =>
          l.produtoId === produtoId ? { ...l, quantidade: Math.min(maximo, l.quantidade + 1) } : l,
        )
      }
      return [...atual, { produtoId, quantidade: 1, vasilhameDevolvido: 0 }]
    })
  }

  function mudarQuantidade(produtoId: string, delta: number) {
    const maximo = maximoDoProduto(produtoId)
    setCarrinho((atual) =>
      atual.flatMap((l) => {
        if (l.produtoId !== produtoId) return [l]
        const nova = l.quantidade + delta
        // Chegar a zero remove a linha. Manter um item com quantidade 0 no
        // carrinho é um estado que só serve para ir parar na venda.
        if (nova < 1) return []
        const limitada = Math.min(maximo, nova)
        return [
          {
            ...l,
            quantidade: limitada,
            // O cliente não pode devolver mais vasilhames do que está levando.
            vasilhameDevolvido: Math.min(l.vasilhameDevolvido, limitada),
          },
        ]
      }),
    )
  }

  function mudarDevolvido(produtoId: string, delta: number) {
    setCarrinho((atual) =>
      atual.map((l) =>
        l.produtoId === produtoId
          ? {
              ...l,
              vasilhameDevolvido: Math.max(
                0,
                Math.min(l.quantidade, l.vasilhameDevolvido + delta),
              ),
            }
          : l,
      ),
    )
  }

  function remover(produtoId: string) {
    setCarrinho((atual) => atual.filter((l) => l.produtoId !== produtoId))
  }

  /* ----------------------------------------------------------------- totais */

  const subtotal = carrinho.reduce((soma, l) => soma + precoDe(l.produtoId) * l.quantidade, 0)
  const descontoDigitado = paraNumero(desconto) || 0
  const descontoCent = Math.max(
    0,
    descontoModo === 'percentual'
      ? Math.round((subtotal * descontoDigitado) / 100)
      : centavos(descontoDigitado),
  )
  const total = Math.max(0, subtotal - descontoCent)
  const taxa = aPrazo || !forma ? 0 : Math.round((total * Number(forma.taxaPercentual)) / 100)
  const recebidoCent = centavos(paraNumero(valorRecebido) || 0)
  // Com o carrinho vazio o total é zero, e "recebido > 0" bateria como troco
  // sem venda nenhuma por trás — a quebra em cédulas só faz sentido depois de
  // haver o que vender e quanto o cliente passou para pagar.
  const troco =
    carrinho.length > 0 && forma?.tipo === 'dinheiro' && recebidoCent > total
      ? recebidoCent - total
      : 0

  const vasilhamesNaVenda = carrinho.reduce(
    (soma, l) => (porId.get(l.produtoId)?.retornavel ? soma + l.quantidade : soma),
    0,
  )

  const descontoExcede = descontoCent > 0 && descontoCent >= subtotal && subtotal > 0

  /**
   * Trocar de unidade converte o número, em vez de limpar o campo. "10" em %
   * sobre uma venda de R$ 50 quer dizer R$ 5 — se a troca apagasse o campo, a
   * operadora que errou de unidade no meio da digitação perderia a conta que
   * já tinha feito de cabeça.
   */
  function alternarDescontoModo(novoModo: 'reais' | 'percentual') {
    if (novoModo === descontoModo) return
    if (subtotal > 0 && descontoDigitado > 0) {
      const convertido =
        novoModo === 'percentual'
          ? (descontoCent / subtotal) * 100
          : deCentavos(descontoCent)
      setDesconto(convertido.toFixed(2).replace('.', ','))
    } else {
      setDesconto('')
    }
    setDescontoModo(novoModo)
  }

  /* -------------------------------------------------------------- resultado */

  /**
   * Depois de fechar, a tela fica pronta para o próximo cliente — mas não
   * zerada. A forma de pagamento fica, porque é a mesma o dia inteiro; o
   * carrinho, o cliente e o desconto limpam, porque é outra venda.
   *
   * Ajustado em render e não em efeito: um `setState` dentro de `useEffect`
   * pinta a tela uma vez com o carrinho antigo ainda visível. É a piscada que o
   * `AGENTS.md` proíbe, e ela cairia exatamente no momento em que a operadora
   * olha para conferir o que gravou.
   */
  const [ultimaFechada, setUltimaFechada] = useState(0)
  if (estado.recibo && estado.tentativa !== ultimaFechada) {
    setUltimaFechada(estado.tentativa ?? 0)
    setCarrinho([])
    setClienteId('')
    setEntregadorId('')
    setDesconto('')
    setDescontoModo('reais')
    setParcelas('1')
    setValorRecebido('')
    setObservacao('')
    setBusca('')
    // A venda gravou: o rascunho que a protegia de um recarregamento acidental
    // deixou de ter sentido, e mantê-lo devolveria um carrinho fantasma na
    // próxima venda se o efeito de persistência ainda não tiver rodado.
    localStorage.removeItem(chaveRascunho)
  }

  const avisadoRef = useRef(0)
  useEffect(() => {
    if (!estado.recibo) return
    buscaRef.current?.focus()
    // Guardado por `tentativa`, e não só por `estado.recibo` existir: sem
    // isto, o StrictMode do React (que roda todo efeito duas vezes em
    // desenvolvimento) avisaria a mesma venda duas vezes — inofensivo aqui
    // (a outra aba só busca de novo um dado que já busca de novo mesmo), mas
    // sem necessidade.
    if (avisadoRef.current !== estado.tentativa) {
      avisadoRef.current = estado.tentativa ?? 0
      avisarMudanca(companyId, 'vendas')
    }
  }, [estado, companyId])

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    if (!termo) return produtos
    return produtos.filter(
      (p) =>
        p.nome.toLowerCase().includes(termo) ||
        String(p.codigo ?? '').padStart(4, '0').includes(termo),
    )
  }, [busca, produtos])

  const podeFechar = carrinho.length > 0 && total > 0

  /**
   * Atalhos de teclado — `1` a `9` adicionam, `0` fecha a venda.
   *
   * Só valem com o foco **fora** de um campo de texto: dentro da busca, do
   * desconto ou da observação, `1`–`9` são dígitos sendo digitados, não
   * atalhos — sem essa trava, escrever o código "0002" na busca ou "150" no
   * desconto dispararia produto atrás de produto. Fora de campo nenhum
   * (depois de adicionar um item, o foco já não está em lugar algum), a
   * tecla vale como atalho. A ordem segue a mesma da grade filtrada: buscar
   * "10L" e apertar `1` bate sempre no primeiro resultado da busca, nunca
   * num produto que saiu de vista.
   */
  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const alvo = e.target
      const emCampoDeTexto =
        alvo instanceof HTMLElement &&
        (alvo.tagName === 'INPUT' ||
          alvo.tagName === 'TEXTAREA' ||
          alvo.tagName === 'SELECT' ||
          alvo.isContentEditable)
      if (emCampoDeTexto) return
      if (e.key === ATALHO_FECHAR) {
        e.preventDefault()
        if (podeFechar) formRef.current?.requestSubmit()
        return
      }
      const tipoAtalho = (Object.keys(ATALHOS_FORMA) as TipoPagamento[]).find(
        (tipo) => ATALHOS_FORMA[tipo] === e.key.toLowerCase(),
      )
      if (tipoAtalho) {
        const formaAlvo = formas.find((f) => f.tipo === tipoAtalho)
        if (formaAlvo) {
          e.preventDefault()
          setFormaId(formaAlvo.id)
        }
        return
      }
      const indice = ATALHOS_PRODUTO.indexOf(e.key as (typeof ATALHOS_PRODUTO)[number])
      if (indice === -1) return
      const produto = filtrados[indice]
      if (!produto) return
      e.preventDefault()
      adicionar(produto.id)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrados, podeFechar, formas])

  if (produtos.length === 0) {
    return (
      <Card className="p-6 text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-full bg-alerta-bg text-alerta">
          <CircleAlert className="size-5" aria-hidden />
        </div>
        <p className="mt-3 text-base font-medium text-texto">Nenhum produto cadastrado</p>
        <p className="mx-auto mt-1 max-w-[46ch] text-sm text-texto-suave">
          O PDV vende o que está no cadastro de produtos. Cadastre a água e o gás, com preço, e
          a venda de balcão funciona no mesmo minuto.
        </p>
        <Button asChild variant="primario" className="mt-4">
          <Link href="/cadastro/produtos">Ir para Produtos</Link>
        </Button>
      </Card>
    )
  }

  if (formas.length === 0) {
    return (
      <Card className="p-6 text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-full bg-alerta-bg text-alerta">
          <Wallet className="size-5" aria-hidden />
        </div>
        <p className="mt-3 text-base font-medium text-texto">Nenhuma forma de pagamento ativa</p>
        <p className="mx-auto mt-1 max-w-[46ch] text-sm text-texto-suave">
          Sem forma de pagamento não há como dizer se a venda entrou no caixa ou virou a prazo.
        </p>
      </Card>
    )
  }

  return (
    <>
    <form ref={formRef} action={enviar} className="space-y-4 print:hidden" noValidate>
      {/* O único campo escondido é o carrinho: ele é uma lista, e lista não tem
          controle de formulário. Todo o resto são campos de verdade, com
          `name`, e é isso que faz a venda ser enviada mesmo se o React ainda
          não tiver assumido a página. */}
      <input type="hidden" name="itens" value={JSON.stringify(carrinho)} />

      {estado.recibo && <Recibo recibo={estado.recibo} />}

      <AvisoErro erro={estado.erro} />

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem] xl:grid-cols-[1fr_25rem]">
        {/* ------------------------------------------------------- catálogo */}
        <div className="space-y-4">
          <Card className="p-4 md:p-5">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-texto-fraco"
                aria-hidden
              />
              <Input
                ref={buscaRef}
                autoFocus
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => {
                  // Enter adiciona o primeiro resultado: é o fluxo de quem digita
                  // o código do produto sem tirar a mão do teclado.
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (filtrados[0]) {
                      adicionar(filtrados[0].id)
                      setBusca('')
                    }
                  }
                }}
                placeholder="Buscar produto por nome ou código…"
                aria-label="Buscar produto"
                autoComplete="off"
                className="h-12 pl-10 text-base"
              />
            </div>
            <p className="mt-2 text-2xs text-texto-fraco">
              Com o foco fora de um campo: 1–9 adicionam os produtos abaixo · 0 fecha a venda
            </p>

            {filtrados.length === 0 ? (
              <p className="py-8 text-center text-sm text-texto-suave">
                Nenhum produto encontrado para “{busca}”.
              </p>
            ) : (
              // Grade grande de propósito: quanto maior o botão, menos preciso
              // é o toque para acertá-lo — é a mesma lógica de um caixa de
              // supermercado, onde o produto é uma tecla grande, não uma linha
              // numa tabela.
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
                {filtrados.map((p, indice) => {
                  const preco = precoDe(p.id)
                  const atalho = ATALHOS_PRODUTO[indice]
                  const noCarrinho = carrinho.find((l) => l.produtoId === p.id)
                  // Sem saldo nenhum, ou o carrinho já está no teto do que há
                  // no depósito: o clique não adicionaria nada mesmo, então o
                  // botão já nasce travado em vez de parecer que aceitou.
                  const travado =
                    p.controlaEstoque &&
                    (p.emEstoque <= 0 || (noCarrinho?.quantidade ?? 0) >= p.emEstoque)
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => adicionar(p.id)}
                      disabled={travado}
                      aria-disabled={travado}
                      className={cn(
                        'relative flex min-h-[6.5rem] flex-col items-start justify-between gap-2 rounded-xl border-2 px-3.5 py-3 text-left transition-colors',
                        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foco',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        noCarrinho
                          ? 'border-acento bg-acento-suave'
                          : 'border-borda-controle bg-superficie hover:bg-superficie-hover hover:border-borda-forte active:scale-[0.98]',
                      )}
                    >
                      {noCarrinho && (
                        <Badge
                          variant="info"
                          className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full p-0 text-sm tabular-nums shadow-sm"
                        >
                          {noCarrinho.quantidade}
                        </Badge>
                      )}
                      {atalho && (
                        <kbd className="absolute -left-2 -top-2 rounded border border-borda bg-superficie px-1 py-0.5 text-2xs font-semibold text-texto-fraco shadow-sm">
                          {atalho}
                        </kbd>
                      )}
                      <span className="flex items-center gap-1.5 text-base font-medium leading-tight text-texto">
                        {caminhoIconeProduto(p.icone) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={caminhoIconeProduto(p.icone)!}
                            alt=""
                            width={18}
                            height={18}
                            className="size-[1.125rem] shrink-0"
                          />
                        )}
                        {p.nome}
                      </span>
                      <span className="flex w-full items-end justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-xs text-texto-fraco">
                          {p.retornavel && <Truck className="size-3.5" aria-hidden />}
                          {p.controlaEstoque && (
                            // O saldo é o teto: ver `maximoDoProduto`, acima, e a
                            // conferência de novo em `acoes.ts`.
                            <span
                              className={cn('tabular-nums', p.emEstoque <= 0 && 'text-perigo')}
                            >
                              {p.emEstoque <= 0
                                ? 'sem estoque'
                                : `${p.emEstoque.toLocaleString('pt-BR')} un.`}
                            </span>
                          )}
                        </span>
                        <span className="text-lg font-semibold tabular-nums text-texto">
                          {moeda(deCentavos(preco))}
                          {preco === 0 && (
                            <span className="ml-1 text-2xs font-normal text-alerta">
                              sem preço
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </Card>

          {/* ------------------------------------------------------ carrinho */}
          <Card className="p-4 md:p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-texto">
              <ShoppingCart className="size-4" aria-hidden />
              Itens da venda
              {carrinho.length > 0 && (
                <span className="text-texto-fraco tabular-nums">({carrinho.length})</span>
              )}
            </h2>

            {carrinho.length === 0 ? (
              <div className="py-8 text-center">
                <div className="mx-auto grid size-11 place-items-center rounded-full bg-superficie-afundada text-texto-suave">
                  <Package className="size-5" aria-hidden />
                </div>
                <p className="mt-3 text-sm font-medium text-texto">Carrinho vazio</p>
                <p className="mx-auto mt-1 max-w-[42ch] text-sm text-texto-suave">
                  Clique num produto acima para começar. Clicar de novo soma mais um.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-borda">
                {carrinho.map((l) => {
                  const p = porId.get(l.produtoId)
                  if (!p) return null
                  const unitario = precoDe(l.produtoId)
                  return (
                    <li key={l.produtoId} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-texto">{p.nome}</p>
                          <p className="text-xs tabular-nums text-texto-suave">
                            {moeda(deCentavos(unitario))} / {p.unidade}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            variant="secundario"
                            size="icone-toque"
                            onClick={() => mudarQuantidade(l.produtoId, -1)}
                            aria-label={`Diminuir ${p.nome}`}
                          >
                            <Minus aria-hidden />
                          </Button>
                          <span className="w-8 text-center text-sm font-semibold tabular-nums text-texto">
                            {l.quantidade}
                          </span>
                          <Button
                            type="button"
                            variant="secundario"
                            size="icone-toque"
                            onClick={() => mudarQuantidade(l.produtoId, 1)}
                            disabled={l.quantidade >= maximoDoProduto(l.produtoId)}
                            aria-label={`Aumentar ${p.nome}`}
                          >
                            <Plus aria-hidden />
                          </Button>
                        </div>

                        <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-texto">
                          {moeda(deCentavos(unitario * l.quantidade))}
                        </span>

                        <Button
                          type="button"
                          variant="fantasma"
                          size="icone-toque"
                          onClick={() => remover(l.produtoId)}
                          aria-label={`Remover ${p.nome}`}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>

                      {/* A pergunta do balcão, no lugar onde ela é feita.
                          Só aparece em produto retornável e com cliente
                          identificado — sem cliente não há comodato a
                          acertar, e o contador prometeria algo que a venda
                          não vai gravar. */}
                      {p.retornavel && clienteId && (
                        <div className="mt-2 flex items-center gap-2 rounded-md bg-superficie-afundada px-3 py-2">
                          <Truck className="size-4 shrink-0 text-texto-suave" aria-hidden />
                          <span className="flex-1 text-xs text-texto-suave">
                            Galões vazios que ele trouxe agora
                          </span>
                          <Button
                            type="button"
                            variant="secundario"
                            size="icone-toque"
                            onClick={() => mudarDevolvido(l.produtoId, -1)}
                            aria-label={`Menos vasilhame devolvido de ${p.nome}`}
                          >
                            <Minus aria-hidden />
                          </Button>
                          <span className="w-8 text-center text-sm font-semibold tabular-nums text-texto">
                            {l.vasilhameDevolvido}
                          </span>
                          <Button
                            type="button"
                            variant="secundario"
                            size="icone-toque"
                            onClick={() => mudarDevolvido(l.produtoId, 1)}
                            aria-label={`Mais vasilhame devolvido de ${p.nome}`}
                          >
                            <Plus aria-hidden />
                          </Button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
            {estado.campos?.itens && (
              <p className="mt-3 text-xs text-perigo">{estado.campos.itens}</p>
            )}
          </Card>
        </div>

        {/* ------------------------------------------------- cliente e pagamento */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card className="space-y-4 p-4 md:p-5">
            <div className="space-y-1.5">
              <Label htmlFor="clienteEscolha">
                Cliente
                <span className="ml-1 font-normal text-texto-fraco">(opcional)</span>
              </Label>
              <Select
                id="clienteEscolha"
                name="clienteId"
                value={clienteId}
                onChange={(e) => setClienteId(e.target.value)}
                erro={estado.campos?.clienteId}
              >
                <option value="">Consumidor no balcão</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.codigo ? `${String(c.codigo).padStart(4, '0')} - ` : ''}
                    {c.nome}
                  </option>
                ))}
              </Select>

              {/* Sem cliente, o comodato não tem devedor — e a operadora precisa
                  saber disso antes de fechar, não depois. */}
              {!clienteId && vasilhamesNaVenda > 0 && (
                <p className="text-xs text-alerta">
                  {vasilhamesNaVenda} vasilhame(ns) retornável(is) nesta venda. Sem cliente
                  identificado, o comodato não será registrado.
                </p>
              )}

              {cliente && (
                <div className="space-y-0.5 text-xs text-texto-suave tabular-nums">
                  {cliente.vasilhameNaRua > 0 && (
                    <p>{cliente.nome} está com {cliente.vasilhameNaRua} vasilhame(ns) hoje.</p>
                  )}
                  {Number(cliente.emAberto) > 0 && (
                    <p className="text-alerta">
                      Já tem {moeda(Number(cliente.emAberto))} em aberto
                      {Number(cliente.limiteCredito) > 0 &&
                        ` · limite ${moeda(Number(cliente.limiteCredito))}`}
                      .
                    </p>
                  )}
                </div>
              )}
            </div>

            {entregadores.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="entregadorEscolha">
                  Entregador
                  <span className="ml-1 font-normal text-texto-fraco">(opcional)</span>
                </Label>
                <Select
                  id="entregadorEscolha"
                  name="entregadorId"
                  value={entregadorId}
                  onChange={(e) => setEntregadorId(e.target.value)}
                  erro={estado.campos?.entregadorId}
                >
                  <option value="">Sem entregador definido</option>
                  {entregadores.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="formaEscolha">Forma de pagamento</Label>
              <Select
                id="formaEscolha"
                name="formaId"
                value={formaId}
                onChange={(e) => setFormaId(e.target.value)}
                erro={estado.campos?.formaId}
              >
                {formas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nome}
                    {Number(f.taxaPercentual) > 0 &&
                      ` — taxa ${Number(f.taxaPercentual).toLocaleString('pt-BR')}%`}
                  </option>
                ))}
              </Select>
            </div>

            {(aPrazo || forma?.tipo === 'credito') && (
              <div className="space-y-1.5">
                <Label htmlFor="parcelasCampo">Parcelas</Label>
                <Select
                  id="parcelasCampo"
                  name="parcelas"
                  value={parcelas}
                  onChange={(e) => setParcelas(e.target.value)}
                  erro={estado.campos?.parcelas}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={String(n)}>
                      {n}× de {moeda(deCentavos(Math.floor(total / n)))}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="descontoCampo">Desconto</Label>
                {/* O servidor só recebe reais (ver `esquemaVenda`); o campo
                    oculto abaixo carrega a conversão. Alternar aqui não muda
                    o que a venda grava, só como a operadora prefere digitar. */}
                <div className="flex overflow-hidden rounded-md border border-borda-controle text-xs">
                  {(['reais', 'percentual'] as const).map((modo) => (
                    <button
                      key={modo}
                      type="button"
                      onClick={() => alternarDescontoModo(modo)}
                      aria-pressed={descontoModo === modo}
                      className={cn(
                        'min-w-9 px-2 py-1 font-medium transition-colors',
                        descontoModo === modo
                          ? 'bg-acento-suave text-acento-texto'
                          : 'bg-superficie text-texto-suave hover:bg-superficie-hover',
                      )}
                    >
                      {modo === 'reais' ? 'R$' : '%'}
                    </button>
                  ))}
                </div>
              </div>
              <input type="hidden" name="desconto" value={deCentavos(descontoCent).toFixed(2)} />
              <Input
                id="descontoCampo"
                // `descontoDigitado` e não `desconto`: este é o número na
                // unidade que a operadora escolheu (R$ ou %), e não o que o
                // servidor grava. O campo oculto acima é quem carrega
                // `desconto` de verdade — dois campos com o mesmo `name`
                // fariam o `FormData` enviar só o último.
                name="descontoDigitado"
                value={desconto}
                onChange={(e) => setDesconto(e.target.value)}
                erro={estado.campos?.desconto ?? (descontoExcede ? 'Desconto maior que a venda' : undefined)}
                inputMode="decimal"
                autoComplete="off"
                placeholder={descontoModo === 'percentual' ? '0' : '0,00'}
                className="text-right tabular-nums"
              />
              {descontoModo === 'percentual' && descontoDigitado > 0 && (
                <p className="text-xs text-texto-fraco">
                  {descontoDigitado.toString().replace('.', ',')}% de{' '}
                  {moeda(deCentavos(subtotal))} = {moeda(deCentavos(descontoCent))}
                </p>
              )}
            </div>

            {forma?.tipo === 'dinheiro' && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="recebidoCampo">
                    Valor recebido
                    <span className="ml-1 font-normal text-texto-fraco">(para o troco)</span>
                  </Label>
                  {/* A maioria das vendas de balcão é paga com o valor certo —
                      exigir digitar de novo o que já está na tela só para o
                      troco sair zerado é fricção que sobra em toda venda em
                      dinheiro. */}
                  <button
                    type="button"
                    onClick={() =>
                      setValorRecebido(
                        deCentavos(total).toLocaleString('pt-BR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }),
                      )
                    }
                    className="shrink-0 text-2xs font-medium text-acento-texto hover:underline"
                  >
                    Valor exato
                  </button>
                </div>
                <Input
                  id="recebidoCampo"
                  name="valorRecebido"
                  value={valorRecebido}
                  onChange={(e) => setValorRecebido(e.target.value)}
                  erro={estado.campos?.valorRecebido}
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0,00"
                  className="text-right tabular-nums"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="observacaoCampo">
                Observação
                <span className="ml-1 font-normal text-texto-fraco">(opcional)</span>
              </Label>
              <Textarea
                id="observacaoCampo"
                name="observacao"
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                erro={estado.campos?.observacao}
                rows={2}
                maxLength={300}
                placeholder="Entregar na obra da rua 5"
              />
            </div>
          </Card>

          <Card className="p-4 md:p-5">
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between text-texto-suave">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{moeda(deCentavos(subtotal))}</dd>
              </div>
              {descontoCent > 0 && (
                <div className="flex justify-between text-texto-suave">
                  <dt>Desconto</dt>
                  <dd className="tabular-nums">− {moeda(deCentavos(descontoCent))}</dd>
                </div>
              )}
              {taxa > 0 && (
                // O dono precisa ver que a maquininha come uma parte antes de
                // achar que recebeu tudo.
                <div className="flex justify-between text-alerta">
                  <dt>Taxa {forma?.nome}</dt>
                  <dd className="tabular-nums">− {moeda(deCentavos(taxa))}</dd>
                </div>
              )}
              <div className="flex items-baseline justify-between border-t border-borda pt-2 text-texto">
                <dt className="text-base font-semibold">Total</dt>
                <dd className="text-3xl font-semibold tabular-nums">
                  {moeda(deCentavos(total))}
                </dd>
              </div>
              {taxa > 0 && (
                <div className="flex justify-between text-xs text-texto-suave">
                  <dt>Entra no caixa</dt>
                  <dd className="tabular-nums">{moeda(deCentavos(total - taxa))}</dd>
                </div>
              )}
              {troco > 0 && (
                <div className="rounded-md bg-sucesso-bg px-3 py-2 text-sucesso">
                  <div className="flex items-baseline justify-between">
                    <dt className="font-medium">Troco</dt>
                    <dd className="text-lg font-semibold tabular-nums">
                      {moeda(deCentavos(troco))}
                    </dd>
                  </div>
                  <QuebraDeTroco centavos={troco} />
                </div>
              )}
              {aPrazo && (
                <div className="rounded-md bg-info-bg px-3 py-2 text-xs text-info">
                  Nada entra no caixa agora. A venda vira{' '}
                  {parcelas === '1' ? 'um título' : `${parcelas} títulos`} em Contas a Receber.
                </div>
              )}
            </dl>

            <BotaoFechar habilitado={podeFechar} />
          </Card>
        </div>
      </div>
    </form>
    {estado.recibo && <PrintCupom recibo={estado.recibo} />}
    </>
  )
}

function BotaoFechar({ habilitado }: { habilitado: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      variant="primario"
      size="lg"
      disabled={pending || !habilitado}
      aria-disabled={pending || !habilitado}
      className="mt-4 h-14 w-full text-base"
    >
      {pending ? (
        'Fechando…'
      ) : (
        <>
          <Check aria-hidden />
          Fechar venda
          <kbd className="ml-1 rounded border border-current/30 px-1.5 py-0.5 text-2xs font-semibold opacity-80">
            0
          </kbd>
        </>
      )}
    </Button>
  )
}

/**
 * O comprovante que fica na tela.
 *
 * Existe pelo mesmo motivo do recibo da baixa de vasilhame: a operadora precisa
 * repetir três números para o cliente antes dele sair — o total, o troco e
 * quantos galões ele ficou devendo. Ter que navegar para outra tela para
 * conferir é o que faz alguém lançar a mesma venda duas vezes.
 */
function Recibo({ recibo }: { recibo: NonNullable<EstadoVenda['recibo']> }) {
  return (
    <div
      role="status"
      className="rounded-lg border border-sucesso-bg bg-sucesso-bg px-4 py-3 text-sm text-sucesso"
    >
      <div className="flex items-start gap-3">
        <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="font-medium">
            Venda {recibo.codigo ? `#${recibo.codigo}` : ''} fechada —{' '}
            <span className="tabular-nums">{moeda(recibo.total)}</span> em {recibo.forma}
            {recibo.cliente && ` · ${recibo.cliente}`}
            {recibo.entregador && ` · entrega: ${recibo.entregador}`}
          </p>

          {recibo.troco !== null && recibo.troco > 0 && (
            <div>
              <p className="text-base font-semibold tabular-nums">
                Troco: {moeda(recibo.troco)}
              </p>
              <QuebraDeTroco centavos={centavos(recibo.troco)} />
            </div>
          )}

          {recibo.aPrazo && (
            <p>
              {recibo.parcelas === 1
                ? `Título gerado em Contas a Receber, vencendo em ${recibo.primeiroVencimento}.`
                : `${recibo.parcelas} parcelas geradas em Contas a Receber, a primeira em ${recibo.primeiroVencimento}.`}
            </p>
          )}

          {recibo.taxa > 0 && (
            <p>
              Taxa de {moeda(recibo.taxa)} descontada — entraram{' '}
              {moeda(recibo.total - recibo.taxa)} no caixa.
            </p>
          )}

          {recibo.vasilhameEntregue > 0 && (
            <p className="tabular-nums">
              {recibo.vasilhameEntregue} vasilhame(ns) entregue(s)
              {recibo.vasilhameDevolvido > 0 && `, ${recibo.vasilhameDevolvido} devolvido(s)`}
              {recibo.saldoVasilhame !== null &&
                ` — ${recibo.cliente} fica com ${recibo.saldoVasilhame}.`}
            </p>
          )}

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Link
              href="/vendas/produtos"
              className="underline underline-offset-2"
            >
              Ver na listagem de vendas
            </Link>

            <Dialog>
              <DialogTrigger asChild>
                <button type="button" className="inline-flex items-center gap-1 underline underline-offset-2">
                  <Receipt className="size-3.5" aria-hidden />
                  Ver cupom
                </button>
              </DialogTrigger>
              <DialogContent titulo="Cupom da venda" descricao="Comprovante para entregar ou ler ao cliente.">
                <CupomVenda recibo={recibo} />
              </DialogContent>
            </Dialog>
          </p>
        </div>
      </div>
    </div>
  )
}

/**
 * O papel em si — preto sobre branco, sempre, não importa o tema da tela.
 *
 * É deliberado ignorar `text-texto`/`bg-superficie` aqui: essas variáveis
 * existem para telas claras ou escuras, mas o cupom é um objeto físico, e
 * "modo escuro impresso" não existe — só desperdiça tinta e fica ilegível.
 * O mesmo componente serve à pré-visualização no diálogo (para não surpreender
 * a operadora com um layout diferente do que vai sair impresso) e ao bloco
 * silencioso em `<PrintCupom>`, que é o que realmente vai para o papel.
 *
 * `M` no círculo é um marcador de posição para a logo da distribuidora — o
 * espaço já está desenhado para o dia em que o cadastro de empresa ganhar
 * upload de imagem; até lá, a inicial cumpre o mesmo papel de identificar a
 * empresa à primeira vista.
 */
function ConteudoCupom({ recibo }: { recibo: NonNullable<EstadoVenda['recibo']> }) {
  const inicial = recibo.empresa.trim().charAt(0).toUpperCase() || 'C'
  return (
    <div className="mx-auto w-full max-w-[420px] bg-white text-black">
      <div className="flex flex-col items-center gap-2 pb-3 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-black text-lg font-semibold text-white">
          {inicial}
        </div>
        <div>
          <p className="text-base font-semibold tracking-tight">{recibo.empresa}</p>
          <p className="text-xs text-black/55">Comprovante de venda</p>
          {(recibo.empresaDocumento || recibo.empresaTelefone) && (
            <p className="text-2xs text-black/45">
              {[recibo.empresaDocumento, recibo.empresaTelefone].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-y border-black/20 py-1.5 text-xs text-black/60">
        <span>{recibo.codigo ? `Venda #${recibo.codigo}` : 'Venda'}</span>
        <span>{recibo.emitidoEm}</span>
      </div>

      <div className="space-y-0.5 py-3">
        <p className="text-2xs font-medium uppercase tracking-wide text-black/45">Cliente</p>
        <p className="text-sm font-semibold">{recibo.cliente ?? 'Consumidor no balcão'}</p>
        {recibo.clienteEndereco && (
          <p className="text-xs text-black/60">{recibo.clienteEndereco}</p>
        )}
      </div>

      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-black/25 text-black/45">
            <th className="py-1.5 text-left font-medium">Item</th>
            <th className="py-1.5 pl-2 text-right font-medium">Qtd</th>
            <th className="py-1.5 pl-2 text-right font-medium">Unit.</th>
            <th className="py-1.5 pl-2 text-right font-medium">Total</th>
          </tr>
        </thead>
        <tbody>
          {recibo.itensDetalhe.map((item, i) => (
            <tr key={i} className="border-b border-black/10">
              <td className="py-1.5 pr-2">{item.produto}</td>
              <td className="py-1.5 pl-2 text-right tabular-nums">{item.quantidade}</td>
              <td className="py-1.5 pl-2 text-right tabular-nums">
                {moeda(item.precoUnitario)}
              </td>
              <td className="py-1.5 pl-2 text-right font-medium tabular-nums">
                {moeda(item.total)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-3 space-y-1 border-t border-black/25 pt-2 text-xs">
        <div className="flex justify-between text-black/60">
          <span>Subtotal</span>
          <span className="tabular-nums">{moeda(recibo.subtotal)}</span>
        </div>
        {recibo.desconto > 0 && (
          <div className="flex justify-between text-black/60">
            <span>Desconto</span>
            <span className="tabular-nums">− {moeda(recibo.desconto)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between border-t border-black/25 pt-1.5 text-sm font-semibold">
          <span>Total</span>
          <span className="tabular-nums">{moeda(recibo.total)}</span>
        </div>
        <div className="flex justify-between text-black/60">
          <span>Forma de pagamento</span>
          <span>{recibo.forma}</span>
        </div>
        {recibo.troco !== null && recibo.troco > 0 && (
          <div className="flex justify-between text-black/60">
            <span>Troco</span>
            <span className="tabular-nums">{moeda(recibo.troco)}</span>
          </div>
        )}
        {recibo.vasilhameEntregue > 0 && (
          <div className="flex justify-between text-black/60">
            <span>Vasilhame</span>
            <span className="tabular-nums">
              {recibo.vasilhameEntregue} entregue(s)
              {recibo.vasilhameDevolvido > 0 && `, ${recibo.vasilhameDevolvido} devolvido(s)`}
            </span>
          </div>
        )}
        {recibo.entregador && (
          <div className="flex justify-between text-black/60">
            <span>Entregador</span>
            <span>{recibo.entregador}</span>
          </div>
        )}
        <div className="flex justify-between text-black/60">
          <span>Atendente</span>
          <span>{recibo.vendedor}</span>
        </div>
      </div>

      <div className="mt-4 space-y-1 border-t border-black/20 pt-2 text-center">
        <p className="text-2xs text-black/40">Obrigado pela preferência!</p>
        <p className="text-2xs text-black/30">
          Este comprovante não substitui documento fiscal.
        </p>
      </div>
    </div>
  )
}

/**
 * A pré-visualização no diálogo — o mesmo `<ConteudoCupom>` que vai para o
 * papel, dentro de um cartão para não parecer uma página em branco perdida no
 * meio de uma tela escura.
 */
function CupomVenda({ recibo }: { recibo: NonNullable<EstadoVenda['recibo']> }) {
  return (
    <div>
      <div className="overflow-hidden rounded-md border border-borda bg-white p-4 shadow-sm">
        <ConteudoCupom recibo={recibo} />
      </div>

      <Button
        type="button"
        variant="primario"
        className="mt-4 w-full"
        onClick={() => window.print()}
      >
        <Printer aria-hidden />
        Imprimir cupom
      </Button>
    </div>
  )
}

/**
 * O que realmente vai para o papel — escondido na tela (`hidden`), presente
 * assim que a venda fecha e só visível para o motor de impressão
 * (`print:block`).
 *
 * **Por que não imprimir o diálogo que já está na tela:** ele vive dentro de
 * uma caixa `max-h-[85dvh] overflow-y-auto` (ver `dialog.tsx`) — no celular,
 * `window.print()` captura só o que está rolado à vista naquele instante; o
 * resto do cupom saía cortado, e o espaço reservado pela caixa `fixed` virava
 * página em branco. Este bloco é irmão do diálogo, nunca dentro de uma caixa
 * com altura ou rolagem travada, então flui e pagina como qualquer texto.
 */
function PrintCupom({ recibo }: { recibo: NonNullable<EstadoVenda['recibo']> }) {
  return (
    <div className="hidden print:block">
      <ConteudoCupom recibo={recibo} />
    </div>
  )
}
