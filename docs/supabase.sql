-- Ultimate Tic-Tac-Toe v1.3.0 remote-room MVP schema.
--
-- Run this file in the Supabase Dashboard SQL Editor for the project you want
-- to use with GitHub Pages.
--
-- After running it, enable Realtime / Postgres Changes for public.rooms:
-- Dashboard > Database > Publications > supabase_realtime > rooms.
-- The SQL below also attempts to add the table to the publication.
--
-- Security note:
-- This MVP has no accounts and no server-side referee. The RLS policies allow
-- anonymous clients to create, read, and update room rows so room-code play can
-- work from a static frontend. This is not strong anti-cheat protection.

create table if not exists public.rooms (
  code text primary key,
  status text not null check (status in ('waiting', 'playing', 'finished', 'closed')),
  game_state jsonb not null,
  score jsonb not null default '{"X":0,"O":0,"draw":0}'::jsonb,
  players jsonb not null default '{"X":{"joined":true,"online":true},"O":{"joined":false,"online":false}}'::jsonb,
  version integer not null default 1,
  move_number integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_x timestamptz,
  last_seen_o timestamptz
);

create or replace function public.set_rooms_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists rooms_set_updated_at on public.rooms;
create trigger rooms_set_updated_at
before update on public.rooms
for each row
execute function public.set_rooms_updated_at();

alter table public.rooms enable row level security;

grant select, insert, update on public.rooms to anon;

drop policy if exists "rooms_mvp_select" on public.rooms;
create policy "rooms_mvp_select"
on public.rooms
for select
to anon
using (true);

drop policy if exists "rooms_mvp_insert" on public.rooms;
create policy "rooms_mvp_insert"
on public.rooms
for insert
to anon
with check (
  code ~ '^[A-Z0-9]{6}$'
  and status in ('waiting', 'playing', 'finished', 'closed')
  and version >= 1
  and move_number >= 0
);

drop policy if exists "rooms_mvp_update" on public.rooms;
create policy "rooms_mvp_update"
on public.rooms
for update
to anon
using (true)
with check (
  code ~ '^[A-Z0-9]{6}$'
  and status in ('waiting', 'playing', 'finished', 'closed')
  and version >= 1
  and move_number >= 0
);

do $$
begin
  alter publication supabase_realtime add table public.rooms;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;
