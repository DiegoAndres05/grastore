-- Roles, permisos y libro en tablas.
-- Corre en el SQL Editor después de 0001_init.sql. Se puede volver a ejecutar:
-- si el intento anterior se cortó a la mitad, los create/alter de abajo no duplican nada.
-- Sirve con las tablas vacías y, si ya hay una fila en books y el libro nuevo sigue vacío,
-- la pasa a las tablas nuevas. No vuelve a copiarla si ya hay datos.
-- La clave service_role no se usa en el navegador: solo en las funciones de Vercel.

create table if not exists public.roles (
  id text primary key,
  name text not null,
  locked boolean not null default false
);

create table if not exists public.permission_catalog (
  id text primary key,
  label text not null,
  grp text not null,
  sort integer not null
);

create table if not exists public.role_permissions (
  role_id text not null references public.roles (id) on delete cascade,
  permission text not null references public.permission_catalog (id) on delete cascade,
  primary key (role_id, permission)
);

insert into public.roles (id, name, locked) values
  ('dueno', 'Dueño', true),
  ('administrador', 'Administrador', false),
  ('trabajador', 'Trabajador', false)
on conflict (id) do update set name = excluded.name, locked = excluded.locked;

insert into public.permission_catalog (id, label, grp, sort) values
  ('pos.sell', 'Vender en caja', 'Mostrador', 10),
  ('layaway.manage', 'Plan separe', 'Mostrador', 20),
  ('collections.take', 'Abonar cartera de ventas', 'Mostrador', 30),
  ('customers.write', 'Crear y editar clientes', 'Mostrador', 40),
  ('products.read', 'Ver prendas y existencias', 'Inventario', 50),
  ('products.costs', 'Ver costos y márgenes', 'Inventario', 60),
  ('products.write', 'Editar prendas, categorías y colores', 'Inventario', 70),
  ('inventory.adjust', 'Ajustar inventario', 'Inventario', 80),
  ('sales.void', 'Anular ventas', 'Ventas', 90),
  ('sales.edit', 'Corregir ventas', 'Ventas', 100),
  ('sales.return', 'Registrar devoluciones', 'Ventas', 110),
  ('purchases.write', 'Compras e inversiones', 'Compras', 120),
  ('cash.read', 'Ver saldos de caja', 'Dinero', 130),
  ('cash.write', 'Traslados y cuentas', 'Dinero', 140),
  ('expenses.read', 'Ver gastos', 'Dinero', 150),
  ('expenses.write', 'Registrar gastos', 'Dinero', 160),
  ('payables.read', 'Ver deudas', 'Dinero', 170),
  ('payables.write', 'Registrar y pagar deudas', 'Dinero', 180),
  ('capital.write', 'Aportes, préstamos y préstamos a terceros', 'Dinero', 190),
  ('reports.read', 'Contabilidad y estadísticas', 'Cierre', 200),
  ('import.restore', 'Importar Excel, respaldo y muestra', 'Cierre', 210),
  ('book.delete', 'Vaciar el libro', 'Cierre', 220),
  ('users.manage', 'Usuarios y permisos', 'Acceso', 230)
on conflict (id) do update set label = excluded.label, grp = excluded.grp, sort = excluded.sort;

insert into public.role_permissions (role_id, permission)
select 'dueno', id from public.permission_catalog
on conflict do nothing;

insert into public.role_permissions (role_id, permission)
select 'administrador', id from public.permission_catalog
where id not in ('users.manage', 'import.restore', 'book.delete')
on conflict do nothing;

insert into public.role_permissions (role_id, permission)
select 'trabajador', id from public.permission_catalog
where id in ('pos.sell', 'layaway.manage', 'collections.take', 'customers.write', 'products.read')
on conflict do nothing;

alter table public.profiles add column if not exists role_id text;
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists overrides jsonb not null default '{}'::jsonb;

update public.profiles set role_id = 'trabajador' where role_id is null;
update public.profiles set role_id = 'dueno'
where not exists (select 1 from public.profiles where role_id = 'dueno')
  and id = (select id from public.profiles order by created_at asc limit 1);

