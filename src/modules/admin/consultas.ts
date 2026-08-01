import 'server-only'

import { sql } from 'drizzle-orm'
import { db } from '@/db/client'
import { exigirAdmin } from '@/lib/dal'

/**
 * Leitura do painel da Aionix.
 *
 * Único lugar do sistema que consulta fora do `comTenant()`, e por um motivo
 * exato: aqui a pergunta é "quais distribuidoras existem", que por definição
 * não tem tenant. A resposta vem de `admin_listar_empresas()`, função
 * `security definer` da migration 0008 — ela devolve um resumo por empresa e
 * nada da operação. Nenhum dado de negócio sai daqui.
 *
 * `exigirAdmin()` na primeira linha é a tranca. A função do banco é executável
 * por `casco_app`, então o que impede uma tela de negócio de chamar isto é
 * estar atrás deste guard e do `server-only` acima.
 */

export interface EmpresaResumo {
  id: string
  nome: string
  documento: string | null
  plano: string
  ativo: boolean
  criadoEm: Date
  usuarios: number
  clientes: number
}

export async function listarEmpresas(): Promise<EmpresaResumo[]> {
  await exigirAdmin()

  const linhas = await db.execute<{
    id: string
    nome: string
    documento: string | null
    plano: string
    ativo: boolean
    criado_em: Date
    usuarios: number
    clientes: number
  }>(sql`select * from admin_listar_empresas()`)

  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    documento: l.documento,
    plano: l.plano,
    ativo: l.ativo,
    criadoEm: l.criado_em,
    usuarios: Number(l.usuarios),
    clientes: Number(l.clientes),
  }))
}

// ------------------------------------------------------------------ acessos

/**
 * A distribuidora, conferida antes de a tela de acessos abrir.
 *
 * `admin_empresa` só devolve empresa ativa, então uma URL com id inventado ou
 * de empresa desativada volta `null` e a página responde 404 — em vez de
 * renderizar um cabeçalho vazio com um formulário funcionando embaixo.
 */
export async function acharEmpresa(id: string): Promise<{ id: string; nome: string } | null> {
  await exigirAdmin()

  // Sem isto, um `id` que não é UUID chega ao Postgres e vira erro de tipo
  // (22P02) no meio do render. A URL é entrada do usuário como qualquer outra.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null

  const [empresa] = await db.execute<{ id: string; nome: string }>(
    sql`select * from admin_empresa(${id})`,
  )
  return empresa ?? null
}

export interface AcessoResumo {
  id: string
  nome: string
  email: string
  papel: string
  ativo: boolean
  criadoEm: Date
}

export async function listarAcessos(companyId: string): Promise<AcessoResumo[]> {
  await exigirAdmin()

  const linhas = await db.execute<{
    id: string
    nome: string
    email: string
    papel: string
    ativo: boolean
    criado_em: Date
  }>(sql`select * from admin_listar_usuarios(${companyId})`)

  return linhas.map((l) => ({
    id: l.id,
    nome: l.nome,
    email: l.email,
    papel: l.papel,
    ativo: l.ativo,
    criadoEm: l.criado_em,
  }))
}
