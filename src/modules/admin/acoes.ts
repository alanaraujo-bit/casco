'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { uuidv7 } from 'uuidv7'
import { z } from 'zod'
import { db } from '@/db/client'
import { exigirAdmin } from '@/lib/dal'
import { criarSessao, criarSessaoAdmin, encerrarSessao } from '@/lib/sessao'
import {
  CAMPOS_ACESSO,
  esquemaAcesso,
  esquemaNovaSenha,
  type CampoAcesso,
  type EstadoAcesso,
} from './esquema'

/**
 * As ações do painel da Aionix: trocar a senha provisória, entrar numa
 * distribuidora, sair dela, e gerir os acessos de quem trabalha nela.
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

// -------------------------------------------------------- acessos da empresa

/**
 * Criar, desativar e redefinir senha de quem trabalha na distribuidora.
 *
 * As três passam por `exigirAdmin()` e por funções `security definer` da
 * migration 0009. Duas coisas valem para todas:
 *
 * - **O `companyId` vem do formulário, e isso é seguro aqui — só aqui.** Numa
 *   tela de negócio seria falha grave: o tenant vem da sessão, nunca do
 *   navegador. O painel da Aionix é a exceção por definição, porque a sessão de
 *   admin não tem tenant nenhum e a tela existe justamente para escolher em qual
 *   empresa agir. Quem confere que o id é de empresa real e ativa é a função do
 *   banco, e todas elas casam `company_id` junto do `id` do usuário.
 * - **A senha é digitada pelo admin, não sorteada.** Foi escolha explícita: sem
 *   `senha_provisoria` em `users`, sem tela de primeiro acesso do lado da
 *   distribuidora. O preço é conhecido — a senha do dono nasce sabida por quem
 *   criou, e nada obriga a troca. Quando isso incomodar, o caminho é copiar o
 *   mecanismo que `plataforma_admins` já tem.
 */

/** Só para o guard de digitação; quem valida de verdade é o banco. */
const ehUuid = (v: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)

export async function criarAcesso(anterior: EstadoAcesso, form: FormData): Promise<EstadoAcesso> {
  await exigirAdmin()

  const companyId = String(form.get('companyId') ?? '')
  const tentativa = (anterior.tentativa ?? 0) + 1

  const bruto = Object.fromEntries(
    CAMPOS_ACESSO.map((campo) => [campo, String(form.get(campo) ?? '')]),
  ) as Record<CampoAcesso, string>

  // Tudo menos a senha volta para o formulário quando dá erro. Ver `EstadoAcesso`.
  const valores = { nome: bruto.nome, email: bruto.email, papel: bruto.papel }

  if (!ehUuid(companyId)) return { erro: 'Distribuidora inválida.', valores, tentativa }

  const analise = esquemaAcesso.safeParse(bruto)
  if (!analise.success) {
    const porCampo = z.flattenError(analise.error).fieldErrors as Record<
      string,
      string[] | undefined
    >
    const campos: Partial<Record<CampoAcesso, string>> = {}
    for (const campo of CAMPOS_ACESSO) {
      const msg = porCampo[campo]?.[0]
      if (msg) campos[campo] = msg
    }
    return { campos, valores, tentativa }
  }

  const { nome, email, senha, papel } = analise.data
  const hash = await bcrypt.hash(senha, CUSTO_BCRYPT)

  const [resultado] = await db.execute<{ admin_criar_usuario: string }>(
    sql`select admin_criar_usuario(${uuidv7()}, ${companyId}, ${nome}, ${email}, ${hash}, ${papel})`,
  )

  switch (resultado?.admin_criar_usuario) {
    case 'ok':
      break
    case 'email':
      return {
        campos: { email: 'Este e-mail já é login de alguém no sistema' },
        valores,
        tentativa,
      }
    default:
      return { erro: 'Essa distribuidora não existe mais ou foi desativada.', valores, tentativa }
  }

  revalidatePath(`/admin/empresas/${companyId}`)
  // A contagem de usuários da portaria fica errada sem isto.
  revalidatePath('/admin')

  return { ok: `Acesso de ${nome} criado. Repasse o e-mail e a senha.`, tentativa }
}

/**
 * Desativa ou reativa, conforme o estado que o formulário mandar.
 *
 * Uma ação para os dois sentidos porque é uma operação só — o botão da linha
 * envia o valor oposto ao atual. Duas actions quase idênticas seria a mesma
 * regra escrita duas vezes, e a segunda envelheceria.
 */
export async function alternarAcesso(form: FormData) {
  await exigirAdmin()

  const companyId = String(form.get('companyId') ?? '')
  const usuarioId = String(form.get('usuarioId') ?? '')
  const ativo = String(form.get('ativo') ?? '') === 'true'

  if (!ehUuid(companyId) || !ehUuid(usuarioId)) return

  await db.execute(sql`select admin_definir_ativo(${usuarioId}, ${companyId}, ${ativo})`)

  revalidatePath(`/admin/empresas/${companyId}`)
  revalidatePath('/admin')
}

export async function redefinirSenhaAcesso(
  anterior: EstadoAcesso,
  form: FormData,
): Promise<EstadoAcesso> {
  await exigirAdmin()

  const companyId = String(form.get('companyId') ?? '')
  const tentativa = (anterior.tentativa ?? 0) + 1

  if (!ehUuid(companyId)) return { erro: 'Distribuidora inválida.', tentativa }

  // O campo se chama `novaSenha` no HTML e `senha` no esquema: a tela de
  // acessos tem o formulário de criar e o de redefinir no mesmo documento, e
  // dois campos `senha` ali dentro seriam ambíguos. Ver `linha-acesso.tsx`.
  const analise = esquemaNovaSenha.safeParse({
    usuarioId: String(form.get('usuarioId') ?? ''),
    senha: String(form.get('novaSenha') ?? ''),
  })

  if (!analise.success) {
    const porCampo = z.flattenError(analise.error).fieldErrors as Record<
      string,
      string[] | undefined
    >
    return {
      campos: { senha: porCampo.senha?.[0] },
      erro: porCampo.usuarioId?.[0],
      tentativa,
    }
  }

  const hash = await bcrypt.hash(analise.data.senha, CUSTO_BCRYPT)

  const [resultado] = await db.execute<{ admin_redefinir_senha: boolean }>(
    sql`select admin_redefinir_senha(${analise.data.usuarioId}, ${companyId}, ${hash})`,
  )

  if (!resultado?.admin_redefinir_senha) {
    return { erro: 'Esse acesso não existe mais nessa distribuidora.', tentativa }
  }

  revalidatePath(`/admin/empresas/${companyId}`)
  return { ok: 'Senha redefinida. Repasse a nova senha.', tentativa }
}
