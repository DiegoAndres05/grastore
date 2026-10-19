-- Guardar un cliente reescribe el libro. Supabase rechaza un DELETE sin WHERE
-- (DELETE requires a WHERE clause). Este archivo se puede correr varias veces.
-- Corre en el SQL Editor después de 0002_roles.sql.

create or replace function public.replace_book(payload jsonb, expected integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  current_version integer;
  next_version integer;
begin
  if payload is null or jsonb_typeof(payload) <> 'object' then
    raise exception 'El libro no tiene un formato válido';
  end if;
  select version into current_version from public.book_meta where id = 'main' for update;
  if current_version is null then
    raise exception 'Falta book_meta';
  end if;
  if expected >= 0 and current_version is distinct from expected then
    raise exception 'conflict';
  end if;
  next_version := current_version + 1;

  delete from public.products where true;
  delete from public.customers where true;
  delete from public.suppliers where true;
  delete from public.sales where true;
  delete from public.purchases where true;
  delete from public.collections where true;
  delete from public.accounts where true;
  delete from public.movements where true;
  delete from public.expenses where true;
  delete from public.payables where true;
  delete from public.payable_payments where true;
  delete from public.capital_events where true;
  delete from public.loans where true;
  delete from public.loan_payments where true;
  delete from public.layaways where true;
  delete from public.returns where true;
  delete from public.adjustments where true;
  delete from public.investments where true;

  insert into public.products (id, data)
  select item ->> 'id', item from jsonb_array_elements(coalesce(payload -> 'products', '[]'::jsonb)) item where coalesce(item ->> 'id', '') <> '';
  insert into public.customers (id, data)
  select item ->> 'id', item from jsonb_array_elements(coalesce(payload -> 'customers', '[]'::jsonb)) item where coalesce(item ->> 'id', '') <> '';
  insert into public.suppliers (id, data)
  select item ->> 'id', item from jsonb_array_elements(coalesce(payload -> 'suppliers', '[]'::jsonb)) item where coalesce(item ->> 'id', '') <> '';
  insert into public.sales (id, data)
  select item ->> 'id', item from jsonb_array_elements(coalesce(payload -> 'sales', '[]'::jsonb)) item where coalesce(item ->> 'id', '') <> '';
  insert into public.purchases (id, data)
  select item ->> 'id', item from jsonb_array_elements(coalesce(payload -> 'purchases', '[]'::jsonb)) item where coalesce(item ->> 'id', '') <> '';
  insert into public.collections (id, data)
  select item ->> 'id', item from jsonb_array_elements(coalesce(payload -> 'collections', '[]'::jsonb)) item where coalesce(item ->> 'id', '') <> '';
  insert into public.accounts (id, data)
  select item ->> 'id', item from jsonb_array_elements(coalesce(payload -> 'accounts', '[]'::jsonb)) item where coalesce(item ->> 'id', '') <> '';
  insert into public.movements (id, data)
  select item ->> 'id', item from jsonb_array_elements(coalesce(payload -> 'movements', '[]'::jsonb)) item where coalesce(item ->> 'id', '') <> '';
  insert into public.expenses (id, data)
  select item ->> 'id', item from jsonb_array_elements(coalesce(payload -> 'expenses', '[]'::jsonb)) item where coalesce(item ->> 'id', '') <> '';
  insert into public.payables (id, data)
  select item ->> 'id', item from jsonb_array_elements(coalesce(payload -> 'payables', '[]'::jsonb)) item where coalesce(item ->> 'id', '') <> '';
  insert into public.payable_payments (id, data)
  select item ->> 'id', item from jsonb_array_elements(coalesce(payload -> 'payablePayments', '[]'::jsonb)) item where coalesce(item ->> 'id', '') <> '';
  insert into public.capital_events (id, data)
  select item ->> 'id', item from jsonb_array_elements(coalesce(payload -> 'capitalEvents', '[]'::jsonb)) item where coalesce(item ->> 'id', '') <> '';
  insert into public.loans (id, data)
  select item ->> 'id', item from jsonb_array_elements(coalesce(payload -> 'loans', '[]'::jsonb)) item where coalesce(item ->> 'id', '') <> '';
  insert into public.loan_payments (id, data)
  select item ->> 'id', item from jsonb_array_elements(coalesce(payload -> 'loanPayments', '[]'::jsonb)) item where coalesce(item ->> 'id', '') <> '';
  insert into public.layaways (id, data)
  select item ->> 'id', item from jsonb_array_elements(coalesce(payload -> 'layaways', '[]'::jsonb)) item where coalesce(item ->> 'id', '') <> '';
  insert into public.returns (id, data)
  select item ->> 'id', item from jsonb_array_elements(coalesce(payload -> 'returns', '[]'::jsonb)) item where coalesce(item ->> 'id', '') <> '';
  insert into public.adjustments (id, data)
  select item ->> 'id', item from jsonb_array_elements(coalesce(payload -> 'adjustments', '[]'::jsonb)) item where coalesce(item ->> 'id', '') <> '';
  insert into public.investments (id, data)
  select item ->> 'id', item from jsonb_array_elements(coalesce(payload -> 'investments', '[]'::jsonb)) item where coalesce(item ->> 'id', '') <> '';

  update public.book_meta set
    version = next_version,
    origin = coalesce(payload #>> '{meta,origin}', origin),
    imported_at = payload #>> '{meta,importedAt}',
    seq_sale = coalesce((payload #>> '{seq,sale}')::integer, seq_sale),
    seq_purchase = coalesce((payload #>> '{seq,purchase}')::integer, seq_purchase),
    seq_layaway = coalesce((payload #>> '{seq,layaway}')::integer, seq_layaway),
    seq_expense = coalesce((payload #>> '{seq,expense}')::integer, seq_expense),
    salary_share = coalesce((payload #>> '{settings,salarySharePct}')::numeric, salary_share),
    categories = coalesce(payload #> '{settings,categories}', categories),
    colors = coalesce(payload #> '{settings,colors}', colors),
    opening_pnl = payload -> 'openingPnl',
    updated_at = now()
  where id = 'main';

  update public.book_signal set version = next_version where id = 'main';
  return next_version;
end;
$$;
