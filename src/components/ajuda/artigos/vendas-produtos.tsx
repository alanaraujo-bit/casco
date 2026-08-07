import Link from 'next/link'
import { SecaoArtigo } from '@/components/ajuda/artigo-layout'
import { Passo, Passos } from '@/components/ajuda/passo'
import { Video } from '@/components/ajuda/video'
import { Atencao, Dica } from '@/components/ajuda/callouts'
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
              Busque por cliente, entregador, código ou forma de pagamento. Cada linha mostra o
              valor da venda, o quanto já foi recebido, a taxa descontada e o que ainda está a
              receber — as três últimas colunas nunca se sobrepõem: uma venda à vista soma tudo em
              Recebido, uma a prazo soma tudo em A Receber. Logo depois do cliente vêm{' '}
              <strong>Entregador</strong> e <strong>Água</strong>: quem foi levar e quantos galões
              saíram naquela venda.
            </p>
          </Passo>

          <Passo numero={3} titulo="Clique na linha para abrir a venda inteira">
            <p>
              A tela da venda reúne o que antes exigia abrir três telas: os itens vendidos, como
              foi pago, as parcelas em Contas a Receber e o vasilhame que saiu ou voltou. É onde se
              confere <em>por que</em> um número ficou daquele jeito.
            </p>
            <p>
              Ali também dá para <strong>marcar quem entregou</strong> e escrever uma observação,
              mesmo com a venda já fechada — é o caso comum do balcão cheio, que fecha a venda
              primeiro e resolve a rota depois. Assim que você salva, a venda entra no{' '}
              <Link href="/ajuda/relatorios/desempenho-entregadores">
                Desempenho dos Entregadores
              </Link>
              .
            </p>
          </Passo>

          <Passo numero={4} titulo="Abra uma nova venda quando precisar">
            <p>
              O botão <strong>Nova venda</strong>, no topo da tabela, leva direto ao{' '}
              <Link href="/ajuda/vendas/pdv">PDV</Link>.
            </p>
          </Passo>

          <Passo numero={5} titulo="Cancele uma venda lançada errada">
            <p>
              Na coluna <strong>Ações</strong>, clique no ícone de cancelar e confirme. A venda não
              some da lista — ela ganha o selo <strong>Cancelada</strong> e continua ali como
              registro. O estoque baixado volta, o comodato entregue é desfeito e o dinheiro que
              tinha entrado no caixa sai de novo, como um lançamento de estorno.
            </p>
            <p>
              Só quem tem papel de <strong>dono</strong> vê esse botão e consegue editar ou marcar
              entregador numa venda já fechada. Operador enxerga a listagem e cada venda por
              inteiro, mas não altera nada aqui.
            </p>
          </Passo>
        </Passos>
      </SecaoArtigo>

      <SecaoArtigo titulo="Erros comuns">
        <Dica titulo="Por que uma venda no cartão mostra menos em 'Recebido' do que o valor da venda?">
          A diferença é a taxa da maquininha, na coluna <strong>Taxas</strong> — ela nunca chega a
          entrar no caixa. Somando Recebido e Taxas você volta ao valor cheio da venda.
        </Dica>
        <Atencao titulo="Venda a prazo com parcela já recebida não cancela direto">
          Primeiro desfaça a baixa da parcela em <strong>Contas a Receber</strong>, no menu
          Financeiro. Cancelar uma venda com dinheiro já baixado devolveria ao caixa um valor que
          ninguém decidiu devolver — a tela pede esse passo antes, de propósito.
        </Atencao>
        <Dica titulo="O botão de cancelar não aparece para mim">
          Só contas com papel de dono cancelam ou editam uma venda. As demais contas veem a
          listagem e cada venda por inteiro, sem esse botão — fale com quem administra o Casco na
          distribuidora se precisar cancelar algo.
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
            Abrindo a venda, dá para mudar duas coisas: <strong>quem entregou</strong> e a{' '}
            <strong>observação</strong>. Item, quantidade, preço e forma de pagamento não — cada um
            deles já virou saída de estoque, entrada de caixa, título a receber e saldo de
            vasilhame, e mudar só a venda deixaria as outras telas discordando dela em silêncio.
            Venda errada se refaz. Excluir de vez também não — o que existe é cancelar: a venda
            fica na lista com o selo Cancelada, e tudo que ela gerou (estoque, comodato, caixa,
            título a receber) é desfeito. É assim que estoque e caixa continuam explicáveis pelo
            histórico que os gerou, em vez de uma linha que simplesmente sumiu. As duas ações são
            só para quem tem papel de dono.
          </Faq>
          <Faq pergunta="A coluna Água conta o quê?">
            Tudo que é produto de categoria água naquela venda — galão retornável ou garrafa
            descartável, os dois entram. Quanto vasilhame ficou de comodato é outra pergunta,
            respondida no bloco "Vasilhame movimentado" dentro da venda.
          </Faq>
          <Faq pergunta="Cancelar uma venda cancelada de novo funciona?">
            Não é preciso — e a tela nem oferece o botão. Uma venda já cancelada mostra só o selo,
            sem ação ao lado.
          </Faq>
        </ListaFaq>
      </SecaoArtigo>
    </>
  )
}
