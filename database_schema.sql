create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null unique,
  role text not null check (role in ('gerente', 'supervisor', 'vendedor')),
  regional text not null check (regional in ('ESPIRITO SANTO', 'RIO DE JANEIRO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  payment_term text,
  price_table text,
  billing_unit text,
  created_at timestamptz not null default now()
);

alter table public.clients add column if not exists payment_term text;
alter table public.clients add column if not exists price_table text;
alter table public.clients add column if not exists billing_unit text;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_code text not null,
  name text not null,
  price_table numeric(12,2) not null check (price_table >= 0),
  price_margin_zero numeric(12,2) not null check (price_margin_zero >= 0),
  weight numeric(12,2) not null check (weight >= 0),
  variable_value numeric(12,2) not null check (variable_value >= 0),
  created_at timestamptz not null default now()
);

alter table public.products add column if not exists product_code text;
alter table public.products add column if not exists price_table numeric(12,2);
alter table public.products add column if not exists price_margin_zero numeric(12,2);
alter table public.products add column if not exists weight numeric(12,2);
alter table public.products add column if not exists variable_value numeric(12,2);

create unique index if not exists products_user_code_uidx
on public.products (user_id, product_code);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'test_value'
  ) then
    execute 'update public.products set weight = coalesce(weight, test_value)';
    execute 'alter table public.products drop column test_value';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'products'
      and column_name = 'price'
  ) then
    execute 'update public.products set price_table = coalesce(price_table, price), price_margin_zero = coalesce(price_margin_zero, price)';
    execute 'alter table public.products drop column price';
  end if;
end $$;

update public.products
set price_margin_zero = coalesce(price_margin_zero, price_table);

update public.products
set weight = coalesce(weight, 0),
    variable_value = coalesce(variable_value, 0);

update public.products
set product_code = coalesce(product_code, id::text)
where product_code is null;

alter table public.products
  alter column product_code set not null,
  alter column price_table set not null,
  alter column price_margin_zero set not null,
  alter column weight set not null,
  alter column variable_value set not null;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references public.clients(id) on delete restrict,
  total numeric(12,2) not null check (total >= 0),
  status text not null default 'aberto',
  created_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0)
);

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

drop policy if exists "profiles_owner_rw" on public.profiles;
create policy "profiles_owner_rw" on public.profiles
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "clients_owner_rw" on public.clients;
create policy "clients_owner_rw" on public.clients
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "products_owner_rw" on public.products;
create policy "products_owner_rw" on public.products
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "orders_owner_rw" on public.orders;
create policy "orders_owner_rw" on public.orders
for all to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "order_items_owner_rw" on public.order_items;
create policy "order_items_owner_rw" on public.order_items
for all to authenticated
using (
  exists (
    select 1
    from public.orders o
    where o.id = order_id
      and o.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.orders o
    where o.id = order_id
      and o.user_id = auth.uid()
  )
);
