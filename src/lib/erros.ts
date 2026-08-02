/**
 * Traduz a recusa do banco para uma frase que serve a quem está no balcão.
 *
 * **O problema que este arquivo existe para resolver.** Toda action terminava
 * com um `catch` que devolvia a mesma frase — "Não foi possível gravar. Tente
 * de novo." — e essa frase é o pior conselho possível em quase todos os casos
 * reais. Quando a causa é um dígito errado, ela não diz qual. Quando é uma
 * regra do negócio, ela não diz qual regra. E quando é um bug nosso, ela manda
 * a operadora repetir uma operação que vai falhar para sempre, até ela desistir
 * e lançar por fora do sistema — que é exatamente o comportamento que estamos
 * substituindo.
 *
 * Foi assim que um bug real passou despercebido: escrita feita por admin da
 * Aionix dentro de uma distribuidora violava a FK de `usuario_id`, e a tela
 * dizia "Tente de novo".
 *
 * **Toda falha responde quatro perguntas**, porque são as quatro que a pessoa
 * faz olhando a tela:
 *
 *   1. O que aconteceu?            → `titulo`
 *   2. Por quê?                    → `detalhe`
 *   3. Fui eu ou foi o sistema?    → `culpa`
 *   4. O que eu faço agora?        → `acao`
 *
 * E um `codigo` curto, para quando a resposta for "avise o suporte": sem ele a
 * conversa começa em "deu erro na tela de estoque", e ninguém sabe qual erro.
 */

/**
 * De quem é o problema. Muda a cor, o texto e — o que mais importa — se a
 * pessoa deve tentar de novo ou parar e chamar alguém.
 */
export type Culpa =
  /** Dá para consertar preenchendo diferente. A operadora resolve sozinha. */
  | 'usuario'
  /** Regra do negócio impediu. Não é erro de digitação; é o sistema protegendo. */
  | 'regra'
  /** Outra pessoa mexeu no mesmo registro. Recarregar resolve. */
  | 'conflito'
  /** Bug ou indisponibilidade. Repetir não adianta — alguém precisa olhar. */
  | 'sistema'

export interface Falha {
  titulo: string
  detalhe?: string
  acao: string
  culpa: Culpa
  /** Curto e estável, para o usuário ditar ao suporte. Ex.: `BD-23503`. */
  codigo: string
}

/** Atalho para as recusas que a própria action detecta, antes do banco. */
export function falha(
  titulo: string,
  acao: string,
  culpa: Culpa = 'usuario',
  codigo = 'APP',
): Falha {
  return { titulo, acao, culpa, codigo }
}

/* -------------------------------------------------------------------------- */

function textoDo(err: unknown): string {
  if (err instanceof Error) return `${err.message} ${String((err as { detail?: string }).detail ?? '')}`
  return String(err)
}

function codigoPg(err: unknown): string {
  const c = (err as { code?: unknown })?.code
  return typeof c === 'string' ? c : ''
}

/**
 * As regras que moram no banco, com o nome do constraint que as guarda.
 *
 * A ordem importa: a primeira que casar ganha. São todas alcançáveis apenas por
 * caminho torto — o `esquema.ts` de cada módulo barra antes — mas "apenas por
 * caminho torto" inclui script solto, requisição forjada e bug nosso. Quando
 * acontecer, o que a operadora não pode ver é
 * `violates check constraint "estoque_mov_sinal_coerente"`.
 */
