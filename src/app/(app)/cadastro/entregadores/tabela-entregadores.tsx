'use client'

import Link from 'next/link'
import { PhoneOff, UserPlus } from 'lucide-react'
import { BotaoExcluirCadastro } from '@/components/ui/botao-excluir-cadastro'
import { Button } from '@/components/ui/button'
import { TabelaDados } from '@/components/ui/tabela/tabela-dados'
import type { Coluna } from '@/components/ui/tabela/tipos'
import { formatarTelefone } from '@/lib/formatos'
import { alternarAtivoEntregador } from '@/modules/entregadores/acoes'
import type { EntregadorLista } from '@/modules/entregadores/consultas'

const colunas: Coluna<EntregadorLista>[] = [
  {
    chave: 'codigo',
    cabecalho: 'Código',
    texto: (e) => (e.codigo ? String(e.codigo).padStart(4, '0') : '—'),
    valor: (e) => e.codigo ?? 0,
    numerica: true,
    larguraMin: '5rem',
  },
  {
    chave: 'nome',
    cabecalho: 'Entregador',
    texto: (e) => e.nome,
    fixa: true,
    larguraMin: '15rem',
    papelMobile: 'titulo',
  },
  {
    chave: 'telefone',
    cabecalho: 'Telefone',
    texto: (e) => (e.telefone ? formatarTelefone(e.telefone) : '—'),
    celula: (e) =>
      e.telefone ? (
        formatarTelefone(e.telefone)
      ) : (
        <span className="inline-flex items-center gap-1 text-perigo">
          <PhoneOff className="size-3.5" aria-hidden />
          sem telefone
        </span>
      ),
  },
  {
    chave: 'acoes',
    cabecalho: 'Ações',
    texto: () => '',
    celula: (e) => (
      <BotaoExcluirCadastro aoExcluir={() => alternarAtivoEntregador(e.id, false)} />
    ),
    ordenavel: false,
    alinhamento: 'direita',
    larguraMin: '8rem',
  },
]

export function TabelaEntregadores({ linhas }: { linhas: EntregadorLista[] }) {
  return (
    <TabelaDados
      id="entregadores"
      legenda="Entregadores cadastrados"
      colunas={colunas}
      linhas={linhas}
      chaveLinha={(e) => e.id}
      linkDaLinha={(e) => `/cadastro/entregadores/${e.id}`}
      buscaPlaceholder="Buscar por nome…"
      nomeExportacao="entregadores"
      acoesTopo={
        <Button asChild variant="primario">
          <Link href="/cadastro/entregadores/novo">
            <UserPlus aria-hidden />
            Novo entregador
          </Link>
        </Button>
      }
      vazio={{
        titulo: 'Nenhum entregador cadastrado',
        descricao: 'Cadastre o primeiro entregador para marcar quem entrega cada venda no PDV.',
        acao: (
          <Button asChild variant="primario">
            <Link href="/cadastro/entregadores/novo">
              <UserPlus aria-hidden />
              Cadastrar primeiro entregador
            </Link>
          </Button>
        ),
      }}
    />
  )
}
