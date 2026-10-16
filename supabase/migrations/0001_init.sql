-- Libro compartido de La Grasita Store.
-- Ejecútalo en el SQL Editor de Supabase (o con la CLI) una sola vez.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.books (
  id text primary key default 'main',
  version integer not null default 1,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id)
);

alter table public.profiles enable row level security;
alter table public.books enable row level security;

drop policy if exists "perfiles visibles" on public.profiles;
create policy "perfiles visibles" on public.profiles
  for select to authenticated using (true);

drop policy if exists "cada quien crea su perfil" on public.profiles;
create policy "cada quien crea su perfil" on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists "cada quien edita su perfil" on public.profiles;
create policy "cada quien edita su perfil" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "el libro lo lee quien entra" on public.books;
create policy "el libro lo lee quien entra" on public.books
  for select to authenticated using (true);

drop policy if exists "el libro lo crea quien entra" on public.books;
create policy "el libro lo crea quien entra" on public.books
  for insert to authenticated with check (true);

drop policy if exists "el libro lo edita quien entra" on public.books;
create policy "el libro lo edita quien entra" on public.books
  for update to authenticated using (true) with check (true);

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.books to authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.books;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;
