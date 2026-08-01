'use client'

import Link from 'next/link'
import { PhoneOff, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabelaDados } from '@/components/ui/tabela/tabela-dados'
import type { Coluna } from '@/components/ui/tabela/tipos'
import { formatarDocumento, formatarTelefone } from '@/lib/formatos'
import type { FornecedorLista } from '@/modules/fornecedores/consultas'

const colunas: Coluna<FornecedorLista>[] = [
  {
    chave: 'codigo',
    cabecalho: 'Código',
    texto: (f) => (f.codigo ? String(f.codigo).padStart(4, '0') : '—'),
    valor: (f) => f.codigo ?? 0,
    numerica: true,
    larguraMin: '5rem',
  },
  {
    chave: 'nome',
    cabecalho: 'Fornecedor',
    texto: (f) => f.nome,
    celula: (f) => (
      <span className="flex items-center gap-2">
        <span className="truncate">{f.nome}</span>
        {!f.ativo && (
          <Badge variant="neutro" className="shrink-0">
            inativo
          </Badge>
        )}
      </span>
    ),
    fixa: true,
    larguraMin: '15rem',
    papelMobile: 'titulo',
  },
  {
    chave: 'documento',
    cabecalho: 'CPF / CNPJ',
    texto: (f) => (f.documento ? formatarDocumento(f.documento) : '—'),
    celula: (f) =>
      f.documento ? (
        formatarDocumento(f.documento)
      ) : (
        <span className="text-texto-fraco">não informado</span>
      ),
  },
  {
    chave: 'telefone',
    cabecalho: 'Telefone',
    texto: (f) => (f.telefone ? formatarTelefone(f.telefone) : '—'),
    celula: (f) =>
      f.telefone ? (
        formatarTelefone(f.telefone)
      ) : (
        <span className="inline-flex items-center gap-1 text-perigo">
          <PhoneOff className="size-3.5" aria-hidden />
          sem telefone
        </span>
      ),
  },
  {
    chave: 'cidade',
    cabecalho: 'Cidade',
    texto: (f) => f.cidade || '—',
  },
  {
    chave: 'uf',
    cabecalho: 'UF',
    texto: (f) => f.uf || '—',
  },
]

export function TabelaFornecedores({ linhas }: { linhas: FornecedorLista[] }) {
  return (
    <TabelaDados
      id="fornecedores"
      legenda="Fornecedores cadastrados"
      colunas={colunas}
      linhas={linhas}
      chaveLinha={(f) => f.id}
      linkDaLinha={(f) => `/cadastro/fornecedores/${f.id}`}
      buscaPlaceholder="Buscar por nome, documento, cidade…"
      nomeExportacao="fornecedores"
      acoesTopo={
        <Button asChild variant="primario">
          <Link href="/cadastro/fornecedores/novo">
            <UserPlus aria-hidden />
            Novo fornecedor
          </Link>
        </Button>
      }
      vazio={{
        titulo: 'Nenhum fornecedor cadastrado',
        descricao:
          'Cadastre o primeiro fornecedor para vincular a compras e contas a pagar.',
        acao: (
          <Button asChild variant="primario">
            <Link href="/cadastro/fornecedores/novo">
              <UserPlus aria-hidden />
              Cadastrar primeiro fornecedor
            </Link>
          </Button>
        ),
      }}
    />
  )
}