const REGRAS: { marca: string; falha: Omit<Falha, 'codigo'>; codigo: string }[] = [
  /* ------------------------------------------------------------ vasilhame */
  {
    marca: 'vasilhame_mov_exige_cliente',
    codigo: 'VAS-CLIENTE',
    falha: {
      titulo: 'Este motivo precisa de um cliente',
      detalhe:
        'Entregue, devolvido e perdido pelo cliente mudam o saldo de alguém — e dívida precisa de devedor.',
      acao: 'Escolha o cliente no campo acima e lance de novo.',
      culpa: 'usuario',
    },
  },
  {
    marca: 'vasilhame_mov_fabrica_sem_cliente',
    codigo: 'VAS-FABRICA',
    falha: {
      titulo: 'Movimento de fábrica não tem cliente',
      detalhe: 'Enviado à fábrica e retornou da fábrica são movimentos internos, entre depósitos.',
      acao: 'Deixe o campo de cliente vazio e lance de novo.',
      culpa: 'usuario',
    },
  },
  {
    marca: 'vasilhame_mov_sinal_coerente',
    codigo: 'VAS-SINAL',
    falha: {
      titulo: 'O sentido não combina com o motivo escolhido',
      detalhe: 'Cada motivo já decide se o galão sai ou volta; a quantidade é sempre positiva.',
      acao: 'Recarregue a tela e lance de novo. Se repetir, avise o suporte.',
      culpa: 'sistema',
    },
  },
  {
    marca: 'vasilhame_mov_estorno_unico',
    codigo: 'VAS-ESTORNO-2X',
    falha: {
      titulo: 'Este movimento já foi estornado',
      detalhe: 'Um lançamento só pode ser desfeito uma vez.',
      acao: 'Recarregue a lista para ver o estorno que já existe.',
      culpa: 'conflito',
    },
  },
  {
    marca: 'Não se estorna um estorno',
    codigo: 'VAS-ESTORNO-DE-ESTORNO',
    falha: {
      titulo: 'Não dá para estornar um estorno',
      detalhe: 'O estorno já é a correção de outro lançamento.',
      acao: 'Se o saldo ainda está errado, lance o movimento certo em vez de desfazer este.',
      culpa: 'usuario',
    },
  },
  {
    marca: 'Movimento a estornar não encontrado',
    codigo: 'VAS-ESTORNO-SUMIU',
    falha: {
      titulo: 'O lançamento que você quer desfazer não está mais aqui',
      acao: 'Recarregue a tela — a lista pode ter mudado desde que você abriu.',
      culpa: 'conflito',
    },
  },
  {
    marca: 'quantidade oposta',
    codigo: 'VAS-ESTORNO-QTD',
    falha: {
      titulo: 'O estorno não bate com o lançamento original',
      detalhe: 'Ele precisa espelhar exatamente o que foi lançado.',
      acao: 'Recarregue a tela e tente de novo. Se repetir, avise o suporte.',
      culpa: 'sistema',
    },
  },
  {
    marca: 'Estorno tem que espelhar',
    codigo: 'VAS-ESTORNO-ESPELHO',
    falha: {
      titulo: 'O estorno não bate com o lançamento original',
      acao: 'Recarregue a tela e tente de novo. Se repetir, avise o suporte.',
      culpa: 'sistema',
    },
  },
  {
    marca: 'Movimento de vasilhame não pode ser',
    codigo: 'VAS-IMUTAVEL',
    falha: {
      titulo: 'Movimento de vasilhame não se edita nem se apaga',
      detalhe: 'Ele é lançamento contábil: o histórico precisa continuar explicando o saldo.',
      acao: 'Use Estornar. O lançamento contrário aparece no extrato, ao lado do original.',
      culpa: 'regra',
    },
  },

  /* -------------------------------------------------------------- estoque */
  {
    marca: 'estoque_mov_fornecedor_so_compra',
    codigo: 'EST-FORNECEDOR',
    falha: {
      titulo: 'Só a compra tem fornecedor',
      detalhe: 'Produção, ajuste, perda e devolução não têm de quem cobrar.',
      acao: 'Troque o tipo para Compra, ou deixe o fornecedor em branco.',
      culpa: 'usuario',
    },
  },
  {
    marca: 'estoque_mov_sinal_coerente',
    codigo: 'EST-SINAL',
    falha: {
      titulo: 'O sentido não combina com o tipo escolhido',
      detalhe: 'Cada tipo já decide se a mercadoria entra ou sai.',
      acao: 'Recarregue a tela e lance de novo. Se repetir, avise o suporte.',
      culpa: 'sistema',
    },
  },
  {
    marca: 'estoque_movimentos_tipo_check',
    codigo: 'EST-TIPO',
    falha: {
      titulo: 'Tipo de movimento desconhecido',
      acao: 'Recarregue a tela e escolha o tipo de novo. Se repetir, avise o suporte.',
      culpa: 'sistema',
    },
  },
  {
    marca: 'estoque_mov_estorno_unico',
    codigo: 'EST-ESTORNO-2X',
    falha: {
      titulo: 'Este movimento já foi estornado',
      detalhe: 'Um lançamento só pode ser desfeito uma vez.',
      acao: 'Recarregue a lista para ver o estorno que já existe.',
      culpa: 'conflito',
    },
  },
  {
    // O check nasce em `estoque_movimentos` e em `vasilhame_movimentos`, com o
    // mesmo texto. A frase serve aos dois.
    marca: 'quantidade <> 0',
    codigo: 'QTD-ZERO',
    falha: {
      titulo: 'A quantidade não pode ser zero',
      acao: 'Informe quantas unidades entraram ou saíram e lance de novo.',
      culpa: 'usuario',
    },
  },
  {
    marca: 'Movimento de estoque não pode ser',
    codigo: 'EST-IMUTAVEL',
    falha: {
      titulo: 'Movimento de estoque não se edita nem se apaga',
      detalhe: 'Ele é lançamento contábil: o extrato precisa continuar explicando o saldo.',
      acao: 'Use Estornar, ou lance um ajuste de inventário com a contagem certa.',
      culpa: 'regra',
    },
  },

  /* ----------------------------------------------------------- financeiro */
  {
    marca: 'contas_receber_baixa_completa',
    codigo: 'FIN-BAIXA-METADE',
    falha: {
      titulo: 'A baixa precisa de data e valor juntos',
      detalhe: 'Título com valor pago e sem data trava a conciliação: sabe-se quanto entrou, não quando.',
      acao: 'Preencha os dois campos e confirme de novo.',
      culpa: 'usuario',
    },
  },
  {
    marca: 'contas_pagar_baixa_completa',
    codigo: 'FIN-PAGAMENTO-METADE',
    falha: {
      titulo: 'O pagamento precisa de data e valor juntos',
      acao: 'Preencha os dois campos e confirme de novo.',
      culpa: 'usuario',
    },
  },
  {
    marca: 'contas_pagar_origem_check',
    codigo: 'FIN-ORIGEM',
    falha: {
      titulo: 'Origem de conta a pagar inválida',
      acao: 'Recarregue a tela e lance de novo. Se repetir, avise o suporte.',
      culpa: 'sistema',
    },
  },
  {
    marca: 'parcela_valida',
    codigo: 'FIN-PARCELA',
    falha: {
      titulo: 'A numeração das parcelas não fecha',
      detalhe: 'O número da parcela não pode ser maior que o total.',
      acao: 'Recarregue a tela e lance de novo. Se repetir, avise o suporte.',
      culpa: 'sistema',
    },
  },
  {
    marca: 'formas_pagamento_tipo_check',
    codigo: 'FIN-TIPO-FORMA',
    falha: {
      titulo: 'Tipo de forma de pagamento desconhecido',
      acao: 'Escolha um tipo da lista e salve de novo.',
      culpa: 'usuario',
    },
  },

  /* ------------------------------------------------------------- cadastro */
  {
    marca: 'produtos_retornavel_tem_vasilhame',
    codigo: 'CAD-RETORNAVEL',
    falha: {
      titulo: 'Produto retornável precisa apontar o vasilhame',
      detalhe: 'É o que permite somar os galões que ficam com o cliente.',
      acao: 'Escolha o vasilhame no cadastro do produto, ou desmarque “retornável”.',
      culpa: 'usuario',
    },
  },
  {
    marca: 'produtos_vasilhame_nao_circular',
    codigo: 'CAD-CIRCULAR',
    falha: {
      titulo: 'Um produto não pode ser o próprio vasilhame',
      acao: 'Escolha outro produto como vasilhame.',
      culpa: 'usuario',
    },
  },
  {
    marca: 'clientes_documento_unico',
    codigo: 'CAD-DOC-REPETIDO',
    falha: {
      titulo: 'Já existe um cliente com este CPF/CNPJ',
      detalhe: 'Documento repetido é como se manda duas cobranças para a mesma pessoa.',
      acao: 'Procure o cadastro que já existe pela busca da lista, e edite aquele.',
      culpa: 'usuario',
    },
  },
  {
    marca: 'produtos_sku_unico',
    codigo: 'CAD-SKU-REPETIDO',
    falha: {
      titulo: 'Já existe um produto com este código interno',
      acao: 'Use outro código, ou edite o produto que já tem este.',
      culpa: 'usuario',
    },
  },
  {
    marca: 'tabelas_preco_padrao_unica',
    codigo: 'CAD-TABELA-PADRAO',
    falha: {
      titulo: 'Só pode haver uma tabela de preço padrão',
      acao: 'Desmarque a tabela padrão atual antes de marcar esta.',
      culpa: 'usuario',
    },
  },
  {
    marca: 'users_email_key',
    codigo: 'CAD-EMAIL-REPETIDO',
    falha: {
      titulo: 'Já existe um acesso com este e-mail',
      acao: 'Use outro e-mail, ou redefina a senha do acesso que já existe.',
      culpa: 'usuario',
    },
  },
]

