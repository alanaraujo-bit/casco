import Link from 'next/link'
import { SecaoArtigo } from '@/components/ajuda/artigo-layout'
import { Passo, Passos } from '@/components/ajuda/passo'
import { Video } from '@/components/ajuda/video'
import { Importante } from '@/components/ajuda/callouts'
import { Faq, ListaFaq } from '@/components/ajuda/faq'

export function ArtigoMovimentosVasilhame() {
  return (
    <>
      <SecaoArtigo titulo="Para que serve">
        <p>
          É o histórico completo do vasilhame: todo galão que entrou, saiu ou se perdeu, um por
          um, com o motivo e quem lançou. É onde você confere o mês e onde corrige um lançamento
          errado.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="Onde encontrar">
        <p>
          Menu <strong>Vasilhame → Movimentos</strong>. Você também chega aqui pelo botão{' '}
          <strong>Ver movimentos</strong>, no topo da tela de{' '}
          <Link href="/ajuda/vasilhame/baixa-vasilhame">Baixa de Vasilhame</Link>.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="A perda do mês, no topo da tela">
        <p>
          Um cartão por mês mostra quanto custou o vasilhame perdido — quebrado, trincado ou não
          devolvido — com o detalhamento por motivo ao lado. Esse valor é custo: nenhum desses
          lançamentos entra no faturamento nem no caixa.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="Como estornar um lançamento errado">
        <Video
          src="/ajuda/movimentos-vasilhame.gif"
          poster="/ajuda/movimentos-vasilhame.png"
          legenda="Estorno completo: localizar o lançamento, tocar em Estornar e confirmar — a linha de estorno aparece no histórico"
        />

        <Importante titulo="Lançamento não se edita — se estorna">
          Todo lançamento fica registrado do jeito que foi feito. Para corrigir um motivo ou uma
          quantidade errada, você estorna o lançamento e faz um novo, certo, em{' '}
          <Link href="/ajuda/vasilhame/baixa-vasilhame">Baixa de Vasilhame</Link>. É o que
          garante que o histórico sempre mostre o que realmente aconteceu. O estorno em si não
          tem volta.
        </Importante>

        <Passos>
          <Passo numero={1} titulo="Encontre o lançamento na lista">
            <p>Use a busca da tabela para achar pelo nome do cliente ou pelo vasilhame.</p>
          </Passo>
          <Passo numero={2} titulo="Toque em Estornar">
            <p>
              O botão fica na linha do lançamento. Um lançamento já estornado mostra apenas o
              texto “estornado” — não dá para estornar duas vezes.
            </p>
          </Passo>
          <Passo numero={3} titulo="Confirme">
            <p>
              Um segundo toque em <strong>Confirmar</strong> completa o estorno. São dois passos
              de propósito: numa tela usada o dia inteiro, um toque só seria fácil demais de
              acionar sem querer.
            </p>
          </Passo>
        </Passos>
      </SecaoArtigo>

      <SecaoArtigo titulo="Perguntas frequentes">
        <ListaFaq>
          <Faq pergunta="O estorno de uma perda tira o valor do custo do mês?">
            Sim. O resumo de perda ignora tanto o lançamento estornado quanto o estorno, então o
            custo do mês volta ao que era antes do engano.
          </Faq>
          <Faq pergunta="Dá para estornar um estorno?">
            Não — o estorno é definitivo. Se ele também foi um engano, refaça o lançamento
            original em{' '}
            <Link href="/ajuda/vasilhame/baixa-vasilhame">Baixa de Vasilhame</Link>, com os
            mesmos dados.
          </Faq>
          <Faq pergunta="Quem pode estornar?">
            Qualquer pessoa com acesso à tela de Movimentos. Não existe uma segunda aprovação — a
            trava é o passo de confirmação.
          </Faq>
        </ListaFaq>
      </SecaoArtigo>
    </>
  )
}
