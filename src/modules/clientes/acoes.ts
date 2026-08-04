'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { uuidv7 } from 'uuidv7'
import { clientes } from '@/db/schema'
import { comTenant } from '@/lib/dal'
import { descreverFalha } from '@/lib/erros'
import { acharPorDocumento } from './consultas'
import {
  CAMPOS_CLIENTE,
  esquemaCliente,
  type CampoCliente,
  type EstadoFormularioCliente,
} from './esquema'

/**
 * Gravação de cliente.
 *
 * Primeira escrita de negócio do sistema. O padrão daqui é o que as outras
 * telas vão copiar, então vale dizer o que ele resolve:
 *
 * 1. Valida com o mesmo esquema que o formulário usa — regra em um lugar só.
 * 2. Devolve os valores digitados junto com o erro. Formulário que limpa o que
 *    a pessoa escreveu é o jeito mais rápido de perder a confiança dela.
 * 3. Escreve dentro de `comTenant()`, então `company_id` vem da sessão e nunca
 *    do formulário — não existe campo que o navegador possa forjar.
 * 4. Traduz a violação do índice único numa frase que diz qual cadastro já
 *    tem aquele documento.
 */

function lerFormulario(form: FormData) {
  return Object.fromEntries(
    CAMPOS_CLIENTE.map((campo) => [campo, String(form.get(campo) ?? '')]),
  ) as Record<CampoCliente, string>
}

function erroDeValidacao(
  erro: z.ZodError,
  valores: Record<CampoCliente, string>,
  tentativa: number,
): EstadoFormularioCliente {
  const porCampo = z.flattenError(erro).fieldErrors as Record<string, string[] | undefined>
  const campos: Partial<Record<CampoCliente, string>> = {}
  for (const campo of CAMPOS_CLIENTE) {
    const msg = porCampo[campo]?.[0]
    if (msg) campos[campo] = msg
  }
  return { campos, valores, tentativa }
}

/**
 * Documento repetido: checa antes para dar mensagem boa, e captura a violação
 * do índice depois para o caso de duas operadoras salvarem no mesmo instante.
 * A checagem sozinha teria corrida; o índice sozinho teria mensagem ilegível.
 */
async function documentoEmUso(
  documento: string | null,
  exceto: string | undefined,
  valores: Record<CampoCliente, string>,
  tentativa: number,
): Promise<EstadoFormularioCliente | null> {
  if (!documento) return null
  const dono = await acharPorDocumento(documento, exceto)
  if (!dono) return null
  return {
    campos: {
      documento: `Já existe em ${dono.codigo ? `${String(dono.codigo).padStart(4, '0')} - ` : ''}${dono.nome}`,
    },
    valores,
    tentativa,
  }
}

function ehDocumentoDuplicado(err: unknown) {
  return (
    typeof err === 'object' &&
    err !== null &&
    'constraint_name' in err &&
    err.constraint_name === 'clientes_documento_unico'
  )
}

export async function criarCliente(
  anterior: EstadoFormularioCliente,
  form: FormData,
): Promise<EstadoFormularioCliente> {
  // O estado anterior chega de graça na assinatura do `useActionState`, e é o
  // único contador de tentativas confiável: um `useState` na tela seria zerado
  // pela própria remontagem que ele existe para disparar.
  const tentativa = (anterior.tentativa ?? 0) + 1
  const valores = lerFormulario(form)
  const analise = esquemaCliente.safeParse(valores)
  if (!analise.success) return erroDeValidacao(analise.error, valores, tentativa)

  const dados = analise.data
  const conflito = await documentoEmUso(dados.documento, undefined, valores, tentativa)
  if (conflito) return conflito

  // UUID v7 gerado aqui, não pelo banco: ele carrega o instante da criação,
  // então a chave já ordena por tempo — e o dia em que a Etapa 7 voltar, o
  // dispositivo do entregador gera o mesmo tipo de id sem coordenar com nada.
  const id = uuidv7()

  try {
    await comTenant((tx, sessao) =>
      tx.insert(clientes).values({
        id,
        companyId: sessao.companyId,
        ...dados,
        limiteCredito: String(dados.limiteCredito),
      }),
    )
  } catch (err) {
    if (ehDocumentoDuplicado(err)) {
      return {
        campos: { documento: 'Este CPF/CNPJ já está em outro cadastro.' },
        valores,
        tentativa,
      }
    }
    // Em vez de deixar estourar para a tela de erro do Next — que diz
    // "An unexpected error occurred" e nada mais, apagando o que foi
    // digitado. Aqui o formulário continua preenchido e a frase diz de
    // quem é o problema. Ver src/lib/erros.ts.
    return { erro: descreverFalha(err), valores, tentativa }
  }

  revalidatePath('/cadastro/clientes')
  redirect(`/cadastro/clientes?novo=${id}`)
}

export async function atualizarCliente(
  id: string,
  anterior: EstadoFormularioCliente,
  form: FormData,
): Promise<EstadoFormularioCliente> {
  const tentativa = (anterior.tentativa ?? 0) + 1
  const valores = lerFormulario(form)
  const analise = esquemaCliente.safeParse(valores)
  if (!analise.success) return erroDeValidacao(analise.error, valores, tentativa)

  const dados = analise.data
  const conflito = await documentoEmUso(dados.documento, id, valores, tentativa)
  if (conflito) return conflito

  try {
    const alteradas = await comTenant((tx) =>
      tx
        .update(clientes)
        .set({ ...dados, limiteCredito: String(dados.limiteCredito) })
        .where(eq(clientes.id, id))
        .returning({ id: clientes.id }),
    )

    // Zero linhas com id existente significa cliente de outro tenant: a RLS
    // filtrou e o `update` não achou nada. Mensagem igual à de não existir —
    // confirmar que o registro existe em outra empresa já é vazar informação.
    if (alteradas.length === 0) {
      return { erro: 'Cliente não encontrado.', valores, tentativa }
    }
  } catch (err) {
    if (ehDocumentoDuplicado(err)) {
      return {
        campos: { documento: 'Este CPF/CNPJ já está em outro cadastro.' },
        valores,
        tentativa,
      }
    }
    // Em vez de deixar estourar para a tela de erro do Next — que diz
    // "An unexpected error occurred" e nada mais, apagando o que foi
    // digitado. Aqui o formulário continua preenchido e a frase diz de
    // quem é o problema. Ver src/lib/erros.ts.
    return { erro: descreverFalha(err), valores, tentativa }
  }

  revalidatePath('/cadastro/clientes')
  redirect('/cadastro/clientes')
}

/**
 * Inativa e reativa. **Não existe apagar cliente.**
 *
 * Cliente tem venda, título e extrato de vasilhame pendurados nele. Apagar
 * levaria junto o histórico que explica o saldo — e no dia em que ele
 * reclamasse de estar devendo vasilhame, não haveria como responder. O banco
 * também recusa, por `on delete restrict`; aqui a interface nem oferece.
 */
export async function alternarAtivoCliente(id: string, ativo: boolean) {
  await comTenant((tx) =>
    tx.update(clientes).set({ ativo }).where(eq(clientes.id, id)),
  )
  // `'layout'` e não o padrão `'page'`: o botão vive na ficha
  // (`/cadastro/clientes/[id]`), não na lista. Revalidando só a lista, quem
  // clicasse em "Inativar" ficaria olhando um botão que não muda, com a
  // gravação já feita no banco — o pior tipo de falha, porque leva a clicar
  // de novo. Com `'layout'`, a lista e todas as fichas abaixo dela recarregam.
  revalidatePath('/cadastro/clientes', 'layout')
}
