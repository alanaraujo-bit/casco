-- 0019 — "Excluir" usuário e distribuidora, pelo painel da Aionix.
--
-- Não existia função para desativar `companies`: só usuário tinha
-- `admin_definir_ativo` (0009). Mesmo desenho, mesmo motivo — `vendas`,
-- `contas_receber` e o resto referenciam `companies` com `on delete
-- restrict`, então apagar de fato é impossível assim que a distribuidora tem
-- um lançamento sequer. Desativa, não apaga.
create or replace function admin_definir_ativo_empresa(p_id uuid, p_ativo boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  afetadas int;
begin
  update companies
     set ativo = p_ativo
   where id = p_id;
  get diagnostics afetadas = row_count;
  return afetadas = 1;
end;
$$;

grant execute on function admin_definir_ativo_empresa(uuid, boolean) to casco_app;
