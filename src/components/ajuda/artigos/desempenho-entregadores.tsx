import Link from 'next/link'
import { SecaoArtigo } from '@/components/ajuda/artigo-layout'
import { Passo, Passos } from '@/components/ajuda/passo'
import { Atencao, Dica } from '@/components/ajuda/callouts'
import { Faq, ListaFaq } from '@/components/ajuda/faq'

export function ArtigoDesempenhoEntregadores() {
  return (
    <>
      <SecaoArtigo titulo="Para que serve">
        <p>
          Mostra quem entregou o quê no período: quantas entregas cada entregador fez, quanto de
          água levou, quanto de vasilhame trouxe de volta e quanto isso deu em dinheiro. É a tela
          para responder <strong>quem puxou a semana</strong> — e para descobrir quais vendas
          saíram sem ninguém marcado.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="Onde encontrar">
        <p>
          Menu <strong>Relatórios → Desempenho dos Entregadores</strong>.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="Como ler a tela">
        <Passos>
          <Passo numero={1} titulo="Escolha o período">
            <p>
              No topo, à direita: <strong>Esta semana</strong>, <strong>Semana passada</strong>,{' '}
              <strong>Este mês</strong> ou <strong>Mês passado</strong>. A semana começa na
              segunda e termina no sábado, do mesmo jeito que a rota fecha — assim o sábado, que
              costuma ser o dia mais cheio, fica na semana a que ele pertence.
            </p>
          </Passo>

          <Passo numero={2} titulo="Leia os quatro cartões">
            <p>
              Entregas no período, água entregue (com o vasilhame recolhido logo abaixo), valor
              entregue e quem mais vendeu. É a leitura de dez segundos antes de olhar a tabela.
            </p>
          </Passo>

          <Passo numero={3} titulo="Veja o ranking e o dia a dia">
            <p>
              O ranking é por <strong>valor vendido</strong>, não por número de entregas — quem faz
              muitas entregas pequenas de balcão pode aparecer atrás de quem levou uma carga
              grande, e é a carga grande que pagou o mês. Ao lado, o gráfico de entregas por dia
              mostra também os dias parados, zerados.
            </p>
          </Passo>

          <Passo numero={4} titulo="Confira o detalhe por entregador">
            <p>
              A tabela de baixo abre os números por pessoa: entregas, água, vasilhame recolhido,
              clientes atendidos, ticket médio e total vendido. Quem não entregou nada no período
              aparece do mesmo jeito, com traços — some da lista seria confundir{' '}
              <em>não entregou</em> com <em>não existe</em>.
            </p>
          </Passo>
        </Passos>
      </SecaoArtigo>

      <SecaoArtigo titulo="Erros comuns">
        <Atencao titulo="A soma do relatório não bate com o faturamento do período">
          Quase sempre é venda sem entregador marcado. No rodapé da tabela aparece quantas vendas
          são e quanto somam — esse valor não entra em nome nenhum do ranking. Dá para corrigir
          depois: abra a venda em{' '}
          <Link href="/ajuda/vendas/vendas-produtos">Vendas de Produtos</Link> e escolha quem
          entregou.
        </Atencao>

        <Dica titulo="Marque o entregador na hora, mesmo com o balcão cheio">
          É mais rápido escolher o nome no <Link href="/ajuda/vendas/pdv">PDV</Link>, ao fechar a
          venda, do que caçar as vendas em branco no fim da semana. Mas as duas formas funcionam, e
          nenhuma delas altera valor de venda.
        </Dica>
      </SecaoArtigo>

      <SecaoArtigo titulo="Perguntas frequentes">
        <ListaFaq>
          <Faq pergunta="Venda cancelada e orçamento entram na conta?">
            Não. Só venda confirmada. Orçamento ainda não é entrega, e venda cancelada deixou de
            ser — se contassem, o primeiro lugar poderia ser de quem teve mais venda desfeita.
          </Faq>
          <Faq pergunta="Um entregador que saiu da empresa continua aparecendo?">
            No período em que ele entregou, sim, com o selo <strong>inativo</strong> ao lado do
            nome. O passado não muda porque alguém foi desligado depois. O que não dá é marcar uma
            venda nova para quem já saiu.
          </Faq>
          <Faq pergunta="Por que a tela não dá nota nem mostra meta?">
            Porque o número não sabe quem pegou a rota do interior e quem ficou no balcão da
            esquina. O relatório mostra o que aconteceu; quem tem o contexto para julgar é você.
          </Faq>
          <Faq pergunta="O que é o 'ticket médio' da tabela?">
            O total vendido dividido pelo número de entregas daquele entregador — quanto vale, em
            média, cada parada que ele faz.
          </Faq>
        </ListaFaq>
      </SecaoArtigo>
    </>
  )
}
