'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { uuidv7 } from 'uuidv7'
import {
  caixaMovimentos,
  clientes,
  companies,
  contasReceber,
  estoqueMovimentos,
  estoqueSaldos,
  formasPagamento,
  pagamentos,
  precos,
  produtos,
  tabelasPreco,
  vasilhameMovimentos,
  vasilhameSaldos,
  vendaItens,
  vendas,
} from '@/db/schema'
import { comTenant } from '@/lib/dal'
import { descreverFalha } from '@/lib/erros'
import { autorDoLancamento } from '@/lib/sessao'
import {
  dataNaLoja,
  formatarDataHora,
  formatarDataISO,
  formatarDocumento,
  formatarEndereco,
  formatarTelefone,
} from '@/lib/formatos'
import {
  CAMPOS_VENDA,
  centavos,
  deCentavos,
  esquemaVenda,
  type CampoVenda,
  type EstadoVenda,
} from './esquema'

/**
 * Fechar uma venda — **uma transação, seis tabelas.**
 *
 * É o ponto onde o sistema deixa de ser um cadastro. Uma venda de balcão não é
 * uma linha em `vendas`: ela é receita, saída de estoque, entrada de caixa (ou
 * um título a receber), e galão que passou a ser dívida do cliente. Ou as seis
 * coisas acontecem, ou nenhuma acontece — e é por isso que tudo mora dentro do
 * mesmo `comTenant`, que já abre a transação.
 *
 * Gravar essas coisas em telas separadas é como se chega ao fim do mês com
 * estoque que não bate com venda. Aqui não existe caminho em que a venda entre
 * e o estoque não saia.
 *
 * Duas coisas que este arquivo deliberadamente **não** faz:
 *
 * - **Não bloqueia venda por falta de estoque.** O saldo aparece na tela, em
 *   vermelho, antes de fechar. Mas travar a venda porque o cadastro diz que
 *   acabou a água — quando tem água no depósito e o cliente está na frente —
 *   é como se ensina a operadora a lançar por fora. Estoque negativo é um
 *   problema visível; venda fora do sistema é um problema invisível.
 * - **Não movimenta estoque do galão vazio.** O comodato é rastreado por
 *   `vasilhame_saldos`, que o módulo de vasilhame mantém por trigger. Lançar o
 *   galão nas duas contabilidades faria as duas discordarem na primeira
 *   correção.
 */

function erroDeValidacao(erro: z.ZodError, tentativa: number): EstadoVenda {
  const porCampo = z.flattenError(erro).fieldErrors as Record<string, string[] | undefined>
  const campos: Partial<Record<CampoVenda, string>> = {}
  for (const campo of CAMPOS_VENDA) {
    const msg = porCampo[campo]?.[0]
    if (msg) campos[campo] = msg
  }
  const geral = z.flattenError(erro).formErrors[0]
  return { campos, tentativa, erro: Object.keys(campos).length ? undefined : geral }
}

function revalidarTudo() {
  revalidatePath('/vendas/pdv')
  revalidatePath('/vendas/produtos')
  revalidatePath('/financeiro/receber')
  revalidatePath('/vasilhame/saldos')
  revalidatePath('/vasilhame/movimentos')
  revalidatePath('/painel')
}

