'use server'

import { redirect } from 'next/navigation'
import { sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '@/db/client'
import { withTenant } from '@/db/tenant'
import type { Papel } from '@/db/schema'
import { descreverFalha, type Falha } from '@/lib/erros'
import {
  criarSessao,
  criarSessaoAdmin,
  encerrarSessao,
  encerrarSessaoAdmin,
} from '@/lib/sessao'

/**
 * Entrar e sair.
 *
 * O login é o único ponto do sistema que lê o banco sem saber ainda a qual
 * empresa o usuário pertence — descobrir isso é justamente o que ele faz. Em
 * vez de afrouxar a RLS, ele passa pela função `auth_find_user`, criada na
 * migration 0001: `security definer`, devolve só as colunas necessárias para
 * autenticar, e nada mais. Porta estreita e explícita em vez de política frouxa.
 */

const entrada = z.object({
  email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
  senha: z.string().min(1, 'Informe a senha'),
})

export interface EstadoLogin {
  /**
   * `string` para a única resposta que já nasce completa ("E-mail ou senha
   * incorretos.") e `Falha` para o que o banco recusar de forma inesperada —
   * ver `descreverFalha`. É a mesma tela para os dois casos; sem essa segunda
   * forma, uma queda de conexão no login (a ação mais repetida do sistema)
   * chegaria à operadora como a tela de erro genérica do Next.
   */
  erro?: string | Falha
  campos?: { email?: string; senha?: string }
  /** Preservado para o campo não voltar vazio quando só a senha estiver errada. */
  email?: string
}

/**
 * Hash descartável de custo equivalente ao real.
 *
 * Comparado quando o e-mail não existe, para que a resposta demore o mesmo
 * tanto nos dois casos. Sem isso, o tempo de resposta diz quais e-mails estão
 * cadastrados — e "responde rápido" é resposta.
 */
const HASH_FALSO = '$2b$12$3ZQb8Z0jvJgqfQm2Yy0mAeH2p3zPq1Vv2rTt6Y9uUjq0lMnOpQrSu'

export async function entrar(
  _anterior: EstadoLogin,
  form: FormData,
): Promise<EstadoLogin> {
  const bruto = {
    email: String(form.get('email') ?? ''),
    senha: String(form.get('senha') ?? ''),
  }

  const analise = entrada.safeParse(bruto)
  if (!analise.success) {
    const campos = z.flattenError(analise.error).fieldErrors
    return {
      email: bruto.email,
      campos: { email: campos.email?.[0], senha: campos.senha?.[0] },
    }
  }

  const { email, senha } = analise.data

  /**
   * O caminho para onde mandar depois de logar — calculado dentro do
   * `try`, mas só `redirect()`ado depois dele. `redirect()` funciona jogando
   * um erro especial que o Next intercepta mais acima na árvore; chamá-lo
   * dentro do `catch` genérico abaixo faria `descreverFalha` tentar traduzir
   * esse "erro" como se fosse uma recusa do banco.
   */
  let destino: string
  try {
    const encontrados = await db.execute<{
      id: string
      company_id: string
      nome: string
      papel: Papel
      senha_hash: string
    }>(sql`select * from auth_find_user(${email})`)

    const usuario = encontrados[0]

    // Uma tela de login só.
    //
    // A Aionix podia ter `/admin/login` separado, e seria mais fácil de escrever.
    // Seria também uma URL a mais para alguém achar e ficar batendo senha, e uma
    // segunda tela de login para manter em pé. O e-mail já é único no sistema
    // inteiro (índice em `users`, índice em `plataforma_admins`), então ele
    // sozinho decide para onde a pessoa vai. Quem opera balcão nunca descobre
    // que este caminho existe.
    const admins = usuario
      ? []
      : await db.execute<{
          id: string
          nome: string
          email: string
          senha_hash: string
          senha_provisoria: boolean
        }>(sql`select * from admin_find(${email})`)

    const admin = admins[0]

    // Sempre compara, mesmo sem usuário nem admin: a comparação falsa consome o
    // mesmo tempo que a verdadeira. Ver HASH_FALSO.
    const confere = await bcrypt.compare(
      senha,
      usuario?.senha_hash ?? admin?.senha_hash ?? HASH_FALSO,
    )

    if (!confere || (!usuario && !admin)) {
      // Mensagem única de propósito. "E-mail não encontrado" transforma a tela de
      // login numa consulta de quem tem cadastro.
      return { erro: 'E-mail ou senha incorretos.', email }
    }

    if (admin) {
      await db.execute(sql`select admin_registrar_acesso(${admin.id})`)

      // O admin **não** herda `destino`. O parâmetro guarda a tela de negócio em
      // que alguém estava quando a sessão expirou, e admin não tem sessão de
      // negócio antes de escolher a empresa — mandá-lo para `/vasilhame/baixa`
      // renderizaria a tela sem tenant nenhum.
      await criarSessaoAdmin({
        adminId: admin.id,
        nome: admin.nome,
        email: admin.email,
        trocaSenha: admin.senha_provisoria,
      })

      // Sessão de trabalho antiga tem que morrer aqui. Sem isso, quem entrou como
      // admin depois de ter usado o sistema como funcionário continuaria com a
      // empresa anterior colada na sessão.
      await encerrarSessao()

      destino = admin.senha_provisoria ? '/admin/senha' : '/admin'
    } else {
      // Dentro do `withTenant`, e não solto como estava.
      //
      // `companies` tem RLS: sem `app.company_id` definido a política nega, a
      // consulta volta vazia e o nome da empresa virava string vazia — silenciosamente.
      // O efeito aparecia longe da causa: a topbar e o painel mostravam a data
      // seguida de um "·" solto, e ninguém ligava isso ao login. A RLS fez o que
      // devia; o errado era consultar fora do wrapper.
      const [empresa] = await withTenant(usuario.company_id, (tx) =>
        tx.execute<{ nome: string }>(
          sql`select nome from companies where id = ${usuario.company_id}`,
        ),
      )

      await criarSessao({
        usuarioId: usuario.id,
        companyId: usuario.company_id,
        papel: usuario.papel,
        nome: usuario.nome,
        empresa: empresa?.nome ?? '',
      })

      const pedido = String(form.get('destino') ?? '')
      // Só caminho interno. Aceitar a query crua deixaria `?destino=https://…`
      // virar redirecionamento para fora — o link de phishing sai do nosso domínio.
      destino = pedido.startsWith('/') && !pedido.startsWith('//') ? pedido : '/painel'
    }
  } catch (err) {
    // Sem isto, uma queda de conexão bem no meio do login — a ação mais
    // repetida do sistema, e a primeira coisa que qualquer pessoa faz ao
    // sentar no balcão — chegava como a tela de erro genérica do Next, sem
    // dizer que nada foi gravado nem que tentar de novo costuma resolver.
    return { erro: descreverFalha(err), email }
  }

  redirect(destino)
}

/**
 * Sai de tudo: sessão de trabalho e identidade de admin.
 *
 * Apagar só a de trabalho deixaria o admin numa meia-saída — clicou em "Sair",
 * viu o login, e ainda estava logado na Aionix. Para voltar ao painel sem
 * relogar existe `voltarAoPainel()`, que é outra ação e tem outro rótulo.
 */
export async function sair() {
  await encerrarSessao()
  await encerrarSessaoAdmin()
  redirect('/login')
}
