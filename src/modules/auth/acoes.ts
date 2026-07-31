'use server'

import { redirect } from 'next/navigation'
import { sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '@/db/client'
import { withTenant } from '@/db/tenant'
import type { Papel } from '@/db/schema'
import { criarSessao, encerrarSessao } from '@/lib/sessao'

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
  erro?: string
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

  const encontrados = await db.execute<{
    id: string
    company_id: string
    nome: string
    papel: Papel
    senha_hash: string
  }>(sql`select * from auth_find_user(${email})`)

  const usuario = encontrados[0]

  // Sempre compara, mesmo sem usuário: a comparação falsa consome o mesmo tempo
  // que a verdadeira. Ver HASH_FALSO.
  const confere = await bcrypt.compare(senha, usuario?.senha_hash ?? HASH_FALSO)

  if (!usuario || !confere) {
    // Mensagem única de propósito. "E-mail não encontrado" transforma a tela de
    // login numa consulta de quem tem cadastro.
    return { erro: 'E-mail ou senha incorretos.', email }
  }

  // Dentro do `withTenant`, e não solto como estava.
  //
  // `companies` tem RLS: sem `app.company_id` definido a política nega, a
  // consulta volta vazia e o nome da empresa virava string vazia — silenciosamente.
  // O efeito aparecia longe da causa: a topbar e o painel mostravam a data
  // seguida de um "·" solto, e ninguém ligava isso ao login. A RLS fez o que
  // devia; o errado era consultar fora do wrapper.
  const [empresa] = await withTenant(usuario.company_id, (tx) =>
    tx.execute<{ nome: string }>(sql`select nome from companies where id = ${usuario.company_id}`),
  )

  await criarSessao({
    usuarioId: usuario.id,
    companyId: usuario.company_id,
    papel: usuario.papel,
    nome: usuario.nome,
    empresa: empresa?.nome ?? '',
  })

  const destino = String(form.get('destino') ?? '')
  // Só caminho interno. Aceitar a query crua deixaria `?destino=https://…`
  // virar redirecionamento para fora — o link de phishing sai do nosso domínio.
  redirect(destino.startsWith('/') && !destino.startsWith('//') ? destino : '/painel')
}

export async function sair() {
  await encerrarSessao()
  redirect('/login')
}
