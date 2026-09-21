-- Executar uma vez no SQL Editor do projeto Supabase.
-- O estado completo da aplicação é guardado como JSON por utilizador.
create table if not exists public.app_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

create policy "Cada utilizador lê o seu estado"
  on public.app_state for select
  using (auth.uid() = user_id);

create policy "Cada utilizador cria o seu estado"
  on public.app_state for insert
  with check (auth.uid() = user_id);

create policy "Cada utilizador atualiza o seu estado"
  on public.app_state for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Cada utilizador apaga o seu estado"
  on public.app_state for delete
  using (auth.uid() = user_id);

-- Mantém updated_at correto mesmo que a linha seja alterada fora da aplicação.
create or replace function public.set_app_state_updated_at()
returns trigger
language plpgsql
security invoker
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_state_updated_at on public.app_state;
create trigger app_state_updated_at
before update on public.app_state
for each row execute function public.set_app_state_updated_at();
