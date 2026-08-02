-- 0010 — "Fiado" vira "A Prazo".
--
-- Mesmo conceito (venda que não entra no caixa na hora e vira título em Contas
-- a Receber), nome mais formal. Atualiza a linha já semeada em produção pelo
-- `scripts/criar-empresa.mjs` e o check constraint que valida o tipo.

-- Precisa soltar o constraint ANTES do update: 'a_prazo' não é um valor válido
-- pela regra antiga, e o Postgres confere a cada linha trocada, não só no fim.
alter table formas_pagamento drop constraint if exists formas_pagamento_tipo_check;

update formas_pagamento
   set tipo = 'a_prazo',
       nome = 'A Prazo'
 where tipo = 'fiado';

alter table formas_pagamento add constraint formas_pagamento_tipo_check
  check (tipo in ('dinheiro', 'pix', 'debito', 'credito', 'boleto', 'a_prazo'));
