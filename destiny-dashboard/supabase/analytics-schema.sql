-- Run this in Supabase Studio > SQL Editor

create table if not exists daily_snapshots (
  snapshot_date        date primary key,
  total_items          integer,
  checked_out          integer,
  available            integer,
  overdue              integer,
  total_patrons        integer,
  active_patrons_30d   integer,
  new_patrons_ytd      integer,
  checkouts_ytd        integer,
  checkouts_7d         integer,
  checkouts_30d        integer,
  total_fines_balance  numeric(10,2),
  pending_holds        integer,
  never_checked_out    integer,
  room_use_ytd         integer,
  room_use_7d          integer,
  room_use_30d         integer,
  total_borrows_ytd    integer,
  total_borrows_7d     integer,
  total_borrows_30d    integer,
  created_at           timestamptz default now()
);

-- Room-use / total-borrows columns were added to app/api/sync/daily/route.ts
-- after this table was first created in some environments. Run these on an
-- existing database (no-ops if the columns already exist).
alter table daily_snapshots add column if not exists room_use_ytd      integer;
alter table daily_snapshots add column if not exists room_use_7d       integer;
alter table daily_snapshots add column if not exists room_use_30d      integer;
alter table daily_snapshots add column if not exists total_borrows_ytd integer;
alter table daily_snapshots add column if not exists total_borrows_7d  integer;
alter table daily_snapshots add column if not exists total_borrows_30d integer;

create table if not exists monthly_circulation (
  year            integer,
  month           integer,
  checkouts       integer,
  checkins        integer,
  active_patrons  integer,
  new_patrons     integer,
  new_items       integer,
  room_use        integer,
  total_borrows   integer,
  created_at      timestamptz default now(),
  primary key (year, month)
);

-- Same drift as above, for app/api/sync/monthly/route.ts.
alter table monthly_circulation add column if not exists room_use      integer;
alter table monthly_circulation add column if not exists total_borrows integer;

-- Generic read-through cache: every dashboard API route that queries Destiny
-- (MS SQL Server) writes its last-good response here on success. When the
-- SQL Server is unreachable, the route falls back to the newest row for its
-- key instead of failing, so the dashboard still shows (stale) data.
-- Keyed by route path + query string, e.g. "/api/stats?year=2026".
create table if not exists api_cache (
  route      text primary key,
  payload    jsonb not null,
  synced_at  timestamptz not null default now()
);

-- The dashboard reads daily_snapshots/monthly_circulation directly from the
-- browser using the public anon key (see lib/supabase.ts), while the sync
-- routes write using the service-role key (lib/supabase-server.ts), which
-- bypasses RLS. If RLS is enabled on these tables with no SELECT policy,
-- writes succeed silently but the dashboard's read-back returns zero rows
-- and the Trends tab looks empty even though the sync worked. These tables
-- hold only aggregate library stats (no PII), so a public read policy is
-- safe. api_cache is server-only (read/written via the service-role key
-- from lib/cache.ts) and does not need a public policy.
alter table daily_snapshots enable row level security;
alter table monthly_circulation enable row level security;

drop policy if exists "Public read access" on daily_snapshots;
create policy "Public read access" on daily_snapshots for select using (true);

drop policy if exists "Public read access" on monthly_circulation;
create policy "Public read access" on monthly_circulation for select using (true);

-- Full catalog mirror, kept in sync by app/api/sync/catalog/route.ts. Lets
-- other webapps read call number / title / author / publisher / year /
-- sublocation / barcode straight from Supabase instead of connecting to
-- Destiny (MS SQL Server) directly.
create table if not exists library_catalog (
  copy_id           integer primary key,
  barcode           text,
  call_number       text,
  title             text,
  author            text,
  publisher         text,
  publication_year  integer,
  sublocation       text,
  synced_at         timestamptz not null default now()
);

create index if not exists library_catalog_title_idx     on library_catalog (title);
create index if not exists library_catalog_call_number_idx on library_catalog (call_number);
create index if not exists library_catalog_barcode_idx    on library_catalog (barcode);

alter table library_catalog enable row level security;
drop policy if exists "Public read access" on library_catalog;
create policy "Public read access" on library_catalog for select using (true);

-- Pre-aggregated breakdowns for the dashboard's Collection Overview chart —
-- cheaper than pulling every row to the browser just to count/group them.
create or replace view library_catalog_by_sublocation as
  select coalesce(nullif(sublocation, ''), 'Unassigned') as sublocation, count(*)::int as total
  from library_catalog
  group by 1
  order by total desc;

create or replace view library_catalog_by_decade as
  select (floor(publication_year / 10.0) * 10)::int as decade, count(*)::int as total
  from library_catalog
  where publication_year is not null and publication_year >= 1900
  group by 1
  order by decade;

-- Views need their own grant even though the base table already allows
-- public reads via RLS.
grant select on library_catalog_by_sublocation to anon, authenticated;
grant select on library_catalog_by_decade to anon, authenticated;

-- Other-campus stats. Those campuses don't share Destiny for circulation —
-- some run their own SLiMS (synced live from its MySQL database by
-- app/api/sync/slims/route.ts) and some run local-only Koha (no network
-- access to sync from, so their staff export a CSV and POST it to
-- app/api/sync/koha-upload/route.ts on whatever schedule they can manage).
-- One row per campus per period; latest row per campus/period_type is what
-- the dashboard's Campuses tab reads.
create table if not exists campus_stats (
  campus         text not null,
  source         text not null check (source in ('slims', 'koha')),
  period_type    text not null check (period_type in ('daily', 'monthly')),
  period_date    date not null,
  total_items    integer,
  checked_out    integer,
  total_patrons  integer,
  active_patrons integer,
  checkouts      integer,
  new_items      integer,
  synced_at      timestamptz not null default now(),
  primary key (campus, period_type, period_date)
);

create index if not exists campus_stats_campus_idx on campus_stats (campus, period_date desc);

alter table campus_stats enable row level security;
drop policy if exists "Public read access" on campus_stats;
create policy "Public read access" on campus_stats for select using (true);
