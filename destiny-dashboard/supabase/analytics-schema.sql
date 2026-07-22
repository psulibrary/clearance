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
  created_at           timestamptz default now()
);

create table if not exists monthly_circulation (
  year            integer,
  month           integer,
  checkouts       integer,
  checkins        integer,
  active_patrons  integer,
  new_patrons     integer,
  new_items       integer,
  created_at      timestamptz default now(),
  primary key (year, month)
);

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
