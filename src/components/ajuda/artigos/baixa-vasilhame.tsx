import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { SecaoArtigo } from '@/components/ajuda/artigo-layout'
import { Passo, Passos } from '@/components/ajuda/passo'
import { Video } from '@/components/ajuda/video'
import { Dica, Importante } from '@/components/ajuda/callouts'
import { Faq, ListaFaq } from '@/components/ajuda/faq'

/**
 * O artigo mais importante da Central. `Baixa de Vasilhame` é a tela que não
 * existe no Fature — é por causa dela que a JM está trocando de sistema.
 * O corpo segue a mesma ordem da tela de verdade: motivo primeiro, e a
 * pergunta "isto é uma venda?" respondida antes de qualquer passo.
 */
export function ArtigoBaixaVasilhame() {
  return (
    <>
      <Importante titulo="Baixa de vasilhame nunca é venda">
        <p>
          Nada aqui gera receita nem entra no caixa. Escolher <strong>Quebrado</strong>,{' '}
          <strong>Trincado</strong> ou <strong>Perdido pelo cliente</strong> lança o galão como
          custo do mês — é a mesma informação que, no sistema antigo, virava uma venda de R$ 0,13
          e inflava o faturamento sem ninguém perceber.
        </p>
      </Importante>

      <SecaoArtigo titulo="Onde encontrar">
        <p>
          Menu <strong>Vasilhame → Baixa de Vasilhame</strong>. É a segunda tela que a operadora
          mais abre no dia — só perde para o PDV.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="Como lançar">
        <Video
          src="/ajuda/baixa-vasilhame.gif"
          poster="/ajuda/baixa-vasilhame.png"
          legenda="Baixa de um galão devolvido, do motivo ao recibo com o novo saldo do cliente"
        />

        <Passos>
          <Passo numero={1} titulo="Escolha o que aconteceu com o galão">
            <p>
              É o primeiro campo da tela, em botões — não um menu escondido. Os oito motivos
              existem porque cada um significa uma coisa diferente para o saldo do cliente e para
              o resultado do mês:
            </p>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              <li>
                <Badge variant="sucesso" className="mr-1.5">
                  devolvido
                </Badge>
                cliente trouxe de volta, inteiro
              </li>
              <li>
                <Badge variant="info" className="mr-1.5">
                  entregue
                </Badge>
                cliente levou e passa a dever
              </li>
              <li>
                <Badge variant="perigo" className="mr-1.5">
                  quebrado
                </Badge>
                inutilizado — vira custo
              </li>
              <li>
                <Badge variant="alerta" className="mr-1.5">
                  trincado
                </Badge>
                fora de uso, inteiro — vira custo
              </li>
              <li>
                <Badge variant="perigo" className="mr-1.5">
                  perdido
                </Badge>
                cliente não vai devolver — vira custo
              </li>
              <li>
                <Badge variant="neutro" className="mr-1.5">
                  enviado à fábrica
                </Badge>
                transferência interna, sem cliente
              </li>
              <li>
                <Badge variant="neutro" className="mr-1.5">
                  retornou da fábrica
                </Badge>
                voltou do envase
              </li>
              <li>
                <Badge variant="neutro" className="mr-1.5">
                  ajuste de inventário
                </Badge>
                acerto de contagem, depois de conferir
              </li>
            </ul>
            <p>
              O selo <Badge variant="perigo">custo</Badge> aparece ao lado dos três motivos que
              viram perda — é o aviso antes do aviso.
            </p>
          </Passo>

          <Passo numero={2} titulo="Escolha o vasilhame e digite a quantidade">
            <p>
              A quantidade é sempre um número positivo — você nunca digita sinal de mais ou de
              menos. O sistema sabe se o galão está saindo ou voltando pelo motivo escolhido no
              passo 1. Os botões <strong>−</strong> e <strong>+</strong> ao lado do campo cobrem o
              caso mais comum, que é lançar 1 ou 2 por vez.
            </p>
          </Passo>

          <Passo numero={3} titulo="Escolha o cliente (quando o motivo pedir)">
            <p>
              Motivos que envolvem cliente — entregue, devolvido, perdido — pedem o nome; motivos
              internos de fábrica não mostram esse campo. Assim que você escolhe o cliente, a tela
              conta o que ele já está devendo daquele vasilhame, <em>antes</em> de você gravar —
              é a conferência que evita descobrir um saldo negativo semanas depois.
            </p>
          </Passo>

          <Passo numero={4} titulo="Lance e confira o recibo">
            <p>
              O recibo fica na tela depois de lançar, com o novo saldo do cliente — repita esse
              número para ele antes de ele sair do balcão. Se o motivo foi um dos três que geram
              custo, o recibo confirma: <em>nenhuma receita foi gerada</em>.
            </p>
          </Passo>
        </Passos>
      </SecaoArtigo>

      <SecaoArtigo titulo="Erros comuns">
        <Dica titulo="Cliente devolveu mais do que estava levando?">
          A tela mostra um aviso de saldo negativo, mas deixa lançar — geralmente é porque um
          lançamento anterior ficou faltando. Depois de gravar, confira o{' '}
          <Link href="/ajuda/vasilhame/saldo-vasilhame">extrato do cliente</Link> para achar a
          diferença.
        </Dica>
        <Dica titulo="Vasilhame sem custo cadastrado?">
          Uma perda registrada sem custo aparece de graça no relatório do mês — a tela avisa e
          leva direto ao cadastro do produto para corrigir.
        </Dica>
      </SecaoArtigo>

      <SecaoArtigo titulo="Perguntas frequentes">
        <ListaFaq>
          <Faq pergunta="Lancei o motivo errado. Como corrijo?">
            Não dá para editar um lançamento — ele é imutável de propósito, para o histórico
            nunca mentir sobre o que foi digitado na hora. Vá em{' '}
            <Link href="/ajuda/vasilhame/movimentos-vasilhame">Movimentos</Link> e estorne o
            lançamento; depois lance de novo com o motivo certo.
          </Faq>
          <Faq pergunta="Preciso escolher um cliente em toda baixa?">
            Não. Galão quebrado no depósito, por exemplo, não tem cliente — o campo some da tela
            quando o motivo não precisa dele.
          </Faq>
          <Faq pergunta="Isso aparece em algum relatório de vendas?">
            Nunca. Baixa de vasilhame é evento de estoque, não de venda — ela só aparece no
            relatório de <Link href="/ajuda/vasilhame/movimentos-vasilhame">Movimentos</Link> e,
            quando é perda, como linha de custo no DRE.
          </Faq>
        </ListaFaq>
      </SecaoArtigo>
    </>
  )
}