alter table public.profiles alter column role_id set default 'trabajador';
alter table public.profiles alter column role_id set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_fk') then
    alter table public.profiles
      add constraint profiles_role_fk foreign key (role_id) references public.roles (id);
  end if;
end $$;

create table if not exists public.provisions (
  email text primary key,
  role_id text not null references public.roles (id),
  display_name text not null,
  created_at timestamptz not null default now()
);

alter table public.provisions enable row level security;

create table if not exists public.book_meta (
  id text primary key,
  version integer not null,
  origin text not null,
  imported_at text,
  seq_sale integer not null,
  seq_purchase integer not null,
  seq_layaway integer not null,
  seq_expense integer not null,
  salary_share numeric not null,
  categories jsonb not null,
  colors jsonb not null,
  opening_pnl jsonb,
  updated_at timestamptz not null default now()
);

insert into public.book_meta (id, version, origin, seq_sale, seq_purchase, seq_layaway, seq_expense, salary_share, categories, colors)
values (
  'main', 1, 'empty', 1, 1, 1, 1, 25,
  '["Camisetas","Hoodies","Jeans","Gorras","Tenis","Accesorios"]'::jsonb,
  '["Marfil","Negro","Arena","Olivo","Burdeos","Blanco","Índigo","Café","Cielo","Camel"]'::jsonb
)
on conflict (id) do nothing;

create table if not exists public.book_signal (
  id text primary key,
  version integer not null
);

insert into public.book_signal (id, version)
values ('main', 1)
on conflict (id) do nothing;

create table if not exists public.products (id text primary key, data jsonb not null);
create table if not exists public.customers (id text primary key, data jsonb not null);
create table if not exists public.suppliers (id text primary key, data jsonb not null);
create table if not exists public.sales (id text primary key, data jsonb not null);
create table if not exists public.purchases (id text primary key, data jsonb not null);
create table if not exists public.collections (id text primary key, data jsonb not null);
create table if not exists public.accounts (id text primary key, data jsonb not null);
create table if not exists public.movements (id text primary key, data jsonb not null);
create table if not exists public.expenses (id text primary key, data jsonb not null);
create table if not exists public.payables (id text primary key, data jsonb not null);
create table if not exists public.payable_payments (id text primary key, data jsonb not null);
create table if not exists public.capital_events (id text primary key, data jsonb not null);
create table if not exists public.loans (id text primary key, data jsonb not null);
create table if not exists public.loan_payments (id text primary key, data jsonb not null);
create table if not exists public.layaways (id text primary key, data jsonb not null);
create table if not exists public.returns (id text primary key, data jsonb not null);
create table if not exists public.adjustments (id text primary key, data jsonb not null);
create table if not exists public.investments (id text primary key, data jsonb not null);

alter table public.products enable row level security;
alter table public.customers enable row level security;
alter table public.suppliers enable row level security;
alter table public.sales enable row level security;
alter table public.purchases enable row level security;
alter table public.collections enable row level security;
alter table public.accounts enable row level security;
alter table public.movements enable row level security;
alter table public.expenses enable row level security;
alter table public.payables enable row level security;
alter table public.payable_payments enable row level security;
alter table public.capital_events enable row level security;
alter table public.loans enable row level security;
alter table public.loan_payments enable row level security;
alter table public.layaways enable row level security;
alter table public.returns enable row level security;
alter table public.adjustments enable row level security;
alter table public.investments enable row level security;
alter table public.book_meta enable row level security;
alter table public.book_signal enable row level security;

-- Sin políticas para authenticated: el navegador no lee ni escribe estas tablas.
-- book_snapshot (security definer) arma el libro y quita lo que el rol no puede ver.
-- replace_book solo lo ejecuta service_role, desde la función de Vercel.