export async function fecharVenda(
  anterior: EstadoVenda,
  form: FormData,
): Promise<EstadoVenda> {
  const tentativa = (anterior.tentativa ?? 0) + 1

  const bruto = Object.fromEntries(
    CAMPOS_VENDA.map((campo) => [campo, String(form.get(campo) ?? '')]),
  )
  const analise = esquemaVenda.safeParse(bruto)
  if (!analise.success) return erroDeValidacao(analise.error, tentativa)

  const dados = analise.data

  try {
    return await comTenant(async (tx, sessao) => {
      /* -------------------------------------------------- quem está comprando */

      let cliente:
        | {
            id: string
            nome: string
            tabelaPrecoId: string | null
            cep: string | null
            logradouro: string | null
            numero: string | null
            complemento: string | null
            bairro: string | null
            cidade: string | null
            uf: string | null
          }
        | null = null
      if (dados.clienteId) {
        const [linha] = await tx
          .select({
            id: clientes.id,
            nome: clientes.nome,
            tabelaPrecoId: clientes.tabelaPrecoId,
            cep: clientes.cep,
            logradouro: clientes.logradouro,
            numero: clientes.numero,
            complemento: clientes.complemento,
            bairro: clientes.bairro,
            cidade: clientes.cidade,
            uf: clientes.uf,
          })
          .from(clientes)
          .where(and(eq(clientes.id, dados.clienteId), eq(clientes.ativo, true)))
          .limit(1)
        // A RLS já garante que um id de outra distribuidora não é encontrado —
        // a autorização sai de graça da consulta, sem uma checagem que alguém
        // possa esquecer de escrever na próxima tela.
        if (!linha) return { erro: 'Cliente não encontrado.', tentativa }
        cliente = linha
      }

      /* ------------------------------------------------ o que está sendo vendido */

      const idsPedidos = [...new Set(dados.itens.map((i) => i.produtoId))]
      const catalogo = await tx
        .select({
          id: produtos.id,
          nome: produtos.nome,
          precoPadrao: produtos.precoPadrao,
          custo: produtos.custo,
          retornavel: produtos.retornavel,
          vasilhameId: produtos.vasilhameId,
          controlaEstoque: produtos.controlaEstoque,
        })
        .from(produtos)
        .where(and(inArray(produtos.id, idsPedidos), eq(produtos.ativo, true)))

      if (catalogo.length !== idsPedidos.length) {
        return { erro: 'Um dos produtos do carrinho não está mais disponível.', tentativa }
      }
      const porId = new Map(catalogo.map((p) => [p.id, p]))

      /* ------------------------------------------------------------- o preço
       *
       * A tabela do cliente; na falta dela, a padrão; na falta das duas, o
       * preço do cadastro do produto. Resolvido aqui e não no navegador — ver
       * o cabeçalho de `esquema.ts`.
       */

      let tabelaId = cliente?.tabelaPrecoId ?? null
      if (!tabelaId) {
        const [padrao] = await tx
          .select({ id: tabelasPreco.id })
          .from(tabelasPreco)
          .where(and(eq(tabelasPreco.padrao, true), eq(tabelasPreco.ativo, true)))
          .limit(1)
        tabelaId = padrao?.id ?? null
      }

      const tabelados = new Map<string, string>()
      if (tabelaId) {
        const linhas = await tx
          .select({ produtoId: precos.produtoId, preco: precos.preco })
          .from(precos)
          .where(and(eq(precos.tabelaId, tabelaId), inArray(precos.produtoId, idsPedidos)))
        for (const l of linhas) tabelados.set(l.produtoId, l.preco)
      }

      const precoDe = (produtoId: string) =>
        centavos(Number(tabelados.get(produtoId) ?? porId.get(produtoId)!.precoPadrao))

      /* ------------------------------------------------------------ os totais
       *
       * Tudo em centavos inteiros. Somar `29.90 * 3` em ponto flutuante rende
       * `89.69999999999999`, e o dia em que isso vira `89.69` na nota e `89.70`
       * no caixa é o dia em que ninguém mais confia no relatório.
       */

      const linhas = dados.itens.map((item) => {
        const unitario = precoDe(item.produtoId)
        return { ...item, unitario, total: unitario * item.quantidade }
      })

      const subtotal = linhas.reduce((soma, l) => soma + l.total, 0)
      const desconto = centavos(dados.desconto)

      if (desconto > subtotal) {
        return {
          campos: { desconto: 'O desconto não pode ser maior que o total da venda' },
          tentativa,
        }
      }
      const total = subtotal - desconto
      if (total <= 0) {
        return {
          campos: { desconto: 'A venda ficaria sem valor. Confira o desconto.' },
          tentativa,
        }
      }

      /* --------------------------------------------------- como está pagando */

      const [forma] = await tx
        .select({
          id: formasPagamento.id,
          nome: formasPagamento.nome,
          tipo: formasPagamento.tipo,
          taxaPercentual: formasPagamento.taxaPercentual,
          prazoDias: formasPagamento.prazoDias,
          contaId: formasPagamento.contaId,
        })
        .from(formasPagamento)
        .where(and(eq(formasPagamento.id, dados.formaId), eq(formasPagamento.ativo, true)))
        .limit(1)

      if (!forma) return { campos: { formaId: 'Forma de pagamento não encontrada' }, tentativa }

      const aPrazo = forma.tipo === 'a_prazo'

      if (aPrazo && !cliente) {
        return {
          campos: { clienteId: 'A prazo exige cliente identificado — não existe cobrar depois um "consumidor no balcão"' },
          tentativa,
        }
      }

      // Parcela só existe onde há prazo. Dinheiro em 3× é um dado que só serve
      // para confundir o relatório depois.
      const parcelas = aPrazo || forma.tipo === 'credito' ? dados.parcelas : 1

      /**
       * A taxa da maquininha, descontada na origem.
       *
       * Sem descontar aqui, o dono vê a venda cheia e só descobre a diferença
       * ao conciliar o extrato no fim do mês. A
       * prazo não há taxa — não passou máquina nenhuma.
       */
      const taxa = aPrazo ? 0 : Math.round((total * Number(forma.taxaPercentual)) / 100)

      /* ------------------------------------------------------------- a venda */

      const vendaId = uuidv7()
      const [gravada] = await tx
        .insert(vendas)
        .values({
          id: vendaId,
          companyId: sessao.companyId,
          origem: 'pdv',
          clienteId: cliente?.id ?? null,
          vendedorId: autorDoLancamento(sessao),
          status: 'confirmada',
          subtotal: deCentavos(subtotal).toFixed(2),
          desconto: deCentavos(desconto).toFixed(2),
          total: deCentavos(total).toFixed(2),
          taxas: deCentavos(taxa).toFixed(2),
          // Comissão fica em zero até existir percentual por vendedor no
          // cadastro de usuários. A coluna já existe e a listagem já a mostra;
          // preencher com um número inventado seria pior que mostrar zero.
          comissao: '0',
          parcelas,
          observacao: dados.observacao,
        })
        // `codigo` é atribuído por trigger (`atribuir_codigo`), então precisa
        // voltar do banco: é o número que a operadora dita ao cliente.
        .returning({ codigo: vendas.codigo })

      await tx.insert(vendaItens).values(
        linhas.map((l) => ({
          id: uuidv7(),
          companyId: sessao.companyId,
          vendaId,
          produtoId: l.produtoId,
          quantidade: String(l.quantidade),
          precoUnitario: deCentavos(l.unitario).toFixed(2),
          total: deCentavos(l.total).toFixed(2),
          vasilhameDevolvido: l.vasilhameDevolvido,
        })),
      )

      /* ----------------------------------------------------------- o estoque */

      const controlados = linhas.filter((l) => porId.get(l.produtoId)!.controlaEstoque)
      if (controlados.length > 0) {
        // O custo da saída é o custo médio vigente, não o preço de venda: é ele
        // que vira CMV no DRE. Sem saldo ainda (primeira venda do produto),
        // cai para o custo do cadastro.
        const saldos = await tx
          .select({ produtoId: estoqueSaldos.produtoId, custoMedio: estoqueSaldos.custoMedio })
          .from(estoqueSaldos)
          .where(inArray(estoqueSaldos.produtoId, controlados.map((l) => l.produtoId)))
        const custoPorProduto = new Map(saldos.map((s) => [s.produtoId, Number(s.custoMedio)]))

        await tx.insert(estoqueMovimentos).values(
          controlados.map((l) => {
            const medio = custoPorProduto.get(l.produtoId) ?? 0
            const custo = medio > 0 ? medio : Number(porId.get(l.produtoId)!.custo)
            return {
              id: uuidv7(),
              companyId: sessao.companyId,
              produtoId: l.produtoId,
              // Negativo: saiu. Mesma convenção do vasilhame, de propósito.
              quantidade: String(-l.quantidade),
              tipo: 'venda' as const,
              custoUnitario: custo.toFixed(2),
              origem: 'venda',
              origemId: vendaId,
              usuarioId: autorDoLancamento(sessao),
            }
          }),
        )
      }

      /* --------------------------------------------------------- o vasilhame
       *
       * Venda avulsa não gera comodato, e isso é uma decisão e não uma falha:
       * `entregue` é uma dívida, e dívida precisa de devedor. Sem cliente
       * identificado não há a quem cobrar o galão — e um saldo pendurado em
       * ninguém é exatamente o número que ninguém consegue explicar depois.
       */

      let vasilhameEntregue = 0
      let vasilhameDevolvido = 0

      if (cliente) {
        const movimentos: (typeof vasilhameMovimentos.$inferInsert)[] = []
        const galoes = [
          ...new Set(
            linhas
              .map((l) => porId.get(l.produtoId)!.vasilhameId)
              .filter((v): v is string => Boolean(v)),
          ),
        ]
        const custoGalao = new Map<string, string>()
        if (galoes.length > 0) {
          const linhasGalao = await tx
            .select({ id: produtos.id, custo: produtos.custo })
            .from(produtos)
            .where(inArray(produtos.id, galoes))
          for (const g of linhasGalao) custoGalao.set(g.id, g.custo)
        }

        for (const l of linhas) {
          const produto = porId.get(l.produtoId)!
          if (!produto.retornavel || !produto.vasilhameId) continue
          const custo = custoGalao.get(produto.vasilhameId) ?? '0'

          movimentos.push({
            id: uuidv7(),
            companyId: sessao.companyId,
            clienteId: cliente.id,
            produtoId: produto.vasilhameId,
            quantidade: l.quantidade,
            motivo: 'entregue',
            origem: 'venda',
            origemId: vendaId,
            custoUnitario: custo,
            usuarioId: autorDoLancamento(sessao),
          })
          vasilhameEntregue += l.quantidade

          if (l.vasilhameDevolvido > 0) {
            movimentos.push({
              id: uuidv7(),
              companyId: sessao.companyId,
              clienteId: cliente.id,
              produtoId: produto.vasilhameId,
              // O sinal é do motivo, nunca do que a tela digitou. `devolvido`
              // é entrada: o galão voltou.
              quantidade: -l.vasilhameDevolvido,
              motivo: 'devolvido',
              origem: 'venda',
              origemId: vendaId,
              custoUnitario: custo,
              usuarioId: autorDoLancamento(sessao),
            })
            vasilhameDevolvido += l.vasilhameDevolvido
          }
        }

        if (movimentos.length > 0) await tx.insert(vasilhameMovimentos).values(movimentos)
      }

      /* ------------------------------------------- o dinheiro (ou a promessa) */

      const hoje = dataNaLoja()
      let primeiroVencimento: string | null = null

      if (aPrazo) {
        /**
         * A prazo não entra no caixa. Vira título — e o título é por parcela,
         * porque é assim que a cobrança acontece: o mercadinho paga R$ 400 no
         * dia 30, não R$ 1.200 "em algum momento".
         *
         * O resto da divisão vai na última parcela. Dividir R$ 100 em 3 e
         * gravar 33,33 três vezes perde um centavo — e um centavo por venda,
         * num ano, é a diferença que faz a operadora desconfiar do sistema.
         */
        const base = Math.floor(total / parcelas)
        const sobra = total - base * parcelas

        await tx.insert(contasReceber).values(
          Array.from({ length: parcelas }, (_, i) => {
            const vencimento = dataNaLoja(forma.prazoDias + i * 30)
            if (i === 0) primeiroVencimento = vencimento
            return {
              id: uuidv7(),
              companyId: sessao.companyId,
              origem: 'PDV',
              vendaId,
              clienteId: cliente!.id,
              descricao: `Venda ${gravada?.codigo ?? ''}`.trim(),
              emissao: hoje,
              valorTotal: deCentavos(total).toFixed(2),
              parcelaNumero: i + 1,
              parcelaTotal: parcelas,
              valorParcela: deCentavos(i === parcelas - 1 ? base + sobra : base).toFixed(2),
              vencimento,
              formaId: forma.id,
              contaId: forma.contaId,
            }
          }),
        )
      } else {
        await tx.insert(pagamentos).values({
          id: uuidv7(),
          companyId: sessao.companyId,
          vendaId,
          formaId: forma.id,
          contaId: forma.contaId,
          valor: deCentavos(total).toFixed(2),
          taxa: deCentavos(taxa).toFixed(2),
        })

        // Sem conta configurada não há caixa a movimentar. A venda continua
        // válida: o buraco está no cadastro da forma de pagamento, e travar a
        // venda por causa dele puniria a operadora por um erro do cadastro.
        if (forma.contaId) {
          await tx.insert(caixaMovimentos).values({
            id: uuidv7(),
            companyId: sessao.companyId,
            contaId: forma.contaId,
            data: hoje,
            sentido: 'entrada',
            // Líquido, não bruto: o caixa mostra o que entrou de verdade.
            valor: deCentavos(total - taxa).toFixed(2),
            categoria: 'Venda',
            descricao: `Venda ${gravada?.codigo ?? ''} · ${forma.nome}`.trim(),
            origem: 'venda',
            origemId: vendaId,
            usuarioId: autorDoLancamento(sessao),
          })
        }
      }

      /* --------------------------------------------------------- o comprovante */

      // Lido depois dos inserts, já com o trigger de saldo aplicado: é o número
      // que a operadora repete para o cliente antes dele sair do balcão.
      let saldoVasilhame: number | null = null
      if (cliente) {
        const [linha] = await tx
          .select({ total: sql<number>`coalesce(sum(${vasilhameSaldos.quantidade}), 0)::int` })
          .from(vasilhameSaldos)
          .where(eq(vasilhameSaldos.clienteId, cliente.id))
        saldoVasilhame = linha?.total ?? 0
      }

      const recebido = centavos(dados.valorRecebido)
      const troco =
        forma.tipo === 'dinheiro' && recebido > total ? deCentavos(recebido - total) : null

      // CNPJ/CPF e telefone da distribuidora, para o cabeçalho do cupom — o
      // cliente confere quem vendeu, não só quem comprou.
      const [dadosEmpresa] = await tx
        .select({ documento: companies.documento, telefone: companies.telefone })
        .from(companies)
        .where(eq(companies.id, sessao.companyId))
        .limit(1)

      revalidarTudo()

      return {
        tentativa,
        recibo: {
          vendaId,
          codigo: gravada?.codigo ?? null,
          cliente: cliente?.nome ?? null,
          clienteEndereco: cliente ? formatarEndereco(cliente) : null,
          empresa: sessao.empresa,
          empresaDocumento: dadosEmpresa?.documento ? formatarDocumento(dadosEmpresa.documento) : null,
          empresaTelefone: dadosEmpresa?.telefone ? formatarTelefone(dadosEmpresa.telefone) : null,
          vendedor: sessao.nome,
          emitidoEm: formatarDataHora(new Date()),
          itens: linhas.length,
          itensDetalhe: linhas.map((l) => ({
            produto: porId.get(l.produtoId)!.nome,
            quantidade: l.quantidade,
            precoUnitario: deCentavos(l.unitario),
            total: deCentavos(l.total),
          })),
          subtotal: deCentavos(subtotal),
          desconto: deCentavos(desconto),
          total: deCentavos(total),
          forma: forma.nome,
          aPrazo,
          parcelas,
          primeiroVencimento: primeiroVencimento ? formatarDataISO(primeiroVencimento) : null,
          taxa: deCentavos(taxa),
          troco,
          vasilhameEntregue,
          vasilhameDevolvido,
          saldoVasilhame,
        },
      }
    })
  } catch (err) {
    return { erro: descreverFalha(err), tentativa }
  }
}