/**
 * A causa mais comum de escrita recusada que **não** é culpa de quem digitou:
 * o autor do lançamento não existe em `users`.
 *
 * Acontece quando alguém da Aionix opera dentro de uma distribuidora pelo
 * "Acesso Aionix": a sessão carrega o id do admin, que vive em outra tabela.
 * Está corrigido em `autorDoLancamento` (`src/lib/sessao.ts`), e a entrada
 * continua aqui porque é o tipo de coisa que volta — e, quando voltar, a tela
 * precisa dizer o nome do problema em vez de mandar tentar de novo.
 */
const FK_AUTOR = {
  codigo: 'BD-23503-AUTOR',
  falha: {
    titulo: 'O sistema não conseguiu registrar quem fez este lançamento',
    detalhe:
      'Sua sessão é de suporte da Aionix, e o autor precisa ser um usuário da distribuidora.',
    acao: 'Nada foi gravado. Entre com o usuário da distribuidora, ou avise o suporte com o código abaixo.',
    culpa: 'sistema' as Culpa,
  },
}

/**
 * Códigos do Postgres, para o que não casou com nenhuma regra nomeada.
 *
 * São o último degrau antes do genérico, e existem para que "erro desconhecido"
 * ainda diga se a pessoa deve tentar de novo — que é a única coisa que ela
 * precisa decidir naquele segundo.
 */
