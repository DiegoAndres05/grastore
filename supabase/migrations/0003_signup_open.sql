-- El registro del dueño se decide con signup_open(), que el navegador llama
-- sin sesión (rol anon). Este archivo se puede correr varias veces.
-- Corre en el SQL Editor después de 0002_roles.sql.

alter table public.profiles add column if not exists role_id text;
alter table public.profiles add column if not exists active boolean not null default true;
alter table public.profiles add column if not exists overrides jsonb not null default '{}'::jsonb;

-- Un perfil sin usuario en Authentication no puede ser el dueño.
delete from public.profiles as profile
where not exists (select 1 from auth.users where auth.users.id = profile.id);

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

grant usage on schema public to anon, authenticated;
revoke all on function public.owner_exists() from public, anon, authenticated;
grant execute on function public.signup_open() to anon, authenticated;

notify pgrst, 'reload schema';
