-- Futbrowser: campo usado pela tela escolha-caminho.html.
-- Ajuste public.profiles se a tabela real de perfil tiver outro nome.
alter table public.profiles
  add column if not exists caminho varchar(20) null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_caminho_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_caminho_check
      check (caminho is null or caminho in ('jogador', 'tecnico', 'presidente'));
  end if;
end $$;
