-- ============================================================
-- Mason City Farmers Market – Supabase Schema
-- Run this entire file in your Supabase SQL Editor
-- ============================================================

-- Markets
create table if not exists markets (
  id uuid default gen_random_uuid() primary key,
  date date not null unique,
  location text not null default 'Southbridge Mall',
  capacity integer not null default 20,
  archived boolean not null default false,
  created_at timestamptz default now()
);

-- Sign-ups (confirmed + waitlist in same table, ordered by created_at)
create table if not exists signups (
  id uuid default gen_random_uuid() primary key,
  market_id uuid references markets(id) on delete cascade not null,
  name text not null,
  email text not null,
  vendor_type text not null,
  status text not null check (status in ('confirmed', 'waitlist')),
  created_at timestamptz default now(),
  unique(market_id, email)
);

-- Per-vendor seasonal limits (targeted, email-matched)
create table if not exists vendor_limits (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null unique,
  max_markets integer not null default 2,
  created_at timestamptz default now()
);

-- App-wide settings (type caps stored as JSON blob)
create table if not exists settings (
  key text primary key,
  value jsonb not null
);

-- Notification / promotion log
create table if not exists notifications (
  id uuid default gen_random_uuid() primary key,
  message text not null,
  created_at timestamptz default now()
);

-- Disable Row Level Security
-- (security is handled by the admin password inside the app)
alter table markets disable row level security;
alter table signups disable row level security;
alter table vendor_limits disable row level security;
alter table settings disable row level security;
alter table notifications disable row level security;

-- Seed default type_limits setting
insert into settings (key, value)
values ('type_limits', '{}')
on conflict (key) do nothing;
