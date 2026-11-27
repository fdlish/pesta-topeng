-- ============================================================================
-- Pesta Topeng — skema Supabase (akun, poin, peringkat)
-- Jalankan sekali di Supabase Dashboard → SQL Editor → New query → Run.
-- Aman dijalankan ulang (idempotent).
--
-- Model akses:
--   * Browser HANYA memakai Supabase untuk login Google (Auth).
--   * Semua baca/tulis tabel dilakukan server Node dengan SECRET key
--     (role service_role). Karena itu tabel di bawah TIDAK diberi grant
--     ke anon/authenticated dan RLS aktif tanpa policy = tertutup total
--     dari Data API publik. Poin tidak bisa dipalsukan dari browser.
-- ============================================================================

-- ---------------------------------------------------------------- profiles --
create table if not exists public.profiles (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  public_id   text not null unique
              check (public_id ~ '^[A-Z0-9]{5}$'),
  username    text not null
              check (username ~ '^[A-Za-z0-9_]{3,16}$'),
  avatar_url  text,
  points      bigint  not null default 0 check (points >= 0),
  games       integer not null default 0 check (games >= 0),
  wins        integer not null default 0 check (wins >= 0),
  unmasks     integer not null default 0 check (unmasks >= 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- username unik tanpa membedakan huruf besar/kecil
-- misi & gelar (ditambahkan belakangan; aman dijalankan ulang)
alter table public.profiles add column if not exists progress jsonb not null default '{}'::jsonb;
alter table public.profiles add column if not exists title text check (title is null or title ~ '^[a-z0-9_]{2,24}$');

create unique index if not exists profiles_username_lower_key
  on public.profiles (lower(username));

-- urutan papan peringkat
create index if not exists profiles_leaderboard_idx
  on public.profiles (points desc, wins desc, games asc);

-- ----------------------------------------------------------------- matches --
create table if not exists public.matches (
  id            bigint generated always as identity primary key,
  room_code     text not null,
  player_count  smallint not null check (player_count between 2 and 8),
  winner_id     uuid references public.profiles (user_id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists matches_winner_id_idx on public.matches (winner_id);
create index if not exists matches_created_at_idx on public.matches (created_at desc);

create table if not exists public.match_players (
  match_id   bigint not null references public.matches (id) on delete cascade,
  user_id    uuid   not null references public.profiles (user_id) on delete cascade,
  placement  smallint not null check (placement between 1 and 8),
  points     integer  not null check (points >= 0),
  unmasks    smallint not null default 0 check (unmasks >= 0),
  primary key (match_id, user_id)
);
create index if not exists match_players_user_id_idx on public.match_players (user_id);

-- ------------------------------------------------------------ privileges ----
alter table public.profiles      enable row level security;
alter table public.matches       enable row level security;
alter table public.match_players enable row level security;
-- Sengaja TANPA policy untuk anon/authenticated: tidak ada baris yang terlihat.

revoke all on public.profiles, public.matches, public.match_players from anon, authenticated;
grant select, insert, update, delete on public.profiles, public.matches, public.match_players to service_role;

-- ---------------------------------------------------------- create_profile --
-- Buat profil + ID publik 5 karakter (A–Z, 0–9) yang dijamin unik.
-- Error 'username_taken' bila username sudah dipakai.
create or replace function public.create_profile(
  p_user_id uuid, p_username text, p_avatar_url text default null
) returns public.profiles
language plpgsql
security invoker
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- tanpa 0/O/1/I agar tak tertukar
  candidate text;
  result public.profiles;
  attempt int := 0;
begin
  if exists (select 1 from public.profiles where lower(username) = lower(p_username)) then
    raise exception 'username_taken' using errcode = 'P0001';
  end if;
  loop
    attempt := attempt + 1;
    candidate := '';
    for i in 1..5 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    begin
      insert into public.profiles (user_id, public_id, username, avatar_url)
      values (p_user_id, candidate, p_username, p_avatar_url)
      returning * into result;
      return result;
    exception when unique_violation then
      -- tabrakan public_id → coba lagi; tabrakan lain diteruskan
      if exists (select 1 from public.profiles where user_id = p_user_id) then
        raise exception 'profile_exists' using errcode = 'P0001';
      end if;
      if exists (select 1 from public.profiles where lower(username) = lower(p_username)) then
        raise exception 'username_taken' using errcode = 'P0001';
      end if;
      if attempt >= 20 then raise; end if;
    end;
  end loop;
end;
$$;

-- ------------------------------------------------------------- award_match --
-- Simpan hasil 1 pertandingan dan tambahkan poin secara atomik.
-- p_results: [{ "user_id": uuid, "placement": 1..8, "points": int, "unmasks": int }, ...]
create or replace function public.award_match(
  p_room_code text, p_player_count int, p_results jsonb
) returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_id bigint;
  winner uuid;
begin
  select (r ->> 'user_id')::uuid into winner
  from jsonb_array_elements(p_results) r
  where (r ->> 'placement')::int = 1
  limit 1;

  insert into public.matches (room_code, player_count, winner_id)
  values (p_room_code, p_player_count, winner)
  returning id into new_id;

  insert into public.match_players (match_id, user_id, placement, points, unmasks)
  select new_id, (r ->> 'user_id')::uuid, (r ->> 'placement')::smallint,
         (r ->> 'points')::int, coalesce((r ->> 'unmasks')::smallint, 0)
  from jsonb_array_elements(p_results) r
  where exists (select 1 from public.profiles p where p.user_id = (r ->> 'user_id')::uuid);

  update public.profiles p
     set points     = p.points + mp.points,
         games      = p.games + 1,
         wins       = p.wins + (mp.placement = 1)::int,
         unmasks    = p.unmasks + mp.unmasks,
         updated_at = now()
    from public.match_players mp
   where mp.match_id = new_id and mp.user_id = p.user_id;

  return new_id;
end;
$$;

-- ------------------------------------------------------------- player_rank --
-- Peringkat (1 = teratas) di antara pemain yang sudah pernah main. Seri poin dipecah oleh jumlah kemenangan.
create or replace function public.player_rank(p_user_id uuid)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
  select 1 + count(*)
  from public.profiles o, public.profiles me
  where me.user_id = p_user_id
    and o.games > 0
    and (o.points > me.points or (o.points = me.points and o.wins > me.wins));
$$;

-- Fungsi hanya boleh dipanggil server (service_role), bukan browser.
revoke execute on function public.create_profile(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.award_match(text, int, jsonb)    from public, anon, authenticated;
revoke execute on function public.player_rank(uuid)                from public, anon, authenticated;
grant  execute on function public.create_profile(uuid, text, text) to service_role;
grant  execute on function public.award_match(text, int, jsonb)    to service_role;
grant  execute on function public.player_rank(uuid)                to service_role;