create or replace function public.has_perm(perm text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  profile public.profiles%rowtype;
  flag text;
begin
  if auth.uid() is null or perm is null then
    return false;
  end if;
  select * into profile from public.profiles where id = auth.uid();
  if not found or not profile.active then
    return false;
  end if;
  if profile.role_id = 'dueno' then
    return true;
  end if;
  flag := profile.overrides ->> perm;
  if flag = 'true' then
    return true;
  end if;
  if flag = 'false' then
    return false;
  end if;
  return exists (
    select 1 from public.role_permissions
    where role_id = profile.role_id and permission = perm
  );
end;
$$;

create or replace function public.owner_exists()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where role_id = 'dueno'
      and exists (select 1 from auth.users where auth.users.id = profiles.id)
  );
$$;

create or replace function public.signup_open()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not public.owner_exists();
$$;

create or replace function public.zero_costs(rows jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (select jsonb_agg(jsonb_set(item, '{cost}', '0'::jsonb)) from jsonb_array_elements(coalesce(rows, '[]'::jsonb)) item),
    '[]'::jsonb
  );
$$;

create or replace function public.zero_line_costs(rows jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (select jsonb_agg(jsonb_set(item, '{lines}', public.zero_costs(item -> 'lines'))) from jsonb_array_elements(coalesce(rows, '[]'::jsonb)) item),
    '[]'::jsonb
  );
$$;

create or replace function public.zero_openings(rows jsonb)
returns jsonb
language sql
immutable
as $$
  select coalesce(
    (select jsonb_agg(jsonb_set(item, '{openingBalance}', '0'::jsonb)) from jsonb_array_elements(coalesce(rows, '[]'::jsonb)) item),
    '[]'::jsonb
  );
$$;

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
  end if;
  return state;
end;
$$;

create or replace function public.access_json()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  profile public.profiles%rowtype;
  role_name text;