const POR_CODIGO: Record<string, Omit<Falha, 'codigo'>> = {
  // Chave estrangeira: aponta para algo que não existe (mais).
  '23503': {
    titulo: 'Um dos registros escolhidos não existe mais',
    detalhe: 'Alguém pode ter apagado ou desativado ele enquanto esta tela estava aberta.',
    acao: 'Recarregue a tela e escolha de novo. Nada foi gravado.',
    culpa: 'conflito',
  },
  // Único: já existe.
  '23505': {
    titulo: 'Já existe um registro com estes dados',
    acao: 'Procure o cadastro que já existe pela busca da lista, e edite aquele.',
    culpa: 'usuario',
  },
  // Check: uma regra do negócio barrou.
  '23514': {
    titulo: 'Uma regra do sistema impediu este lançamento',
    acao: 'Confira os campos e tente de novo. Se estiver tudo certo, avise o suporte com o código abaixo.',
    culpa: 'regra',
  },
  // Not null: campo obrigatório vazio.
  '23502': {
    titulo: 'Faltou preencher um campo obrigatório',
    acao: 'Confira os campos marcados e envie de novo.',
    culpa: 'usuario',
  },
  // Restrict: apagar algo que outra coisa usa.
  '23001': {
    titulo: 'Este registro está em uso e não pode ser removido',
    detalhe: 'Outros lançamentos apontam para ele, e apagá-lo levaria o histórico junto.',
    acao: 'Desative em vez de apagar — o histórico continua, e ele some das listas de escolha.',
    culpa: 'regra',
  },
  // Texto inválido para o tipo.
  '22P02': {
    titulo: 'Um dos valores enviados está em formato inválido',
    acao: 'Recarregue a tela e preencha de novo. Se repetir, avise o suporte.',
    culpa: 'sistema',
  },
  // Concorrência.
  '40001': {
    titulo: 'Outra pessoa gravou no mesmo registro ao mesmo tempo',
    acao: 'Nada foi gravado. Tente de novo agora — desta vez costuma passar.',
    culpa: 'conflito',
  },
  '40P01': {
    titulo: 'Duas operações travaram uma na outra',
    acao: 'Nada foi gravado. Tente de novo agora.',
    culpa: 'conflito',
  },
  // Tempo e disponibilidade.
  '57014': {
    titulo: 'A operação demorou demais e foi cancelada',
    acao: 'Nada foi gravado. Tente de novo; se repetir, avise o suporte.',
    culpa: 'sistema',
  },
  '53300': {
    titulo: 'O banco de dados está sem conexões disponíveis',
    detalhe: 'Costuma ser passageiro, em momento de pico.',
    acao: 'Espere um minuto e tente de novo. Se continuar, avise o suporte.',
    culpa: 'sistema',
  },
  '42501': {
    titulo: 'Sua conta não tem permissão para esta operação',
    acao: 'Peça a quem administra a distribuidora para liberar, ou avise o suporte.',
    culpa: 'sistema',
  },
}

