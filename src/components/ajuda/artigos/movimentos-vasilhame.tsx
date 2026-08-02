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
          É o razão completo de vasilhame: todo galão que entrou, saiu ou se perdeu, um por um,
          com motivo e responsável. Onde o dono confere o mês, e onde a operadora corrige um
          lançamento errado.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="Onde encontrar">
        <p>
          Menu <strong>Vasilhame → Movimentos</strong>. Também dá para chegar aqui pelo botão{' '}
          <strong>Ver movimentos</strong>, no topo da tela de{' '}
          <Link href="/ajuda/vasilhame/baixa-vasilhame">Baixa de Vasilhame</Link>.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="O painel de perda do mês">
        <p>
          No topo da tela, um cartão por mês mostra o custo total de vasilhame perdido — quebrado,
          trincado ou não devolvido — e o detalhamento por motivo. É o número que substitui a
          venda de centavos do sistema antigo: aqui a perda aparece como o que ela é, um custo,
          nunca uma receita.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="Como estornar um lançamento errado">
        <Video
          src="/ajuda/movimentos-vasilhame.gif"
          poster="/ajuda/movimentos-vasilhame.png"
          legenda="Estornando um lançamento em dois toques, com confirmação"
        />

        <Importante titulo="Movimento não se edita — só se estorna">
          Todo lançamento é permanente, do jeito que foi digitado. Errar o motivo ou a
          quantidade não se corrige apagando: corrige-se estornando o lançamento errado e
          lançando o certo em <Link href="/ajuda/vasilhame/baixa-vasilhame">Baixa de Vasilhame</Link>.
          É o que garante que o histórico nunca minta sobre o que realmente foi registrado — e o
          estorno em si não pode ser desfeito.
        </Importante>

        <Passos>
          <Passo numero={1} titulo="Encontre o lançamento na lista">
            <p>Use a busca da tabela para achar pelo nome do cliente ou pelo vasilhame.</p>
          </Passo>
          <Passo numero={2} titulo="Toque em Estornar">
            <p>
              O botão aparece na linha do lançamento. Lançamento já estornado mostra apenas o
              texto “estornado” — não dá para estornar duas vezes.
            </p>
          </Passo>
          <Passo numero={3} titulo="Confirme">
            <p>
              Um segundo toque em <strong>Confirmar</strong> completa o estorno. Dois passos de
              propósito: estornar não tem volta, e um toque só seria fácil demais de acionar sem
              querer numa tela que se usa o dia inteiro.
            </p>
          </Passo>
        </Passos>
      </SecaoArtigo>

      <SecaoArtigo titulo="Perguntas frequentes">
        <ListaFaq>
          <Faq pergunta="O estorno de uma perda entra no custo do mês de novo?">
            Não. O painel de perda ignora tanto o lançamento estornado quanto o próprio estorno —
            senão um “quebrado 50” digitado por engano ficaria inflando o custo do mês para
            sempre, mesmo depois de corrigido.
          </Faq>
          <Faq pergunta="Dá para estornar um estorno?">
            Não — o estorno em si é definitivo. Se o estorno também foi um engano, o lançamento
            original volta lançando de novo os mesmos dados em{' '}
            <Link href="/ajuda/vasilhame/baixa-vasilhame">Baixa de Vasilhame</Link>.
          </Faq>
          <Faq pergunta="Quem pode estornar?">
            Qualquer pessoa com acesso à tela de Movimentos. Não existe uma segunda aprovação
            hoje — a trava é o passo de confirmação.
          </Faq>
        </ListaFaq>
      </SecaoArtigo>
    </>
  )
}
