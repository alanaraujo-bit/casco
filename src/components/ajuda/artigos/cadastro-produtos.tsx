import Link from 'next/link'
import { SecaoArtigo } from '@/components/ajuda/artigo-layout'
import { Passo, Passos } from '@/components/ajuda/passo'
import { Atencao, Dica, Importante } from '@/components/ajuda/callouts'
import { Faq, ListaFaq } from '@/components/ajuda/faq'

/**
 * A base de tudo que o sistema vende ou controla. O texto segue a mesma
 * ordem do formulário — identificação, preço, estoque, vasilhame — porque é
 * nessa ordem que a tela pede as coisas.
 */
export function ArtigoCadastroProdutos() {
  return (
    <>
      <SecaoArtigo titulo="Para que serve">
        <p>
          É onde cada produto nasce: nome, preço de venda, custo, os limites de estoque e se ele
          é um vasilhame retornável. Todo produto que aparece no <Link href="/ajuda/vendas/pdv">PDV</Link>,
          numa tabela de preço ou num relatório de estoque foi cadastrado aqui primeiro.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="Onde encontrar">
        <p>
          Menu <strong>Cadastro → Produtos</strong>. A listagem tem dois botões de criação:{' '}
          <strong>Novo produto</strong>, para qualquer item que se vende, e{' '}
          <strong>Novo vasilhame</strong>, para cadastrar o casco em si — o objeto que fica
          emprestado com o cliente. Um produto de água ou gás retornável aponta para o vasilhame
          dele; o vasilhame não aponta para nada.
        </p>
      </SecaoArtigo>

      <SecaoArtigo titulo="Como fazer">
        <Passos>
          <Passo numero={1} titulo="Nome, SKU, categoria e unidade">
            <p>
              Só o <strong>nome</strong> e a <strong>unidade</strong> são obrigatórios — o resto
              pode ficar em branco e ser completado depois. O <strong>SKU</strong> é o código
              interno do produto, se a distribuidora usar um; a <strong>categoria</strong> agrupa
              produtos parecidos e aceita tanto escolher uma já existente quanto digitar uma nova.
              O <strong>código</strong> que aparece na listagem é gerado sozinho ao salvar — não
              tem campo para digitar.
            </p>
          </Passo>

          <Passo numero={2} titulo="Escolha um ícone">
            <p>
              Cinco opções fixas — Água, Gás, Vasilhame, Acessório e Genérico — para a operadora
              reconhecer o produto de relance na listagem e nos cartões do PDV, sem precisar ler o
              nome inteiro. É opcional: sem escolha, o produto aparece com o ícone genérico.
            </p>
          </Passo>

          <Passo numero={3} titulo="Preço de venda e custo">
            <p>
              O <strong>preço de venda</strong> é o valor padrão, usado sempre que o cliente não
              tem uma tabela de preço própria. O <strong>custo</strong> é opcional e alimenta a
              margem nos relatórios — não aparece em nenhuma tela de venda.
            </p>
          </Passo>

          <Passo numero={4} titulo="Decida se o produto controla estoque">
            <p>
              Com <strong>Controla estoque</strong> em Sim, aparecem os campos de{' '}
              <strong>estoque mínimo</strong> e <strong>máximo</strong> — os limites que disparam
              o alerta de estoque baixo ou alto nas telas de estoque. Só no cadastro de um produto
              novo aparece também o <strong>estoque inicial</strong>: quanto já existe na
              prateleira no momento em que o cadastro nasce.
            </p>
          </Passo>

          <Passo numero={5} titulo="Marque se é retornável">
            <p>
              Um produto <strong>retornável</strong> é o que gera comodato — o cliente leva o
              vasilhame cheio e deve devolvê-lo depois. Marcando Sim, escolha em{' '}
              <strong>Produto do vasilhame</strong> qual vasilhame cadastrado é esse — o mesmo que
              aparece em <Link href="/ajuda/vasilhame/saldo-vasilhame">Saldo por Cliente</Link>{' '}
              quando o cliente está devendo um. Este campo não aparece ao cadastrar um vasilhame
              em si, só ao cadastrar o produto que o usa.
            </p>
          </Passo>

          <Passo numero={6} titulo="Salve">
            <p>
              <strong>Cadastrar produto</strong> (ou <strong>Salvar alterações</strong>, editando
              um já existente) grava e volta para a listagem. Um erro de validação mantém tudo
              que foi digitado na tela — nada se perde por causa de um campo errado.
            </p>
          </Passo>
        </Passos>

        <Dica titulo="O preço muda por cliente, não aqui">
          O preço cadastrado no produto é só o padrão. Uma distribuidora que usa tabela de preço
          por tipo de cliente ajusta o valor final em outro lugar — este cadastro nunca precisa
          saber quantas tabelas existem.
        </Dica>
      </SecaoArtigo>

      <SecaoArtigo titulo="Erros comuns">
        <Atencao titulo="SKU repetido">
          Cada SKU só pode existir uma vez por distribuidora. Tentando salvar um SKU já usado, a
          tela avisa qual é o conflito — o cadastro em si não se perde, só precisa de um código
          diferente.
        </Atencao>
        <Importante titulo="Estoque inicial só entra no cadastro novo">
          Editando um produto que já existe, não há campo para trocar o estoque por cima. O saldo
          dali em diante é feito de movimentos de verdade — cada um com autor e data — e alterar
          esse número direto no cadastro apagaria esse histórico sem deixar rastro. Para corrigir
          o estoque de um produto existente, lance o ajuste em <strong>Estoque → Movimentações</strong>,
          onde a correção fica registrada.
        </Importante>
        <Dica titulo="Produto sem preço aparece destacado na listagem">
          Um preço de venda em zero não impede o cadastro — só aparece como &ldquo;sem preço&rdquo;,
          em laranja, tanto na listagem quanto no cartão de métrica do topo. É o aviso de que
          aquele produto ainda não está pronto para ser vendido.
        </Dica>
      </SecaoArtigo>

      <SecaoArtigo titulo="Perguntas frequentes">
        <ListaFaq>
          <Faq pergunta="Qual a diferença entre 'Novo produto' e 'Novo vasilhame'?">
            &ldquo;Novo vasilhame&rdquo; cadastra o casco em si — o objeto que fica de comodato com
            o cliente, sem preço de venda nem opção de ser retornável (ele é o vasilhame, não algo
            que usa um). &ldquo;Novo produto&rdquo; cadastra qualquer item que se vende, inclusive
            um que seja retornável e aponte para um vasilhame já cadastrado.
          </Faq>
          <Faq pergunta="Preciso escolher um ícone?">
            Não. O campo é opcional, e sem escolha o produto aparece com o ícone genérico na
            listagem e no PDV. Só ajuda a operadora a reconhecer o produto mais rápido — não muda
            nada no preço, no estoque nem na venda.
          </Faq>
          <Faq pergunta="Dá para excluir um produto?">
            Não de verdade. O botão na listagem <strong>inativa</strong> o produto — ele some das
            telas de venda, mas continua existindo para não quebrar o histórico de vendas e
            movimentos já lançados com ele. Um produto inativo pode ser reativado a qualquer
            momento pelo mesmo botão, ou visto na listagem marcando <strong>Mostrar inativos</strong>.
          </Faq>
          <Faq pergunta="Posso trocar o estoque mínimo e máximo depois de cadastrado?">
            Sim, a qualquer momento, editando o produto. Só o estoque inicial — o número de
            partida — é exclusivo do cadastro novo.
          </Faq>
          <Faq pergunta="O NCM é obrigatório?">
            Não, é opcional. Quando preenchido, precisa ter 8 dígitos.
          </Faq>
          <Faq pergunta="Cadastrei o produto errado como retornável. Como corrijo?">
            Edite o produto e mude <strong>Retornável?</strong> para Não — o campo{' '}
            <strong>Produto do vasilhame</strong> some junto. Isso não desfaz um comodato que já
            tenha sido lançado com esse produto; se houver saldo de vasilhame pendente, confira em{' '}
            <Link href="/ajuda/vasilhame/saldo-vasilhame">Saldo por Cliente</Link> antes de mudar.
          </Faq>
        </ListaFaq>
      </SecaoArtigo>
    </>
  )
}
