import Link from 'next/link'
import { SecaoArtigo } from '@/components/ajuda/artigo-layout'
import { Passo, Passos } from '@/components/ajuda/passo'
import { Video } from '@/components/ajuda/video'
import { Atencao, Dica } from '@/components/ajuda/callouts'
import { Faq, ListaFaq } from '@/components/ajuda/faq'

/**
 * A tela que a operadora abre mais vezes por dia. O texto segue a ordem real
 * do balcão: escolher o produto, ajustar quantidade, só depois cliente e
 * pagamento — é a mesma ordem em que a tela pede as coisas.
 */
export function ArtigoPdv() {
  return (
    <>
      <SecaoArtigo titulo="Para que serve">
        <p>
          É a venda de balcão: escolher produto, fechar em dinheiro, cartão ou a prazo, e
          registrar o vasilhame que o cliente levou ou devolveu — tudo na mesma tela, sem trocar
          de aba no meio do atendimento.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="Onde encontrar">
        <p>
          Menu <strong>Vendas → PDV</strong>. É a primeira tela do grupo, e a que abre sozinha
          quando você clica em <strong>Nova venda</strong> em qualquer lugar do sistema.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="Como fechar uma venda">
        <Video
          src="/ajuda/pdv.gif"
          poster="/ajuda/pdv.png"
          legenda="Venda completa: escolher o produto, registrar o vasilhame devolvido, o cliente e a forma de pagamento, e fechar"
        />

        <Passos>
          <Passo numero={1} titulo="Clique no produto para adicionar">
            <p>
              Cada clique soma uma unidade ao carrinho — não existe um formulário de &ldquo;adicionar
              item&rdquo; separado. Para achar rápido, digite parte do nome ou o código na busca; <kbd className="rounded border border-borda bg-superficie-afundada px-1 py-0.5 text-2xs">Enter</kbd>{' '}
              adiciona o primeiro resultado sem tirar a mão do teclado.
            </p>
          </Passo>

          <Passo numero={2} titulo="Ajuste a quantidade e o vasilhame devolvido">
            <p>
              Os botões <strong>−</strong> e <strong>+</strong> da linha do carrinho mudam a
              quantidade. Quando o produto é retornável e há um cliente escolhido, aparece um
              segundo contador: quantos galões vazios ele trouxe agora. É o comodato sendo
              acertado no mesmo instante da venda, sem depender de outra tela depois.
            </p>
          </Passo>

          <Passo numero={3} titulo="Escolha o cliente, se houver um">
            <p>
              O cliente é opcional — sem ele, a venda fica como consumidor de balcão. Assim que
              você escolhe um, a tela mostra quantos galões ele já está devendo e quanto tem em
              aberto no financeiro, antes de fechar a venda.
            </p>
          </Passo>

          <Passo numero={4} titulo="Escolha a forma de pagamento">
            <p>
              Dinheiro mostra o campo de valor recebido e calcula o troco. Cartão informa a taxa
              da maquininha, que é descontada do que entra no caixa. A prazo pede o número de
              parcelas e não gera nenhum valor em caixa — a venda inteira vira título em{' '}
              <strong>Contas a Receber</strong>.
            </p>
          </Passo>

          <Passo numero={5} titulo="Feche e confira o comprovante">
            <p>
              O comprovante fica na tela com o total, o troco (se houver) e o saldo de vasilhame
              do cliente depois da venda. Repita esses números para ele antes que saia do balcão.
              Clicando em <strong>Ver cupom</strong>, abre o cupom completo — nome e endereço do
              cliente, cada item vendido e a distribuidora — pronto para <strong>Imprimir
              cupom</strong> e entregar junto com a mercadoria.
            </p>
          </Passo>
        </Passos>
      </SecaoArtigo>

      <SecaoArtigo titulo="Erros comuns">
        <Atencao titulo="Vendeu vasilhame sem escolher cliente?">
          A tela avisa em laranja, mas deixa fechar a venda. Sem cliente identificado, não existe
          quem cobrar depois — o comodato daquele galão simplesmente não é registrado. Volte e
          escolha o cliente antes de fechar, sempre que o produto for retornável.
        </Atencao>
        <Dica titulo="O preço muda sozinho ao escolher o cliente?">
          É esperado. Cada cliente pode ter uma tabela de preço própria; a tela busca o valor
          certo assim que você o escolhe. Quem decide o preço final, de qualquer forma, é o
          servidor no momento de fechar — a tela só antecipa o número para você conferir antes.
        </Dica>
      </SecaoArtigo>

      <SecaoArtigo titulo="Perguntas frequentes">
        <ListaFaq>
          <Faq pergunta="Posso fechar uma venda sem escolher forma de pagamento?">
            Não precisa escolher — o PDV já abre com uma forma padrão selecionada. Você só troca
            quando o pagamento for diferente do usual.
          </Faq>
          <Faq pergunta="Por que aparece uma linha de 'taxa' na venda no cartão?">
            É o quanto a maquininha cobra por aquela transação. A tela mostra o valor da venda e,
            logo abaixo, quanto realmente entra no caixa depois da taxa descontada — os dois
            números nunca deveriam ser confundidos.
          </Faq>
          <Faq pergunta="O que acontece com uma venda a prazo?">
            Ela gera um título — ou várias parcelas — em <strong>Contas a Receber</strong>, com o
            primeiro vencimento mostrado no próprio comprovante. Nada entra no caixa nesse
            momento.
          </Faq>
          <Faq pergunta="Errei uma venda. Como corrijo?">
            Hoje não existe uma tela para cancelar ou editar uma venda já fechada. Se o engano foi
            só no vasilhame, corrija o saldo em{' '}
            <Link href="/ajuda/vasilhame/baixa-vasilhame">Baixa de Vasilhame</Link>. Se foi no
            valor cobrado, ajuste diretamente em <strong>Contas a Receber</strong>, no menu
            Financeiro.
          </Faq>
          <Faq pergunta="Onde vejo as vendas depois de fechadas?">
            Em <Link href="/ajuda/vendas/vendas-produtos">Vendas de Produtos</Link>, com data,
            cliente, valor e o que ainda está a receber.
          </Faq>
          <Faq pergunta="Dá para dar desconto em porcentagem?">
            Sim. Ao lado do campo <strong>Desconto</strong> há dois botões, <strong>R$</strong> e{' '}
            <strong>%</strong>. Alternando para %, a tela mostra embaixo do campo quanto aquele
            percentual representa em reais, antes de fechar a venda.
          </Faq>
          <Faq pergunta="Como entrego um cupom impresso para o cliente?">
            No comprovante que aparece depois de fechar a venda, clique em{' '}
            <strong>Ver cupom</strong>. Ele mostra o nome e endereço do cliente (quando
            cadastrados), cada item vendido e a distribuidora. O botão{' '}
            <strong>Imprimir cupom</strong> abre a impressão só dele, sem o resto da tela.
          </Faq>
          <Faq pergunta="Saí da tela no meio de uma venda. Perdi tudo?">
            Não. O carrinho, o cliente, a forma de pagamento e o desconto ficam salvos neste
            navegador até a venda ser fechada — mesmo trocando de tela, fechando a aba ou
            desligando o computador. Ao voltar para o PDV, tudo reaparece do jeito que estava.
          </Faq>
        </ListaFaq>
      </SecaoArtigo>
    </>
  )
}
