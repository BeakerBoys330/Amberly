-- Amberly backend. Run once: Supabase dashboard → SQL Editor → paste → Run.
--
-- Everything here is opt-in. A grower can:
--   • share a reading or grow with their FOLLOWERS (visible_to_followers), and/or
--   • let BeakerBoys use it to TRAIN Amberly (for_training) — a separate choice.
-- Profiles start "approve followers"; a grower can make theirs public.
-- Row Level Security (RLS) enforces who can see what. BeakerBoys reads everything
-- from the dashboard (it bypasses RLS) to review reports and pick training data.

-- ── Profiles (username + privacy) ───────────────────────────────────────────
create table public.profiles (
  id         uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  username   text not null unique
             check (username ~ '^[a-z0-9_]{3,20}$'
                    and username not in ('admin', 'amberly', 'beakerboys', 'support', 'moderator', 'official')),
  is_public  boolean not null default false,   -- false = approve each follower
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
-- Signed-in growers can look up usernames (search + invite links). No emails are exposed.
create policy "profiles: look up"   on public.profiles for select to authenticated using (true);
create policy "profiles: create own" on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy "profiles: edit own"   on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ── Blocks ───────────────────────────────────────────────────────────────────
create table public.blocks (
  blocker_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocks enable row level security;
create policy "blocks: own" on public.blocks for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

-- ── Follows ──────────────────────────────────────────────────────────────────
create table public.follows (
  follower_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  followee_id uuid not null references public.profiles (id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'approved')),
  created_at  timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee on public.follows (followee_id, status);
alter table public.follows enable row level security;

-- Helper functions live in a `private` schema the app's API can't reach, so
-- nobody can call them directly (e.g. to probe who blocked whom). Policies can.
create schema private;
grant usage on schema private to authenticated;

create function private.blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;
-- Can the signed-in grower see `owner`'s follower-visible posts?
create function private.can_view(owner uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select owner = auth.uid() or (
    not private.blocked_between(owner, auth.uid()) and (
      exists (select 1 from public.profiles p where p.id = owner and p.is_public)
      or exists (select 1 from public.follows f
                 where f.follower_id = auth.uid() and f.followee_id = owner and f.status = 'approved')));
$$;
-- Every photo path in a post must be inside the poster's own folder, so nobody
-- can list someone else's photo in their post to get access to it.
create function private.own_paths(paths text[]) returns boolean
language sql stable set search_path = '' as $$
  select coalesce(bool_and(starts_with(p, auth.uid()::text || '/') and p !~ '\.\.'), true) from unnest(paths) p;
$$;
-- Simple flood limits: raise an error once a grower passes `cap` rows in `window`.
create function private.under_limit(tbl text, col text, cap int, win interval) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare n int;
begin
  execute format('select count(*) from public.%I where %I = $1 and created_at > now() - $2', tbl, col)
    into n using auth.uid(), win;
  return n < cap;
end;
$$;
revoke execute on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

create policy "follows: see mine"    on public.follows for select to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));
create policy "follows: ask"         on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()) and not private.blocked_between(followee_id, (select auth.uid()))
              and private.under_limit('follows', 'follower_id', 100, interval '1 day'));
create policy "follows: approve"     on public.follows for update to authenticated
  using (followee_id = (select auth.uid())) with check (followee_id = (select auth.uid()) and status = 'approved');
create policy "follows: end"         on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()) or followee_id = (select auth.uid()));
revoke update on public.follows from authenticated;
grant update (status) on public.follows to authenticated;   -- approving can't rewrite who follows whom

-- Public profiles approve follows automatically; private ones start pending.
create function private.follow_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.status := case when (select is_public from public.profiles where id = new.followee_id) then 'approved' else 'pending' end;
  return new;
end;
$$;
create trigger follows_set_status before insert on public.follows for each row execute function private.follow_status();

-- Going public approves everyone already waiting.
create function private.approve_pending_on_public() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.is_public and not old.is_public then
    update public.follows set status = 'approved' where followee_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;
create trigger profiles_went_public after update of is_public on public.profiles for each row execute function private.approve_pending_on_public();

-- Blocking someone ends any follow between the two of you.
create function private.unfollow_on_block() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and followee_id = new.blocked_id)
     or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  return new;
end;
$$;
create trigger blocks_end_follows after insert on public.blocks for each row execute function private.unfollow_on_block();

