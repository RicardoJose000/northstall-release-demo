-- Northstall marketplace: core schema + row level security
-- Rule of thumb: the app (anon / authenticated key) can only ever touch its own rows.
-- Anything involving money or Stripe state is written by Edge Functions (service role) only.

create extension if not exists pgcrypto;

-- PROFILES ------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  created_at   timestamptz not null default now()
);

-- SELLER ACCOUNTS (Stripe Connect Express) ----------------------------------
create table public.seller_accounts (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  stripe_account_id  text not null unique,
  charges_enabled    boolean not null default false,
  payouts_enabled    boolean not null default false,
  details_submitted  boolean not null default false,
  updated_at         timestamptz not null default now()
);

-- LISTINGS ------------------------------------------------------------------
create table public.listings (
  id            uuid primary key default gen_random_uuid(),
  seller_id     uuid not null references public.profiles (id) on delete cascade,
  title         text not null check (char_length(title) between 3 and 120),
  price_cents   integer not null check (price_cents >= 100),
  currency      text not null default 'usd',
  is_published  boolean not null default false,
  created_at    timestamptz not null default now()
);
create index listings_seller_idx on public.listings (seller_id);

-- ORDERS --------------------------------------------------------------------
create table public.orders (
  id                        uuid primary key default gen_random_uuid(),
  -- on delete set null: deleting an account keeps the order history for accounting
  listing_id                uuid references public.listings (id) on delete set null,
  buyer_id                  uuid references public.profiles (id) on delete set null,
  seller_id                 uuid references public.profiles (id) on delete set null,
  amount_cents              integer not null,
  fee_cents                 integer not null,
  status                    text not null default 'pending'
                            check (status in ('pending', 'paid', 'failed', 'refunded')),
  stripe_payment_intent_id  text unique,
  created_at                timestamptz not null default now()
);
create index orders_buyer_idx  on public.orders (buyer_id);
create index orders_seller_idx on public.orders (seller_id);

-- STRIPE EVENTS (webhook idempotency) ---------------------------------------
create table public.stripe_events (
  id           text primary key,            -- Stripe event id (evt_...)
  type         text not null,
  received_at  timestamptz not null default now()
);

-- ROW LEVEL SECURITY ----------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.seller_accounts enable row level security;
alter table public.listings        enable row level security;
alter table public.orders          enable row level security;
alter table public.stripe_events   enable row level security;

-- profiles: you see and edit only yourself
create policy "profiles: read own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: update own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- seller_accounts: read own status; writes come only from the stripe-webhook function
create policy "seller_accounts: read own" on public.seller_accounts
  for select to authenticated
  using (user_id = (select auth.uid()));

-- listings: everyone browses published items, sellers manage their own
create policy "listings: read published" on public.listings
  for select to anon, authenticated
  using (is_published);

create policy "listings: seller reads own" on public.listings
  for select to authenticated
  using (seller_id = (select auth.uid()));

create policy "listings: verified seller inserts own" on public.listings
  for insert to authenticated
  with check (
    seller_id = (select auth.uid())
    and exists (
      select 1 from public.seller_accounts s
      where s.user_id = (select auth.uid()) and s.charges_enabled
    )
  );

create policy "listings: seller updates own" on public.listings
  for update to authenticated
  using (seller_id = (select auth.uid()))
  with check (seller_id = (select auth.uid()));

create policy "listings: seller deletes own" on public.listings
  for delete to authenticated
  using (seller_id = (select auth.uid()));

-- orders: only the buyer and the seller of an order can see it. No client writes at all.
create policy "orders: parties read" on public.orders
  for select to authenticated
  using ((select auth.uid()) in (buyer_id, seller_id));

-- stripe_events: no policies on purpose -> invisible to anon/authenticated, service role only.

-- AUTO PROFILE ON SIGN UP -----------------------------------------------------
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
