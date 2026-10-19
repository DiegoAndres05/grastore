-- Cierres mensuales de la hoja Balance. Se puede correr varias veces.
-- En el SQL Editor, después de 0004_replace_book_where.sql.
-- Sin este archivo, un libro en Supabase no guarda los meses: cada escritura
-- los deja fuera. El modo local no lo necesita.

alter table public.book_meta
  add column if not exists closings jsonb not null default '[]'::jsonb;

create or replace function public.export_book()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  meta public.book_meta%rowtype;
begin
  select * into meta from public.book_meta where id = 'main';
  return jsonb_build_object(
    'products', coalesce((select jsonb_agg(data) from public.products), '[]'::jsonb),
    'customers', coalesce((select jsonb_agg(data) from public.customers), '[]'::jsonb),
    'suppliers', coalesce((select jsonb_agg(data) from public.suppliers), '[]'::jsonb),
    'sales', coalesce((select jsonb_agg(data) from public.sales), '[]'::jsonb),
    'purchases', coalesce((select jsonb_agg(data) from public.purchases), '[]'::jsonb),
    'collections', coalesce((select jsonb_agg(data) from public.collections), '[]'::jsonb),
    'accounts', coalesce((select jsonb_agg(data) from public.accounts), '[]'::jsonb),
    'movements', coalesce((select jsonb_agg(data) from public.movements), '[]'::jsonb),
    'expenses', coalesce((select jsonb_agg(data) from public.expenses), '[]'::jsonb),
    'payables', coalesce((select jsonb_agg(data) from public.payables), '[]'::jsonb),
    'payablePayments', coalesce((select jsonb_agg(data) from public.payable_payments), '[]'::jsonb),
    'capitalEvents', coalesce((select jsonb_agg(data) from public.capital_events), '[]'::jsonb),
    'loans', coalesce((select jsonb_agg(data) from public.loans), '[]'::jsonb),
    'loanPayments', coalesce((select jsonb_agg(data) from public.loan_payments), '[]'::jsonb),
    'layaways', coalesce((select jsonb_agg(data) from public.layaways), '[]'::jsonb),
    'returns', coalesce((select jsonb_agg(data) from public.returns), '[]'::jsonb),
    'adjustments', coalesce((select jsonb_agg(data) from public.adjustments), '[]'::jsonb),
    'investments', coalesce((select jsonb_agg(data) from public.investments), '[]'::jsonb),
    'openingPnl', meta.opening_pnl,
    'closings', coalesce(meta.closings, '[]'::jsonb),
    'settings', jsonb_build_object(
      'salarySharePct', meta.salary_share,
      'categories', meta.categories,
      'colors', meta.colors
    ),
    'seq', jsonb_build_object(
      'sale', meta.seq_sale,
      'purchase', meta.seq_purchase,
      'layaway', meta.seq_layaway,
      'expense', meta.seq_expense
    ),
    'meta', jsonb_build_object('origin', meta.origin, 'importedAt', meta.imported_at)
  );
end;
$$;

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
    closings = coalesce(payload -> 'closings', closings),
    updated_at = now()
  where id = 'main';

  update public.book_signal set version = next_version where id = 'main';
  return next_version;
end;
$$;

create or replace function public.redact_state(full_state jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  state jsonb := coalesce(full_state, '{}'::jsonb);
  see_costs boolean := public.has_perm('products.costs');
  see_cash boolean := public.has_perm('cash.read');
  see_expenses boolean := public.has_perm('expenses.read') or public.has_perm('expenses.write');
  see_payables boolean := public.has_perm('payables.read') or public.has_perm('payables.write');
  see_capital boolean := public.has_perm('capital.write') or public.has_perm('reports.read');
  see_reports boolean := public.has_perm('reports.read');
  see_purchases boolean := public.has_perm('purchases.write') or see_reports or see_costs;
  see_products boolean := public.has_perm('products.read') or public.has_perm('pos.sell');
  see_sales boolean := see_products or public.has_perm('collections.take') or see_reports;
  see_customers boolean := public.has_perm('customers.write') or public.has_perm('collections.take') or public.has_perm('pos.sell') or see_reports;
begin
  if not see_products then
    state := jsonb_set(state, '{products}', '[]'::jsonb);
  elsif not see_costs then
    state := jsonb_set(state, '{products}', public.zero_costs(state -> 'products'));
  end if;

  if not see_customers then
    state := jsonb_set(state, '{customers}', '[]'::jsonb);
  end if;
  if not see_purchases then
    state := jsonb_set(state, '{suppliers}', '[]'::jsonb);
    state := jsonb_set(state, '{purchases}', '[]'::jsonb);
    state := jsonb_set(state, '{investments}', '[]'::jsonb);
  elsif not see_costs then
    state := jsonb_set(state, '{purchases}', public.zero_line_costs(state -> 'purchases'));
  end if;

  if not see_sales then
    state := jsonb_set(state, '{sales}', '[]'::jsonb);
    state := jsonb_set(state, '{returns}', '[]'::jsonb);
  elsif not see_costs then
    state := jsonb_set(state, '{sales}', public.zero_line_costs(state -> 'sales'));
    state := jsonb_set(state, '{returns}', public.zero_line_costs(state -> 'returns'));
  end if;

  if not (public.has_perm('layaway.manage') or see_reports) then
    state := jsonb_set(state, '{layaways}', '[]'::jsonb);
  elsif not see_costs then
    state := jsonb_set(state, '{layaways}', public.zero_line_costs(state -> 'layaways'));
  end if;

  if not (public.has_perm('collections.take') or see_reports) then
    state := jsonb_set(state, '{collections}', '[]'::jsonb);
  end if;

  if not see_cash then
    state := jsonb_set(state, '{accounts}', public.zero_openings(state -> 'accounts'));
    state := jsonb_set(state, '{movements}', '[]'::jsonb);
  end if;
  if not see_expenses then
    state := jsonb_set(state, '{expenses}', '[]'::jsonb);
  end if;
  if not see_payables then
    state := jsonb_set(state, '{payables}', '[]'::jsonb);
    state := jsonb_set(state, '{payablePayments}', '[]'::jsonb);
  end if;
  if not see_capital then
    state := jsonb_set(state, '{capitalEvents}', '[]'::jsonb);
    state := jsonb_set(state, '{loans}', '[]'::jsonb);
    state := jsonb_set(state, '{loanPayments}', '[]'::jsonb);
  end if;
  if not (public.has_perm('inventory.adjust') or see_reports or public.has_perm('products.write')) then
    state := jsonb_set(state, '{adjustments}', '[]'::jsonb);
  end if;
  if not see_reports then
    state := jsonb_set(state, '{openingPnl}', 'null'::jsonb);
    state := jsonb_set(state, '{closings}', '[]'::jsonb);
  end if;
  return state;
end;
$$;
