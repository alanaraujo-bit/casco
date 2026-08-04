import { SecaoArtigo } from '@/components/ajuda/artigo-layout'
import { Passo, Passos } from '@/components/ajuda/passo'
import { Dica } from '@/components/ajuda/callouts'
import { Faq, ListaFaq } from '@/components/ajuda/faq'

export function ArtigoAtualizacoes() {
  return (
    <>
      <SecaoArtigo titulo="Para que serve">
        <p>
          É o lugar para saber o que mudou no Casco desde a última vez que você entrou — sem
          precisar perguntar para ninguém. Toda novidade relevante para o dia a dia da
          distribuidora ganha uma entrada aqui, escrita em português simples, não em termos
          técnicos.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="Onde encontrar">
        <p>
          Menu <strong>Atualizações → Central de Atualizações</strong>. Um número ao lado do item
          do menu mostra quantas novidades você ainda não viu.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="Como usar">
        <Passos>
          <Passo numero={1} titulo="Leia a lista">
            <p>
              As novidades aparecem da mais recente para a mais antiga, cada uma com uma
              categoria (Novo, Melhoria, Correção, e assim por diante), um resumo de uma frase e o
              texto completo logo abaixo.
            </p>
          </Passo>

          <Passo numero={2} titulo="Reaja se quiser">
            <p>
              Os dois botões no fim de cada novidade curtem ou não curtem aquela mudança. Clicar
              de novo no mesmo botão remove a reação — é sempre reversível.
            </p>
          </Passo>

          <Passo numero={3} titulo="O número zera sozinho">
            <p>
              Assim que a tela abre, tudo que estava visível conta como lido, e o número some do
              menu. Não existe botão de "marcar como lido" — entrar na tela já faz isso.
            </p>
          </Passo>
        </Passos>
      </SecaoArtigo>

      <SecaoArtigo titulo="Erros comuns">
        <Dica titulo="O número não bateu com o que eu vi?">
          Se duas pessoas da mesma distribuidora usam o sistema, cada uma tem o próprio contador —
          o que uma leu não afeta o que a outra ainda não viu. É por login, não por empresa.
        </Dica>
      </SecaoArtigo>

      <SecaoArtigo titulo="Perguntas frequentes">
        <ListaFaq>
          <Faq pergunta="Minha reação aparece para outras pessoas da minha distribuidora?">
            A contagem de curtidas e não-curtidas é somada entre todo mundo da sua distribuidora,
            mas ninguém vê quem reagiu — só o total de cada lado.
          </Faq>
          <Faq pergunta="Dá para ver novidades antigas, já lidas?">
            Sim. A lista mostra o histórico inteiro, não só o que está pendente — só o número do
            menu que conta apenas o que falta ler.
          </Faq>
        </ListaFaq>
      </SecaoArtigo>
    </>
  )
}
