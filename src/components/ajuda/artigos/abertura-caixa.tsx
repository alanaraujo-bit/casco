import Link from 'next/link'
import { SecaoArtigo } from '@/components/ajuda/artigo-layout'
import { Passo, Passos } from '@/components/ajuda/passo'
import { Atencao, Dica } from '@/components/ajuda/callouts'
import { Faq, ListaFaq } from '@/components/ajuda/faq'

export function ArtigoAberturaCaixa() {
  return (
    <>
      <SecaoArtigo titulo="Para que serve">
        <p>
          Registra o que a operadora contou na gaveta ao abrir o turno: quanto de dinheiro está
          ali, e quanto disso é fundo de troco — reservado só para dar troco, não para vender.
          Fica guardado como histórico para conferir contra o fechamento do dia, e é a mesma
          contagem que o <Link href="/ajuda/vendas/pdv">PDV</Link> pede antes de liberar a
          primeira venda de cada dia.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="Onde encontrar">
        <p>
          Duas portas para o mesmo lançamento: o próprio <strong>PDV</strong>, que pede a
          contagem antes da primeira venda do dia, e <strong>Financeiro → Caixa</strong>, botão{' '}
          <strong>Abertura de Caixa</strong>, para registrar ou conferir fora do balcão.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="Como registrar uma abertura">
        <Passos>
          <Passo numero={1} titulo="Escolha o caixa">
            Se a distribuidora tem só uma gaveta cadastrada como conta do tipo Caixa, ela já vem
            selecionada. Com mais de uma, escolha qual está sendo aberta.
          </Passo>
          <Passo numero={2} titulo="Informe o dinheiro que está na gaveta">
            O total contado agora, antes de qualquer venda do dia — não é o saldo do sistema, é o
            que a operadora está vendo e contando na mão.
          </Passo>
          <Passo numero={3} titulo="Informe o fundo de troco, se houver">
            Quanto desse total está separado só para dar troco, e não deve ser contado como
            dinheiro disponível para outra coisa. Fica registrado como um número à parte do
            dinheiro na gaveta, nunca somado a ele.
          </Passo>
          <Passo numero={4} titulo="Registre">
            A abertura entra no histórico logo abaixo do formulário, com data, hora e quem
            registrou.
          </Passo>
        </Passos>
      </SecaoArtigo>

      <SecaoArtigo titulo="Erros comuns">
        <Atencao titulo="O fundo de troco não pode ser maior que o dinheiro contado">
          Se a gaveta tem R$ 200 e o fundo de troco é R$ 250, a tela recusa: não existe reservar
          para troco mais dinheiro do que se tem na mão. Confira os dois números antes de
          registrar.
        </Atencao>
        <Dica titulo="Já abriu pelo PDV hoje?">
          Então não precisa registrar de novo por aqui — a abertura vale o dia inteiro, não
          importa qual das duas telas você usou para lançá-la.
        </Dica>
      </SecaoArtigo>

      <SecaoArtigo titulo="Perguntas frequentes">
        <ListaFaq>
          <Faq pergunta="A abertura de caixa impede vender sem registrar antes?">
            No PDV, sim — é o primeiro passo do dia, antes de qualquer venda. Registrar por aqui,
            em Financeiro, é a mesma abertura; só muda a tela de onde ela é lançada.
          </Faq>
          <Faq pergunta="Não aparece nenhuma conta para escolher. Por quê?">
            A abertura só lista contas do tipo <strong>Caixa</strong>. Cadastre uma em{' '}
            <Link href="/financeiro/contas">Financeiro → Contas</Link>, marcando o tipo como
            Caixa.
          </Faq>
          <Faq pergunta="Dá para editar ou apagar uma abertura registrada?">
            Hoje não — cada abertura fica no histórico como foi lançada. Se digitou errado,
            registre uma nova com o valor certo; o histórico mostra todas, na ordem em que
            aconteceram.
          </Faq>
        </ListaFaq>
      </SecaoArtigo>
    </>
  )
}