/** Queda de conexão — o `ECONNRESET` que aparece quando o banco reinicia. */
const CONEXAO: Omit<Falha, 'codigo'> = {
  titulo: 'A conexão com o banco de dados caiu no meio da operação',
  detalhe: 'Nada foi gravado pela metade: ou tudo entrou, ou nada entrou.',
  acao: 'Confira na lista se o lançamento entrou antes de repetir. Se não entrou, tente de novo.',
  culpa: 'sistema',
}

/**
 * O tradutor. É o único lugar do sistema que decide o que a operadora lê quando
 * uma escrita é recusada.
 */
export function descreverFalha(err: unknown): Falha {
  const texto = textoDo(err)
  const codigo = codigoPg(err)

  for (const regra of REGRAS) {
    if (texto.includes(regra.marca)) return { ...regra.falha, codigo: regra.codigo }
  }

  // A FK de autor é um 23503 com nome próprio, e precisa vir antes do genérico:
  // a mensagem certa aqui é "não é você", e a genérica manda recarregar a tela.
  if (codigo === '23503' && /usuario_id|vendedor_id/.test(texto)) {
    return { ...FK_AUTOR.falha, codigo: FK_AUTOR.codigo }
  }

  if (/ECONNRESET|ETIMEDOUT|ECONNREFUSED|Connection terminated|socket hang up/i.test(texto)) {
    return { ...CONEXAO, codigo: 'BD-CONEXAO' }
  }

  const porCodigo = POR_CODIGO[codigo]
  if (porCodigo) return { ...porCodigo, codigo: `BD-${codigo}` }

  /**
   * O genérico, e ele também responde as quatro perguntas.
   *
   * O que ele **não** faz é mandar tentar de novo sem qualificar: se chegou
   * aqui, nós não sabemos a causa, e repetir pode falhar para sempre. Dizer
   * "avise o suporte" com um código é mais honesto — e é o que transforma um
   * relato de "deu erro" em um relato investigável.
   */
  return {
    titulo: 'Não conseguimos concluir esta operação',
    detalhe: 'O sistema não reconheceu o motivo da recusa, o que costuma indicar um defeito nosso.',
    acao: 'Nada foi gravado. Avise o suporte com o código abaixo — repetir provavelmente vai dar o mesmo resultado.',
    culpa: 'sistema',
    codigo: codigo ? `BD-${codigo}` : 'DESCONHECIDO',
  }
}
