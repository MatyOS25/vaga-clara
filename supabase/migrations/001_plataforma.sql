-- Denúncias entram só pelo servidor, com a situação "pendente", e só viram públicas depois da moderação.

create table public.denuncias (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  texto_anuncio text not null check (char_length(texto_anuncio) between 1 and 10000),
  empresa text check (char_length(empresa) <= 200),
  cidade text check (char_length(cidade) <= 120),
  link text check (char_length(link) <= 500),
  data_vista date,
  achados jsonb not null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovada', 'rejeitada')),
  motivo text check (char_length(motivo) <= 500),
  moderado_por uuid references auth.users (id) on delete set null,
  moderado_em timestamptz
);

create index denuncias_status_criado_idx on public.denuncias (status, criado_em desc);
create index denuncias_moderado_por_idx on public.denuncias (moderado_por);

create table public.moderadores (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table public.limites (
  chave text primary key,
  inicio timestamptz not null,
  contagem integer not null
);

alter table public.denuncias enable row level security;
alter table public.moderadores enable row level security;
alter table public.limites enable row level security;

revoke all on public.denuncias, public.moderadores, public.limites from anon, authenticated;
grant select on public.denuncias to authenticated;
grant select, insert, update, delete on public.denuncias, public.moderadores, public.limites to service_role;

create function public.eh_moderador()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.moderadores where user_id = (select auth.uid()))
$$;

create policy denuncias_moderador_le on public.denuncias
  for select to authenticated
  using ((select public.eh_moderador()));

create function public.moderar(denuncia uuid, nova_situacao text, novo_motivo text, texto_publicado text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.eh_moderador() then
    raise exception 'Apenas moderador pode revisar denúncias.';
  end if;
  if nova_situacao not in ('aprovada', 'rejeitada') then
    raise exception 'A situação precisa ser aprovada ou rejeitada.';
  end if;
  update public.denuncias
     set status = nova_situacao,
         motivo = novo_motivo,
         texto_anuncio = coalesce(texto_publicado, texto_anuncio),
         moderado_por = auth.uid(),
         moderado_em = now()
   where id = denuncia
     and (status = 'pendente' or (status = 'aprovada' and nova_situacao = 'rejeitada'));
  if not found then
    raise exception 'Esta denúncia não está disponível para revisão.';
  end if;
end;
$$;

-- Empresa e link ficam fora: acusação pública exige apuração, e isso cabe aos canais oficiais.
create function public.mural_denuncias(limite integer default 30)
returns table (id uuid, criado_em timestamptz, cidade text, texto_anuncio text, achados jsonb)
language sql stable security definer set search_path = ''
as $$
  select d.id, d.criado_em, d.cidade, d.texto_anuncio, d.achados
    from public.denuncias d
   where d.status = 'aprovada'
   order by d.moderado_em desc
   limit least(greatest(limite, 1), 100)
$$;

create function public.estatisticas_denuncias()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'total', (select count(*) from public.denuncias where status = 'aprovada'),
    'por_categoria', coalesce((
      select jsonb_object_agg(categoria, quantidade)
        from (
          select item ->> 'categoria' as categoria, count(distinct d.id) as quantidade
            from public.denuncias d, jsonb_array_elements(d.achados) as item
           where d.status = 'aprovada'
           group by 1
        ) contagens
    ), '{}'::jsonb)
  )
$$;

create function public.consumir_limite(chave_pedido text, maximo integer, janela_segundos integer)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare
  atual integer;
begin
  insert into public.limites as l (chave, inicio, contagem)
  values (chave_pedido, now(), 1)
  on conflict (chave) do update
    set inicio = case when l.inicio < now() - make_interval(secs => janela_segundos) then now() else l.inicio end,
        contagem = case when l.inicio < now() - make_interval(secs => janela_segundos) then 1 else l.contagem + 1 end
  returning contagem into atual;
  -- De vez em quando apaga contadores antigos, para a tabela não crescer sem limite.
  if random() < 0.01 then
    delete from public.limites where inicio < now() - interval '7 days';
  end if;
  return atual <= maximo;
end;
$$;

revoke all on function public.eh_moderador() from public, anon, authenticated;
revoke all on function public.moderar(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.mural_denuncias(integer) from public, anon, authenticated;
revoke all on function public.estatisticas_denuncias() from public, anon, authenticated;
revoke all on function public.consumir_limite(text, integer, integer) from public, anon, authenticated;

grant execute on function public.eh_moderador() to authenticated;
grant execute on function public.moderar(uuid, text, text, text) to authenticated;
grant execute on function public.mural_denuncias(integer) to anon, authenticated;
grant execute on function public.estatisticas_denuncias() to anon, authenticated;
grant execute on function public.consumir_limite(text, integer, integer) to service_role;
