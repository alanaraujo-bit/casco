'use client'

import Link from 'next/link'
import { ArrowLeftRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabelaDados } from '@/components/ui/tabela/tabela-dados'
import type { Coluna } from '@/components/ui/tabela/tipos'
import { formatarData, formatarTelefone } from '@/lib/formatos'
import type { SaldoLista } from '@/modules/vasilhame/consultas'

/**
 * Quem está devendo vasilhame.
 *
 * A coluna de quantidade é a razão da tela e por isso é a que ordena por
 * padrão, do maior para o menor — quem já vem ordenado pelo banco. Saldo
 * negativo aparece em âmbar e não em vermelho: não é erro, é o cliente que
 * devolveu mais do que levou (comum na migração, quando ele já tinha vasilhame
 * nosso antes do sistema existir). Vermelho ali ensinaria a ignorar vermelho.
 */
const colunas: Coluna<SaldoLista>[] = [
  {
    chave: 'codigo',
    cabecalho: 'Código',
    texto: (s) => (s.clienteCodigo ? String(s.clienteCodigo).padStart(4, '0') : '—'),
    valor: (s) => s.clienteCodigo ?? 0,
    numerica: true,
    larguraMin: '5rem',
    papelMobile: 'oculto',
  },
  {
    chave: 'cliente',
    cabecalho: 'Cliente',
    texto: (s) => s.cliente,
    fixa: true,
    larguraMin: '14rem',
    papelMobile: 'titulo',
  },
  {
    chave: 'produto',
    cabecalho: 'Vasilhame',
    texto: (s) => s.produto,
    larguraMin: '10rem',
  },
  {
    chave: 'quantidade',
    cabecalho: 'Em poder do cliente',
    texto: (s) => String(s.quantidade),
    valor: (s) => s.quantidade,
    numerica: true,
    celula: (s) => (
      <span
        className={
          s.quantidade < 0 ? 'font-medium text-alerta' : 'font-medium tabular-nums text-texto'
        }
      >
        {s.quantidade > 0 ? s.quantidade : `${s.quantidade}`}
      </span>
    ),
    papelMobile: 'destaque',
  },
  {
    chave: 'telefone',
    cabecalho: 'Telefone',
    texto: (s) => (s.telefone ? formatarTelefone(s.telefone) : '—'),
    celula: (s) =>
      s.telefone ? (
        // `tel:` para cobrar do celular sem copiar número na mão. `stopPropagation`
        // porque a linha inteira é um link para o extrato, e tocar no telefone
        // dentro dela não pode navegar em vez de ligar.
        <a
          href={`tel:${s.telefone}`}
          onClick={(e) => e.stopPropagation()}
          className="text-acento-texto underline-offset-4 hover:underline"
        >
          {formatarTelefone(s.telefone)}
        </a>
      ) : (
        <span className="text-texto-fraco">—</span>
      ),
  },
  {
    chave: 'atualizadoEm',
    cabecalho: 'Última movimentação',
    texto: (s) => formatarData(s.atualizadoEm),
    valor: (s) => new Date(s.atualizadoEm),
    ocultaPorPadrao: true,
    papelMobile: 'campo',
  },
]

export function TabelaSaldos({ linhas }: { linhas: SaldoLista[] }) {
  return (
    <TabelaDados
      id="vasilhame-saldos"
      legenda="Vasilhames em poder dos clientes"
      colunas={colunas}
      linhas={linhas}
      chaveLinha={(s) => `${s.clienteId}:${s.produtoId}`}
      linkDaLinha={(s) => `/vasilhame/saldos/${s.clienteId}`}
      buscaPlaceholder="Buscar por cliente ou vasilhame…"
      nomeExportacao="vasilhame-saldos"
      acoesTopo={
        <Button asChild variant="primario">
          <Link href="/vasilhame/baixa">
            <ArrowLeftRight aria-hidden />
            Nova baixa
          </Link>
        </Button>
      }
      vazio={{
        titulo: 'Nenhum vasilhame na rua',
        descricao:
          'Ninguém está devendo vasilhame no momento. Assim que uma entrega for lançada, o saldo do cliente aparece aqui.',
        acao: (
          <Button asChild variant="primario">
            <Link href="/vasilhame/baixa">
              <ArrowLeftRight aria-hidden />
              Lançar movimento
            </Link>
          </Button>
        ),
      }}
    />
  )
}

export function SeloSaldo({ quantidade }: { quantidade: number }) {
  if (quantidade === 0) return <Badge variant="sucesso">quite</Badge>
  if (quantidade < 0) return <Badge variant="alerta">{quantidade}</Badge>
  return <Badge variant="info">{quantidade} em aberto</Badge>
}
