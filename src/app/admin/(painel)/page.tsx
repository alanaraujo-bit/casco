import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, TriangleAlert, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EstadoVazio } from '@/components/ui/estados'
import { exigirAdminPronto } from '@/lib/dal'
import { formatarData, formatarDocumento } from '@/lib/formatos'
import { listarEmpresas } from '@/modules/admin/consultas'
import { entrarNaEmpresa } from '@/modules/admin/acoes'

export const metadata: Metadata = { title: 'Distribuidoras' }

type Props = { searchParams: Promise<{ erro?: string }> }

/**
 * A portaria: escolha a distribuidora e entre.
 *
 * Uma lista e um botão por linha. Nada de gráfico de MRR nem de painel de
 * métricas da Aionix — o dia em que isso for útil, será uma tela pensada, não
 * um enfeite acumulado aqui. Hoje a única pergunta que este painel responde é
 * "em qual empresa eu entro".
 */
export default async function PainelAdmin({ searchParams }: Props) {
  // `searchParams` é assíncrono nesta versão do Next.
  const [{ erro }, admin, empresas] = await Promise.all([
    searchParams,
    exigirAdminPronto(),
    listarEmpresas(),
  ])

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-texto">Distribuidoras</h1>
        <p className="text-sm text-texto-suave">
          Olá, {admin.nome.split(/\s+/)[0]}. Escolha uma empresa para entrar no sistema.
        </p>
      </div>

      {erro === 'empresa' && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md bg-perigo-bg px-3 py-2.5 text-sm text-perigo"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>Essa distribuidora não existe mais ou foi desativada.</span>
        </div>
      )}

      {empresas.length === 0 ? (
        <EstadoVazio
          titulo="Nenhuma distribuidora cadastrada"
          descricao="Crie a primeira rodando npm run empresa:criar."
        />
      ) : (
        <ul className="space-y-2">
          {empresas.map((e) => (
            <li key={e.id}>
              <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-texto">{e.nome}</span>
                    {!e.ativo && <Badge variant="perigo">Desativada</Badge>}
                    <Badge variant="neutro">{e.plano}</Badge>
                  </div>
                  <p className="text-xs text-texto-fraco">
                    {e.documento ? `${formatarDocumento(e.documento)} · ` : ''}
                    {e.usuarios} {e.usuarios === 1 ? 'usuário' : 'usuários'} ·{' '}
                    {e.clientes} {e.clientes === 1 ? 'cliente' : 'clientes'} · desde{' '}
                    {formatarData(e.criadoEm)}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                  {/* Este é `<Link>` e o de baixo é `<form>`, e a diferença
                      importa: ver acessos é leitura, entrar na empresa grava
                      cookie de sessão. */}
                  <Button asChild variant="secundario" size="sm" className="w-full sm:w-auto">
                    <Link href={`/admin/empresas/${e.id}`}>
                      <Users aria-hidden />
                      Acessos
                    </Link>
                  </Button>

                  {/* `<form action>` porque isto grava um cookie de sessão: é uma
                      mudança de estado, não uma navegação. Um `<Link>` aqui seria
                      um GET que troca a empresa da sessão — exatamente o tipo de
                      coisa que um prefetch dispara sem ninguém clicar. */}
                  <form action={entrarNaEmpresa}>
                    <input type="hidden" name="empresaId" value={e.id} />
                    <Button
                      type="submit"
                      variant={e.ativo ? 'primario' : 'secundario'}
                      size="sm"
                      disabled={!e.ativo}
                      className="w-full sm:w-auto"
                    >
                      Entrar
                      <ArrowRight aria-hidden />
                    </Button>
                  </form>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
