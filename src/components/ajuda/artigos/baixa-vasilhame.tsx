import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { SecaoArtigo } from '@/components/ajuda/artigo-layout'
import { Passo, Passos } from '@/components/ajuda/passo'
import { Video } from '@/components/ajuda/video'
import { Dica, Importante } from '@/components/ajuda/callouts'
import { Faq, ListaFaq } from '@/components/ajuda/faq'

/**
 * O artigo mais importante da Central.
 *
 * Ensina o Casco por si só: nada aqui compara com outro sistema, porque quem
 * lê pode nunca ter usado um. O texto fala direto com a pessoa ("você"), na
 * mesma ordem em que a tela pergunta as coisas.
 */
export function ArtigoBaixaVasilhame() {
  return (
    <>
      <Importante titulo="Baixa de vasilhame não é venda">
        <p>
          Nada nesta tela gera receita nem entra no caixa. Quando você escolhe{' '}
          <strong>Quebrado</strong>, <strong>Trincado</strong> ou{' '}
          <strong>Perdido pelo cliente</strong>, o galão sai do patrimônio e entra como custo do
          mês. O faturamento do dia não muda — e é isso que mantém o número do faturamento
          confiável.
        </p>
      </Importante>

      <SecaoArtigo titulo="Onde encontrar">
        <p>
          Menu <strong>Vasilhame → Baixa de Vasilhame</strong>. É uma das telas que você mais
          abre no dia a dia do balcão.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="Como lançar">
        <Video
          src="/ajuda/baixa-vasilhame.gif"
          poster="/ajuda/baixa-vasilhame.png"
          legenda="Lançamento completo: escolher o motivo, informar quantidade e cliente, e conferir o comprovante com o novo saldo"
        />

        <Passos>
          <Passo numero={1} titulo="Escolha o que aconteceu com o galão">
            <p>
              É o primeiro campo da tela, em botões grandes. Cada motivo significa uma coisa
              diferente para o saldo do cliente e para o resultado do mês:
            </p>
            {/* Uma coluna, com o selo numa célula de largura fixa: em duas
                colunas os textos têm comprimentos diferentes, as linhas
                desalinham e a lista fica esfarrapada justamente onde ela
                precisa ser consultada de relance. */}
            <ul className="divide-y divide-borda rounded-md border border-borda">
              {[
                ['sucesso', 'devolvido', 'o cliente trouxe de volta, inteiro'],
                ['info', 'entregue', 'o cliente levou e passa a dever'],
                ['perigo', 'quebrado', 'inutilizado — vira custo'],
                ['alerta', 'trincado', 'fora de uso, inteiro — vira custo'],
                ['perigo', 'perdido', 'o cliente não vai devolver — vira custo'],
                ['neutro', 'enviado à fábrica', 'transferência interna, sem cliente'],
                ['neutro', 'retornou da fábrica', 'voltou do envase'],
                ['neutro', 'ajuste de inventário', 'acerto de contagem, depois de conferir'],
              ].map(([tom, motivo, explicacao]) => (
                <li key={motivo} className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 px-3 py-2">
                  <Badge
                    variant={tom as 'sucesso' | 'info' | 'perigo' | 'alerta' | 'neutro'}
                    // Largura fixa só onde há largura de sobra: no celular ela
                    // comeria a linha inteira e espremeria a explicação numa
                    // coluna de três palavras.
                    className="shrink-0 sm:w-[11rem] sm:justify-center"
                  >
                    {motivo}
                  </Badge>
                  <span className="min-w-0 flex-1">{explicacao}</span>
                </li>
              ))}
            </ul>
            <p>
              O selo <Badge variant="perigo">custo</Badge> aparece ao lado dos três motivos que
              geram perda, para você ver antes de escolher.
            </p>
          </Passo>

          <Passo numero={2} titulo="Escolha o vasilhame e informe a quantidade">
            <p>
              A quantidade é sempre um número positivo — você nunca digita sinal de mais ou de
              menos. O sistema já sabe, pelo motivo do passo 1, se o galão está saindo ou
              voltando. Os botões <strong>−</strong> e <strong>+</strong> ao lado do campo
              resolvem o caso mais comum, que é lançar 1 ou 2 por vez.
            </p>
          </Passo>

          <Passo numero={3} titulo="Escolha o cliente, quando o motivo pedir">
            <p>
              Motivos que envolvem cliente — entregue, devolvido, perdido — pedem o nome.
              Motivos internos de fábrica nem mostram esse campo. Assim que você escolhe o
              cliente, a tela informa quantos galões daquele tipo ele já tem, <em>antes</em> de
              você gravar. Confira esse número com o que ele está trazendo: é a hora de resolver
              qualquer diferença, com ele ainda no balcão.
            </p>
          </Passo>

          <Passo numero={4} titulo="Lance e confira o comprovante">
            <p>
              Depois de lançar, o comprovante fica na tela com o novo saldo do cliente. Repita
              esse número para ele antes que saia. Se o motivo gerou custo, o comprovante
              confirma: <em>nenhuma receita foi gerada</em>.
            </p>
          </Passo>
        </Passos>
      </SecaoArtigo>

      <SecaoArtigo titulo="Erros comuns">
        <Dica titulo="O cliente está devolvendo mais do que levou?">
          A tela mostra um aviso de saldo negativo, mas deixa você lançar — normalmente é porque
          uma entrega anterior não chegou a ser registrada. Depois de gravar, abra o{' '}
          <Link href="/ajuda/vasilhame/saldo-vasilhame">extrato do cliente</Link> para encontrar
          a diferença.
        </Dica>
        <Dica titulo="Vasilhame sem custo cadastrado?">
          Uma perda lançada sem custo aparece valendo zero no resultado do mês. A tela avisa e
          leva direto ao cadastro do produto para você preencher.
        </Dica>
      </SecaoArtigo>

      <SecaoArtigo titulo="Perguntas frequentes">
        <ListaFaq>
          <Faq pergunta="Lancei o motivo errado. Como corrijo?">
            Lançamentos não são editados — ficam registrados exatamente como foram feitos, para
            o histórico sempre refletir o que aconteceu. Vá em{' '}
            <Link href="/ajuda/vasilhame/movimentos-vasilhame">Movimentos</Link>, estorne o
            lançamento e faça um novo com o motivo certo.
          </Faq>
          <Faq pergunta="Preciso escolher um cliente em toda baixa?">
            Não. Um galão quebrado no depósito, por exemplo, não tem cliente — o campo some da
            tela quando o motivo não precisa dele.
          </Faq>
          <Faq pergunta="Isso aparece em algum relatório de vendas?">
            Não. Baixa de vasilhame é movimento de estoque, não venda. Ela aparece em{' '}
            <Link href="/ajuda/vasilhame/movimentos-vasilhame">Movimentos</Link> e, quando é
            perda, como linha de custo no DRE.
          </Faq>
        </ListaFaq>
      </SecaoArtigo>
    </>
  )
}
