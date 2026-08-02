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
          É o retrato de quem está com vasilhame nosso agora. Antes de sair para cobrar um
          cliente ou fechar o mês, esta é a tela que responde “quantos galões estão na rua, e com
          quem”.
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
          legenda="Do cabeçalho de métricas até o extrato de um cliente específico"
        />

        <Passos>
          <Passo numero={1} titulo="Confira o cabeçalho">
            <p>
              Quatro números: galões na rua, clientes devendo, devolvidos no mês e perdidos no
              mês. É a leitura de dez segundos — antes de abrir qualquer linha, dá para saber se o
              mês está normal ou se algo fugiu do padrão.
            </p>
          </Passo>

          <Passo numero={2} titulo="Use o atalho de maiores saldos">
            <p>
              A lista de <strong>Maiores saldos</strong> mostra quem mais deve vasilhame — um
              toque leva direto ao extrato daquele cliente. É por onde a cobrança de vasilhame
              começa: pelos maiores números primeiro.
            </p>
          </Passo>

          <Passo numero={3} titulo="Abra o extrato de um cliente">
            <p>
              Clique no nome, na tabela abaixo. O extrato separa o saldo por tipo de
              vasilhame — devolver um galão de 10L não abate a dívida de um de 20L, e a tela
              mostra os dois lados sem misturar.
            </p>
          </Passo>
        </Passos>
      </SecaoArtigo>

      <SecaoArtigo titulo="Erros comuns">
        <Dica titulo="Saldo negativo na lista?">
          Aparece em vermelho e significa que o cliente devolveu mais do que a tela registra que
          ele levou — quase sempre um lançamento de <Link href="/ajuda/vasilhame/baixa-vasilhame">entrega</Link>{' '}
          que ficou faltando no passado. O extrato do cliente mostra a sequência completa para
          achar onde a conta desandou.
        </Dica>
      </SecaoArtigo>

      <SecaoArtigo titulo="Perguntas frequentes">
        <ListaFaq>
          <Faq pergunta="Por que o total por cliente separa por tipo de vasilhame?">
            Porque um galão de 10L e um de 20L são dívidas diferentes. Somar tudo num número só
            esconderia exatamente a informação que evita discussão no balcão: “eu só devo os
            pequenos”.
          </Faq>
          <Faq pergunta="Este saldo é atualizado na hora?">
            Sim — não é um relatório fechado por período. Toda baixa lançada em{' '}
            <Link href="/ajuda/vasilhame/baixa-vasilhame">Vasilhame → Baixa de Vasilhame</Link>{' '}
            já aparece aqui no instante seguinte.
          </Faq>
        </ListaFaq>
      </SecaoArtigo>
    </>
  )
}
