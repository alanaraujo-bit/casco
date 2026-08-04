import Link from 'next/link'
import { SecaoArtigo } from '@/components/ajuda/artigo-layout'
import { Passo, Passos } from '@/components/ajuda/passo'
import { Video } from '@/components/ajuda/video'
import { Dica } from '@/components/ajuda/callouts'
import { Faq, ListaFaq } from '@/components/ajuda/faq'

export function ArtigoSaldoVasilhame() {
  return (
    <>
      <SecaoArtigo titulo="Para que serve">
        <p>
          É o retrato de quem está com vasilhame seu agora. Antes de cobrar um cliente ou de
          fechar o mês, esta é a tela que responde quantos galões estão na rua e com quem.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="Onde encontrar">
        <p>
          Menu <strong>Vasilhame → Saldo por Cliente</strong>.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="Como ler a tela">
        <Video
          src="/ajuda/saldo-vasilhame.gif"
          poster="/ajuda/saldo-vasilhame.png"
          legenda="Do cabeçalho de métricas ao extrato de um cliente, com o saldo separado por tipo de vasilhame"
        />

        <Passos>
          <Passo numero={1} titulo="Comece pelo cabeçalho">
            <p>
              Quatro números: galões na rua, clientes devendo, devolvidos no mês e perdidos no
              mês. É a leitura de dez segundos — antes de abrir qualquer linha, você já sabe se o
              mês está dentro do normal.
            </p>
          </Passo>

          <Passo numero={2} titulo="Use o atalho de maiores saldos">
            <p>
              A lista de <strong>Maiores saldos</strong> mostra quem mais tem vasilhame seu, e um
              toque leva direto ao extrato daquela pessoa. É por aí que a cobrança começa: pelos
              maiores números primeiro.
            </p>
          </Passo>

          <Passo numero={3} titulo="Abra o extrato de um cliente">
            <p>
              Clique no nome, na tabela abaixo. O extrato separa o saldo por tipo de vasilhame —
              devolver um vasilhame de 10L não abate a dívida de um de 20L, e a tela mostra os dois
              lados sem misturar.
            </p>
          </Passo>
        </Passos>
      </SecaoArtigo>

      <SecaoArtigo titulo="Erros comuns">
        <Dica titulo="Saldo negativo na lista?">
          Aparece em vermelho e significa que o cliente devolveu mais do que a tela registra que
          ele levou — quase sempre uma{' '}
          <Link href="/ajuda/vasilhame/baixa-vasilhame">entrega</Link> que não chegou a ser
          lançada. O extrato do cliente mostra a sequência completa e ajuda a achar onde a conta
          desandou.
        </Dica>
      </SecaoArtigo>

      <SecaoArtigo titulo="Perguntas frequentes">
        <ListaFaq>
          <Faq pergunta="Por que o total do cliente é separado por tipo de vasilhame?">
            Porque um vasilhame de 10L e um de 20L são dívidas diferentes. Somar tudo num número só
            esconderia justamente o que evita discussão no balcão: quantos de cada tipo ele tem.
          </Faq>
          <Faq pergunta="Este saldo é atualizado na hora?">
            Sim. Não é um relatório fechado por período: toda baixa lançada em{' '}
            <Link href="/ajuda/vasilhame/baixa-vasilhame">Vasilhame → Baixa de Vasilhame</Link>{' '}
            aparece aqui no instante seguinte.
          </Faq>
        </ListaFaq>
      </SecaoArtigo>
    </>
  )
}
