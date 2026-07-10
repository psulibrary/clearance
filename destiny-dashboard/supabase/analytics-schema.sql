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
