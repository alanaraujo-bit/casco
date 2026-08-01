'use server'

import { redirect } from 'next/navigation'
import { sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { db } from '@/db/client'
import { exigirAdmin } from '@/lib/dal'
import { criarSessao, criarSessaoAdmin, encerrarSessao } from '@/lib/sessao'

/**
 * As ações do painel da Aionix: trocar a senha provisória, entrar numa
 * distribuidora, e sair dela.
 */

/** Mesmo custo do resto do sistema. Ver `scripts/criar-empresa.mjs`. */
const CUSTO_BCRYPT = 12

// ------------------------------------------------------------ troca de senha

/**
 * Dez caracteres, contra os oito do usuário de distribuidora.
 *
 * Não é capricho de simetria: esta senha abre *todas* as distribuidoras, e é a
 * única credencial do sistema com esse alcance. Sem exigência de símbolo ou
 * maiúscula — regra de composição empurra as pessoas para `Senha@123`, que é
 * curta e adivinhável e passa em qualquer validador. Comprimento é o que de
 * fato custa caro para quem tenta.
 */
const esquemaSenha = z
  .object({
    senha: z.string().min(10, 'Use pelo menos 10 caracteres'),
    confirmacao: z.string().min(1, 'Repita a senha'),
  })
  .refine((d) => d.senha === d.confirmacao, {
    path: ['confirmacao'],
    message: 'As duas senhas não conferem',
  })

/**
 * Sem `valores` e sem contador de tentativa, ao contrário dos outros
 * formulários do sistema.
 *
 * O `AGENTS.md` manda devolver o que foi digitado, porque o React 19 limpa o
 * formulário quando a action termina e a operadora perderia a ficha inteira ao
 * errar um dígito. Aqui a regra se inverte: são dois campos de senha, e
 * devolvê-los significaria trafegar a senha em texto claro de volta ao
 * navegador e deixá-la no HTML da página. Campo limpo é o comportamento certo,
 * e é o que o React já faz sozinho — não há nada a consertar.
 */
export interface EstadoSenha {
  erro?: string
  campos?: { senha?: string; confirmacao?: string }
}

export async function trocarSenha(
  _anterior: EstadoSenha,
  form: FormData,
): Promise<EstadoSenha> {
  const admin = await exigirAdmin()

  const analise = esquemaSenha.safeParse({
    senha: String(form.get('senha') ?? ''),
    confirmacao: String(form.get('confirmacao') ?? ''),
  })

  if (!analise.success) {
    const campos = z.flattenError(analise.error).fieldErrors
    return {
      campos: { senha: campos.senha?.[0], confirmacao: campos.confirmacao?.[0] },
    }
  }

  const hash = await bcrypt.hash(analise.data.senha, CUSTO_BCRYPT)

  const [resultado] = await db.execute<{ admin_trocar_senha: boolean }>(
    sql`select admin_trocar_senha(${admin.adminId}, ${hash})`,
  )

  if (!resultado?.admin_trocar_senha) {
    return { erro: 'Não foi possível trocar a senha. Entre novamente.' }
  }

  // Reemite o cookie sem `trocaSenha`. Sem isto o guard continuaria trancando
  // a pessoa na tela de troca com a senha já trocada — laço perfeito, porque o
  // banco diria "resolvido" e o cookie diria "pendente".
  await criarSessaoAdmin({ ...admin, trocaSenha: false })

  redirect('/admin')
}

// --------------------------------------------------------- entrar / sair

/**
 * Abre uma distribuidora.
 *
 * O admin não vira funcionário dela: ele recebe uma sessão de trabalho comum,
 * com o `company_id` daquela empresa, e daí para baixo o sistema inteiro trata
 * igual a qualquer outra sessão — mesma RLS, mesmo `comTenant()`, mesmas
 * políticas. Não existe caminho privilegiado dentro da empresa; o privilégio
 * do admin é só o de escolher em qual entrar.
 *
 * `papel: 'dono'` porque é o papel mais completo que existe no modelo de uma
 * distribuidora, e alguém dando suporte precisa enxergar o que o dono enxerga.
 *
 * `adminId` viaja junto para a faixa de aviso e para o botão de voltar.
 */
export async function entrarNaEmpresa(form: FormData) {
  const admin = await exigirAdmin()
  if (admin.trocaSenha) redirect('/admin/senha')

  const id = String(form.get('empresaId') ?? '')

  // O id vem de um `<form>`, então é entrada do usuário como qualquer outra.
  // `admin_empresa` confirma que existe e está ativa — sem isso um id inventado
  // viraria `company_id` de sessão, e a pessoa cairia num sistema inteiro vazio
  // sem nada explicando por quê.
  const [empresa] = await db.execute<{ id: string; nome: string }>(
    sql`select * from admin_empresa(${id})`,
  )

  if (!empresa) redirect('/admin?erro=empresa')

  await criarSessao({
    usuarioId: admin.adminId,
    companyId: empresa.id,
    papel: 'dono',
    nome: admin.nome,
    empresa: empresa.nome,
    adminId: admin.adminId,
  })

  redirect('/painel')
}

/**
 * Volta ao painel da Aionix, largando a distribuidora.
 *
 * Apaga só a sessão de trabalho. A identidade de admin fica, então não há
 * relogin — é o movimento que a gente faz dez vezes por dia dando suporte.
 */
export async function voltarAoPainel() {
  await exigirAdmin()
  await encerrarSessao()
  redirect('/admin')
}
