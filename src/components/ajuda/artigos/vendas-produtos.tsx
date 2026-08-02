import Link from 'next/link'
import { SecaoArtigo } from '@/components/ajuda/artigo-layout'
import { Passo, Passos } from '@/components/ajuda/passo'
import { Video } from '@/components/ajuda/video'
import { Dica } from '@/components/ajuda/callouts'
import { Faq, ListaFaq } from '@/components/ajuda/faq'

export function ArtigoVendasProdutos() {
  return (
    <>
      <SecaoArtigo titulo="Para que serve">
        <p>
          É a lista de tudo que foi vendido no <Link href="/ajuda/vendas/pdv">PDV</Link>: quanto
          entrou no caixa, quanto ficou a receber e quanto a maquininha descontou de taxa. É a
          tela para conferir o dia, não para vender.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="Onde encontrar">
        <p>
          Menu <strong>Vendas → Vendas de Produtos</strong>. Você também chega aqui pelo botão{' '}
          <strong>Ver vendas</strong>, no topo do <Link href="/ajuda/vendas/pdv">PDV</Link>.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="Como ler a tela">
        <Video
          src="/ajuda/vendas-produtos.gif"
          poster="/ajuda/vendas-produtos.png"
          legenda="Os quatro cartões de métrica, a lista de vendas e a busca por cliente ou código"
        />

        <Passos>
          <Passo numero={1} titulo="Comece pelos quatro cartões do topo">
            <p>
              Vendido hoje, vendido no mês, ticket médio e taxas no mês. É a leitura de dez
              segundos antes de abrir qualquer linha — o cartão de taxas mostra quanto a
              maquininha já levou, um número que costuma passar despercebido no fim do mês.
            </p>
          </Passo>

          <Passo numero={2} titulo="Use a busca para achar uma venda">
            <p>
              Busque por cliente, código ou forma de pagamento. Cada linha mostra o valor da
              venda, o quanto já foi recebido, a taxa descontada e o que ainda está a receber —
              as três últimas colunas nunca se sobrepõem: uma venda à vista soma tudo em Recebido,
              uma a prazo soma tudo em A Receber.
            </p>
          </Passo>

          <Passo numero={3} titulo="Abra uma nova venda quando precisar">
            <p>
              O botão <strong>Nova venda</strong>, no topo da tabela, leva direto ao{' '}
              <Link href="/ajuda/vendas/pdv">PDV</Link>.
            </p>
          </Passo>
        </Passos>
      </SecaoArtigo>

      <SecaoArtigo titulo="Erros comuns">
        <Dica titulo="Por que uma venda no cartão mostra menos em 'Recebido' do que o valor da venda?">
          A diferença é a taxa da maquininha, na coluna <strong>Taxas</strong> — ela nunca chega a
          entrar no caixa. Somando Recebido e Taxas você volta ao valor cheio da venda.
        </Dica>
      </SecaoArtigo>

      <SecaoArtigo titulo="Perguntas frequentes">
        <ListaFaq>
          <Faq pergunta="Esta tela atualiza na hora?">
            Sim. Toda venda fechada no <Link href="/ajuda/vendas/pdv">PDV</Link> aparece aqui no
            instante seguinte, junto com os quatro cartões de métrica no topo.
          </Faq>
          <Faq pergunta="O que significa uma linha com 'A Receber' em vermelho?">
            É uma venda a prazo cujo prazo ainda não venceu ou o cliente ainda não pagou. O título
            correspondente está em Contas a Receber, no menu Financeiro.
          </Faq>
          <Faq pergunta="Dá para editar ou excluir uma venda daqui?">
            Não. A listagem é só para consulta — uma venda fechada não é editada nem removida.
          </Faq>
        </ListaFaq>
      </SecaoArtigo>
    </>
  )
}
