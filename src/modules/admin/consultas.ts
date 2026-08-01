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