begin
  select * into profile from public.profiles where id = auth.uid();
  if not found then
    return jsonb_build_object('roleId', '', 'roleName', '', 'active', false, 'permissions', '[]'::jsonb);
  end if;
  select name into role_name from public.roles where id = profile.role_id;
  return jsonb_build_object(
    'roleId', profile.role_id,
    'roleName', coalesce(role_name, profile.role_id),
    'active', profile.active,
    'permissions', coalesce((
      select jsonb_agg(catalog.id order by catalog.sort)
      from public.permission_catalog catalog
      where public.has_perm(catalog.id)
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.book_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  profile public.profiles%rowtype;
  current_version integer;
begin
  if auth.uid() is null then
    raise exception 'No hay sesión';
  end if;
  select * into profile from public.profiles where id = auth.uid();
  if not found or not profile.active then
    raise exception 'Esta cuenta está inactiva';
  end if;
  select version into current_version from public.book_meta where id = 'main';
  return jsonb_build_object(
    'version', coalesce(current_version, 1),
    'state', public.redact_state(public.export_book()),
    'access', public.access_json()
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
    updated_at = now()
  where id = 'main';

  update public.book_signal set version = next_version where id = 'main';
  return next_version;
end;
$$;

-- Solo la primera vez: si el libro nuevo ya tiene filas o la versión avanzó,
-- volver a correr este archivo no pisa lo que se escribió después.
do $$
declare
  legacy jsonb;
  meta_origin text;
  meta_version integer;
  has_rows boolean;
begin
  if to_regclass('public.books') is null then
    return;
  end if;
  select data into legacy from public.books where id = 'main';
  if legacy is null then
    return;
  end if;
  select origin, version into meta_origin, meta_version from public.book_meta where id = 'main';
  select exists (
    select 1 from public.products
    union all select 1 from public.customers
    union all select 1 from public.suppliers
    union all select 1 from public.sales
    union all select 1 from public.purchases
    union all select 1 from public.collections
    union all select 1 from public.accounts
    union all select 1 from public.movements
    union all select 1 from public.expenses
    union all select 1 from public.payables
    union all select 1 from public.payable_payments
    union all select 1 from public.capital_events
    union all select 1 from public.loans
    union all select 1 from public.loan_payments
    union all select 1 from public.layaways
    union all select 1 from public.returns
    union all select 1 from public.adjustments
    union all select 1 from public.investments
  ) into has_rows;
  if has_rows or meta_version is distinct from 1 or meta_origin is distinct from 'empty' then
    return;
  end if;
  perform public.replace_book(legacy, -1);
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  next_role text;
  display text;
  provision public.provisions%rowtype;
begin
  perform pg_advisory_xact_lock(845221);
  if public.owner_exists() then
    select * into provision from public.provisions where lower(email) = lower(coalesce(new.email, ''));
    if not found then
      raise exception 'El registro público está cerrado. El dueño crea los accesos.';
    end if;
    next_role := provision.role_id;
    display := provision.display_name;
    delete from public.provisions where lower(email) = lower(coalesce(new.email, ''));
    if next_role is null or next_role not in ('administrador', 'trabajador') then
      next_role := 'trabajador';
    end if;
  else
    next_role := 'dueno';
    display := coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), split_part(coalesce(new.email, 'dueño'), '@', 1));
  end if;

  insert into public.profiles (id, display_name, email, role_id, active, overrides)
  values (new.id, display, new.email, next_role, true, '{}'::jsonb)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop policy if exists "perfiles visibles" on public.profiles;
drop policy if exists "cada quien crea su perfil" on public.profiles;
drop policy if exists "cada quien edita su perfil" on public.profiles;
drop policy if exists "el libro lo lee quien entra" on public.books;
drop policy if exists "el libro lo crea quien entra" on public.books;
drop policy if exists "el libro lo edita quien entra" on public.books;

revoke all on public.profiles from authenticated, anon;
revoke all on public.books from authenticated, anon;
revoke all on public.products from authenticated, anon;
revoke all on public.customers from authenticated, anon;
revoke all on public.suppliers from authenticated, anon;
revoke all on public.sales from authenticated, anon;
revoke all on public.purchases from authenticated, anon;
revoke all on public.collections from authenticated, anon;
revoke all on public.accounts from authenticated, anon;
revoke all on public.movements from authenticated, anon;
revoke all on public.expenses from authenticated, anon;
revoke all on public.payables from authenticated, anon;
revoke all on public.payable_payments from authenticated, anon;
revoke all on public.capital_events from authenticated, anon;
revoke all on public.loans from authenticated, anon;
revoke all on public.loan_payments from authenticated, anon;
revoke all on public.layaways from authenticated, anon;
revoke all on public.returns from authenticated, anon;
revoke all on public.adjustments from authenticated, anon;
revoke all on public.investments from authenticated, anon;
revoke all on public.book_meta from authenticated, anon;
revoke all on public.provisions from authenticated, anon;
revoke all on public.roles from authenticated, anon;
revoke all on public.permission_catalog from authenticated, anon;
revoke all on public.role_permissions from authenticated, anon;

grant usage on schema public to authenticated, anon, service_role;
grant all on all tables in schema public to service_role;
grant all on all functions in schema public to service_role;

revoke all on function public.owner_exists() from public, anon, authenticated;
revoke all on function public.export_book() from public, anon, authenticated;
revoke all on function public.replace_book(jsonb, integer) from public, anon, authenticated;
revoke all on function public.redact_state(jsonb) from public, anon, authenticated;
revoke all on function public.zero_costs(jsonb) from public, anon, authenticated;
revoke all on function public.zero_line_costs(jsonb) from public, anon, authenticated;
revoke all on function public.zero_openings(jsonb) from public, anon, authenticated;

grant execute on function public.book_snapshot() to authenticated;
grant execute on function public.access_json() to authenticated;
grant execute on function public.has_perm(text) to authenticated;
grant execute on function public.signup_open() to anon, authenticated;

create or replace function public.caller_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and active);
$$;

revoke all on function public.caller_active() from public, anon;
grant execute on function public.caller_active() to authenticated;

drop policy if exists "señal para cuentas activas" on public.book_signal;
create policy "señal para cuentas activas" on public.book_signal
  for select to authenticated
  using (public.caller_active());

grant select on public.book_signal to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime drop table public.books;
    exception
      when others then null;
    end;
    begin
      alter publication supabase_realtime add table public.book_signal;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

notify pgrst, 'reload schema';