-- ── Shared items (readings, grows, grow-journal entries) ─────────────────────
create table public.shared_items (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind                 text not null check (kind in ('reading', 'grow', 'grow_log')),
  local_id             text not null check (length(local_id) <= 80),   -- the record's id on the phone
  grow_local_id        text check (length(grow_local_id) <= 80),       -- groups a grow with its entries
  data                 jsonb not null default '{}' check (pg_column_size(data) < 20000),
  photo_paths          text[] not null default '{}' check (cardinality(photo_paths) <= 6),
  visible_to_followers boolean not null default false,
  for_training         boolean not null default false,
  created_at           timestamptz not null default now(),
  unique (user_id, local_id),
  check (visible_to_followers or for_training)                         -- shared with someone, or not stored
);
create index shared_items_grow on public.shared_items (user_id, grow_local_id);
create index shared_items_feed on public.shared_items (user_id, created_at desc) where visible_to_followers;
alter table public.shared_items enable row level security;

create policy "items: read own or followed" on public.shared_items for select to authenticated
  using (user_id = (select auth.uid()) or (visible_to_followers and private.can_view(user_id)));
create policy "items: add own"    on public.shared_items for insert to authenticated
  with check (user_id = (select auth.uid()) and private.own_paths(photo_paths)
              and private.under_limit('shared_items', 'user_id', 500, interval '1 day'));
create policy "items: change own" on public.shared_items for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and private.own_paths(photo_paths));
create policy "items: delete own" on public.shared_items for delete to authenticated using (user_id = (select auth.uid()));

-- ── Reactions (fixed emoji only, so there's no free text to moderate) ────────
create table public.reactions (
  item_id    uuid not null references public.shared_items (id) on delete cascade,
  user_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  emoji      text not null check (emoji in ('🔥', '🌿', '👏', '😍')),
  created_at timestamptz not null default now(),
  primary key (item_id, user_id)
);
alter table public.reactions enable row level security;
-- The subqueries run under shared_items' own RLS, so you only see/react to posts you can see.
create policy "reactions: see on visible posts" on public.reactions for select to authenticated
  using (exists (select 1 from public.shared_items s where s.id = item_id));
create policy "reactions: add" on public.reactions for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.shared_items s where s.id = item_id and s.visible_to_followers));
create policy "reactions: change own" on public.reactions for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "reactions: remove own" on public.reactions for delete to authenticated using (user_id = (select auth.uid()));
revoke update on public.reactions from authenticated;
grant update (emoji) on public.reactions to authenticated;

-- ── Reports (write-only from the app; BeakerBoys reviews in the dashboard) ───
create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid default auth.uid() references auth.users (id) on delete set null,
  reported_user_id uuid references auth.users (id) on delete cascade,
  item_id          uuid references public.shared_items (id) on delete set null,
  reason           text not null check (length(reason) between 1 and 500),
  status           text not null default 'open' check (status in ('open', 'resolved')),
  created_at       timestamptz not null default now()
);
alter table public.reports enable row level security;
create policy "reports: file" on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()) and private.under_limit('reports', 'reporter_id', 20, interval '1 day'));

-- ── Photos: private bucket, JPEG only, 3 MB max. Files live under <user id>/... ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shared-photos', 'shared-photos', false, 3145728, array['image/jpeg']);

create policy "photos: read own"    on storage.objects for select to authenticated using (bucket_id = 'shared-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos: followers can view" on storage.objects for select to authenticated using (
  bucket_id = 'shared-photos' and exists (
    select 1 from public.shared_items s
    where name = any (s.photo_paths) and s.visible_to_followers and private.can_view(s.user_id)
      and (storage.foldername(name))[1] = s.user_id::text));          -- the photo must belong to the poster
-- Flood limit: 300 photos a day. Counted in a helper (security definer) because a
-- policy on storage.objects can't query storage.objects itself (infinite recursion).
create function private.photos_today() returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from storage.objects
  where bucket_id = 'shared-photos' and (storage.foldername(name))[1] = auth.uid()::text
    and created_at > now() - interval '1 day';
$$;
revoke execute on function private.photos_today() from public, anon;
grant execute on function private.photos_today() to authenticated;
create policy "photos: add own"     on storage.objects for insert to authenticated with check (
  bucket_id = 'shared-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
  and private.photos_today() < 300);
create policy "photos: change own"  on storage.objects for update to authenticated using (bucket_id = 'shared-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "photos: delete own"  on storage.objects for delete to authenticated using (bucket_id = 'shared-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ── In-app account deletion (Apple 5.1.1(v), privacy law) ────────────────────
-- The app deletes the user's photos first, then calls this; profile, follows,
-- reactions, and shared items all go with the account (on delete cascade).
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
