-- ============================================================
--  Campus Food Court — Supabase schema
--  Paste this whole file into: Supabase Dashboard → SQL Editor → Run
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- counters / helpers ----------
create or replace function istoday() returns date
language sql stable as $$
  select (now() at time zone 'Asia/Kolkata')::date
$$;

-- ---------- tables ----------
create table if not exists admins (
  id         int primary key generated always as identity,
  username   text not null unique,
  pass_hash  text not null,
  created_at timestamptz not null default now()
);

create table if not exists admin_sessions (
  token      uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists items (
  id         bigint primary key generated always as identity,
  name       text not null check (length(btrim(name)) between 1 and 60),
  emoji      text not null default '🍽️',
  category   text not null default 'Snacks',
  price      bigint not null check (price > 0 and price <= 100000000),   -- paise
  stock      int not null default 0 check (stock >= 0),
  available  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists orders (
  id           bigint primary key generated always as identity,
  token_no     int not null,
  section      text not null check (section in ('boys','girls')),
  status       text not null default 'placed' check (status in ('placed','completed','cancelled')),
  total        bigint not null,
  client_token text not null unique,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_day  date not null default istoday(),
  unique (token_no, section, created_day)
);
create index if not exists idx_orders_board on orders (section, status, created_day);
create index if not exists idx_orders_board_lookup on orders (section, status, created_day);

create table if not exists order_items (
  id         bigint primary key generated always as identity,
  order_id   bigint not null references orders(id) on delete cascade,
  item_id    bigint,
  name       text not null,
  emoji      text,
  price      bigint not null,
  qty        int not null check (qty > 0),
  line_total bigint not null
);
create index if not exists idx_order_items_order on order_items (order_id);

-- ---------- default admin ----------
insert into admins (username, pass_hash)
values ('admin', crypt('admin123', gen_salt('bf')))
on conflict (username) do nothing;

-- ---------- row level security ----------
alter table admins        enable row level security;
alter table admin_sessions enable row level security;
alter table items          enable row level security;
alter table orders         enable row level security;
alter table order_items    enable row level security;

-- Public may READ the menu and orders (needed for live boards).
-- Nobody writes directly — all writes happen through the secure
-- functions below (security definer), which do their own checks.
drop policy if exists "items_read"   on items;
drop policy if exists "orders_read"  on orders;
drop policy if exists "oitems_read"  on order_items;
create policy "items_read"  on items       for select using (true);
create policy "orders_read" on orders      for select using (true);
create policy "oitems_read" on order_items for select using (true);

-- ---------- realtime ----------
do $$
begin
  begin
    alter publication supabase_realtime add table orders;
  exception
    when duplicate_object then null;   -- already added
    when undefined_object then null;   -- publication missing (realtime off)
  end;
end $$;

-- ============================================================
--  ORDERING (public)
-- ============================================================
create or replace function order_full(p_order_id bigint) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select to_jsonb(t)
  from (
    select o.id,
           o.token_no as "tokenNo",
           o.section,
           o.status,
           o.total,
           o.client_token as "clientToken",
           o.created_at as "createdAt",
           (select coalesce(jsonb_agg(jsonb_build_object(
              'name', oi.name, 'emoji', oi.emoji, 'price', oi.price,
              'qty', oi.qty, 'lineTotal', oi.line_total) order by oi.id), '[]')
            from order_items oi where oi.order_id = o.id) as items
    from orders o where o.id = p_order_id
  ) t
$$;

create or replace function place_order(
  p_section text, p_client_token text, p_items jsonb
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_item      items%rowtype;
  v_el        jsonb;
  v_id        bigint;
  v_qty       int;
  v_total     bigint := 0;
  v_order_id  bigint;
  v_result    jsonb;
begin
  if p_section not in ('boys','girls') then
    raise exception 'Invalid counter';
  end if;
  if p_client_token !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception 'Bad request token';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 50 then
    raise exception 'Your cart is empty';
  end if;

  -- idempotency: same device token → same order back
  select id into v_order_id from orders where client_token = p_client_token;
  if found then
    return order_full(v_order_id);
  end if;

  -- serialize order creation per counter/day so numbers stay gapless
  perform pg_advisory_xact_lock(hashtext('order|' || p_section || '|' || istoday()::text));

  -- validate cart & lock stock rows
  for v_el in select * from jsonb_array_elements(p_items) loop
    v_id  := (v_el->>'itemId')::bigint;
    v_qty := coalesce((v_el->>'qty')::int, 0);
    if v_qty < 1 or v_qty > 10 then
      raise exception 'Contanct The volunteers for hight quantities';
    end if;
    select * into v_item from items where id = v_id for update;
    if not found then raise exception 'Something in your cart was just removed'; end if;
    if not v_item.available then raise exception '"%" is unavailable right now', v_item.name; end if;
    if v_item.stock < v_qty then
      if v_item.stock = 0 then raise exception '"%" just went out of stock', v_item.name;
      else raise exception 'Only % left of "%" ', v_item.stock, v_item.name;
      end if;
    end if;
    v_total := v_total + v_item.price * v_qty;
  end loop;

  -- per-counter daily number: B-1.. G-1..
  insert into orders (token_no, section, status, total, client_token, created_day)
  values (
    coalesce((select max(token_no) from orders
              where section = p_section and created_day = istoday()), 0) + 1,
    p_section, 'placed', v_total, p_client_token, istoday()
  ) returning id into v_order_id;

  for v_el in select * from jsonb_array_elements(p_items) loop
    v_id  := (v_el->>'itemId')::bigint;
    v_qty := (v_el->>'qty')::int;
    select * into v_item from items where id = v_id;
    insert into order_items (order_id, item_id, name, emoji, price, qty, line_total)
    values (v_order_id, v_id, v_item.name, v_item.emoji, v_item.price, v_qty, v_item.price * v_qty);
    update items set stock = stock - v_qty, updated_at = now() where id = v_id;
  end loop;

  v_result := order_full(v_order_id);
  return v_result;
exception
  when unique_violation then
    -- lost a race against an identical submission: return that order instead
    select id into v_order_id from orders where client_token = p_client_token;
    if found then return order_full(v_order_id); end if;
    raise;
end $$;

create or replace function my_orders(p_tokens text[]) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  t text;
begin
  foreach t in array p_tokens loop
    if t !~ '^[A-Za-z0-9_-]{8,64}$' then
      raise exception 'Bad request token';
    end if;
  end loop;
  return coalesce((
    select jsonb_agg(order_full(o.id) order by o.id desc)
    from (
      select id from orders
      where client_token = any(p_tokens)
      order by id desc limit 50
    ) o
  ), '[]');
end $$;

create or replace function counter_board(p_section text) returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare
  v_active   jsonb;
  v_done     jsonb;
  v_count    int;
  v_revenue  bigint;
begin
  if p_section not in ('boys','girls') then raise exception 'Invalid counter'; end if;

  select coalesce(jsonb_agg(order_full(o.id) order by o.id), '[]')
    into v_active
  from orders o
  where o.section = p_section and o.status = 'placed';

  select count(*)::int, coalesce(sum(o.total), 0)
    into v_count, v_revenue
  from orders o
  where o.section = p_section and o.created_day = istoday()
    and o.status in ('completed','cancelled');

  select coalesce(jsonb_agg(order_full(o.id) order by o.id desc), '[]')
    into v_done
  from (
    select id from orders
    where section = p_section and created_day = istoday()
      and status in ('completed','cancelled')
    order by id desc limit 20
  ) s
  join orders o on o.id = s.id;

  return jsonb_build_object(
    'active', v_active,
    'doneToday', jsonb_build_object('count', v_count, 'revenue', v_revenue),
    'doneOrders', v_done
  );
end $$;

create or replace function set_order_status(p_order_id bigint, p_status text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_cur text;
  v_result jsonb;
begin
  if not (p_status = any(array['completed','cancelled'])) then
    raise exception 'Unknown status';
  end if;
  select status into v_cur from orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;

  if v_cur = p_status then
    v_result := order_full(p_order_id);
    return jsonb_set(v_result, '{alreadyCompleted}', 'true'::jsonb);
  end if;

  if v_cur <> 'placed' then
    raise exception 'This order is already %', v_cur;
  end if;

  update orders
     set status = p_status, updated_at = now()
   where id = p_order_id;

  if p_status = 'cancelled' then
    update items i
       set stock = i.stock + oi.qty, updated_at = now()
      from order_items oi
     where oi.order_id = p_order_id and oi.item_id = i.id;
  end if;

  return order_full(p_order_id);
end $$;

create or replace function cancel_order(p_order_id bigint, p_client_token text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_o orders%rowtype;
begin
  select * into v_o from orders where id = p_order_id;
  if not found then raise exception 'Order not found'; end if;
  if v_o.status <> 'placed' then
    raise exception 'This order is already served or cancelled';
  end if;
  -- a sender may only cancel with their own device token;
  -- counter staff call it without a token
  if p_client_token is not null and p_client_token <> '' and p_client_token <> v_o.client_token then
    raise exception 'Not allowed';
  end if;
  return set_order_status(p_order_id, 'cancelled');
end $$;

-- ============================================================
--  ADMIN (all verified by session token)
-- ============================================================
create or replace function admin_verify(p_token text) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  delete from admin_sessions where expires_at < now();
  if p_token is null or
     not exists (select 1 from admin_sessions
                 where token::text = p_token and expires_at > now()) then
    raise exception 'SESSION_EXPIRED: please log in again';
  end if;
end $$;

create or replace function admin_login(p_username text, p_password text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_row admins%rowtype;
  v_token uuid;
begin
  select * into v_row from admins where username = btrim(p_username);
  if not found or v_row.pass_hash <> crypt(p_password, v_row.pass_hash) then
    raise exception 'Wrong username or password';
  end if;
  delete from admin_sessions where expires_at < now();
  insert into admin_sessions (expires_at) values (now() + interval '30 days')
  returning token into v_token;
  return v_token::text;
end $$;

create or replace function admin_logout(p_token text) returns void
language sql security definer set search_path = public, extensions as $$
  delete from admin_sessions where token::text = p_token;
$$;

create or replace function admin_change_password(p_token text, p_current text, p_new text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_row admins%rowtype;
begin
  perform admin_verify(p_token);
  if length(coalesce(p_new,'')) < 6 then
    raise exception 'New password must be at least 6 characters';
  end if;
  select * into v_row from admins order by id limit 1;
  if v_row.pass_hash <> crypt(p_current, v_row.pass_hash) then
    raise exception 'Current password is wrong';
  end if;
  update admins set pass_hash = crypt(p_new, gen_salt('bf')) where id = v_row.id;
  -- log out every other device
  delete from admin_sessions where token::text <> p_token;
end $$;

create or replace function admin_save_item(p_token text, p_item jsonb) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id     bigint;
  v_name   text;
  v_emoji  text;
  v_cat    text;
  v_price  bigint;
  v_stock  int;
  v_avail  boolean;
  v_row    items%rowtype;
begin
  perform admin_verify(p_token);
  v_id    := nullif(p_item->>'id','')::bigint;
  v_name  := btrim(coalesce(p_item->>'name',''));
  v_emoji := coalesce(nullif(btrim(p_item->>'emoji'),''), '🍽️');
  v_cat   := coalesce(btrim(nullif(p_item->>'category','')), 'Snacks');
  v_price := round(coalesce((p_item->>'price')::numeric, 0) * 100)::bigint;
  v_stock := coalesce((p_item->>'stock')::int, 0);
  v_avail := coalesce((p_item->>'available')::boolean, true);

  if length(v_name) < 1 or length(v_name) > 60 then raise exception 'Item name is required'; end if;
  if v_price <= 0 then raise exception 'Enter a valid price in ₹'; end if;
  if v_stock < 0 or v_stock > 100000 then raise exception 'Stock must be between 0 and 100000'; end if;
  if length(v_cat) > 30 then raise exception 'Category is too long'; end if;

  if v_id is null then
    insert into items (name, emoji, category, price, stock, available)
    values (v_name, v_emoji, v_cat, v_price, v_stock, v_avail)
    returning * into v_row;
  else
    update items set name=v_name, emoji=v_emoji, category=v_cat, price=v_price,
                     stock=v_stock, available=v_avail, updated_at=now()
    where id = v_id returning * into v_row;
    if not found then raise exception 'Item not found'; end if;
  end if;
  return to_jsonb(v_row);
end $$;

create or replace function admin_delete_item(p_token text, p_id bigint) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform admin_verify(p_token);
  delete from items where id = p_id;
  if not found then raise exception 'Item not found'; end if;
end $$;

create or replace function admin_list_items(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_out jsonb;
begin
  perform admin_verify(p_token);
  select coalesce(jsonb_agg(x order by x.category, x.name), '[]')
    into v_out
  from (
    select i.*, coalesce(s.sold, 0) as sold
    from items i
    left join (select item_id, sum(qty) sold from order_items group by item_id) s
      on s.item_id = i.id
  ) x;
  return v_out;
end $$;

create or replace function admin_stats(p_token text, p_range text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_from  date;
  v_rev   bigint; v_cnt bigint; v_sold bigint; v_canc bigint;
  v_sec   jsonb;  v_top jsonb; v_low jsonb; v_devices jsonb;
begin
  perform admin_verify(p_token);
  if p_range = 'today' then v_from := istoday();
  elsif p_range = 'week' then v_from := istoday() - 6;
  else v_from := null; end if;

  select coalesce(sum(total),0), count(*) into v_rev, v_cnt
  from orders
  where status <> 'cancelled' and (v_from is null or created_day >= v_from);

  select coalesce(sum(oi.qty),0) into v_sold
  from order_items oi join orders o on o.id = oi.order_id
  where o.status <> 'cancelled' and (v_from is null or o.created_day >= v_from);

  select count(*) into v_canc from orders
  where status = 'cancelled' and (v_from is null or created_day >= v_from);

  select coalesce(jsonb_build_object(
           'boys',  jsonb_build_object('revenue', coalesce(sum(total) filter (where section='boys'),0), 'orders', count(*) filter (where section='boys')),
           'girls', jsonb_build_object('revenue', coalesce(sum(total) filter (where section='girls'),0), 'orders', count(*) filter (where section='girls'))
         ), jsonb_build_object('boys', jsonb_build_object('revenue',0,'orders',0), 'girls', jsonb_build_object('revenue',0,'orders',0))) into v_sec
  from orders where status <> 'cancelled' and (v_from is null or created_day >= v_from);

  select coalesce(jsonb_agg(jsonb_build_object(
           'name', t.name, 'emoji', t.emoji, 'sold', t.sold, 'revenue', t.revenue) order by t.sold desc), '[]')
    into v_top
  from (
    select oi.name, max(oi.emoji) emoji, sum(oi.qty) sold, sum(oi.line_total) revenue
    from order_items oi join orders o on o.id = oi.order_id
    where o.status <> 'cancelled' and (v_from is null or o.created_day >= v_from)
    group by oi.name order by sold desc limit 10
  ) t;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', i.id, 'name', i.name, 'emoji', i.emoji, 'stock', i.stock) order by i.stock), '[]')
    into v_low
  from items i where i.stock <= 5;

  v_devices := device_counts();

  return jsonb_build_object(
    'range', coalesce(p_range,'all'),
    'revenue', v_rev, 'orders', v_cnt, 'totalSold', v_sold, 'cancelled', v_canc,
    'sections', v_sec,
    'topItems', v_top,
    'lowStock', v_low,
    'devices', v_devices
  );
end $$;

create or replace function admin_orders_list(
  p_token text, p_section text, p_status text, p_today boolean
) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_out jsonb;
begin
  perform admin_verify(p_token);
  select coalesce(jsonb_agg(order_full(o.id) order by o.id desc), '[]')
    into v_out
  from (
    select * from orders
    where (p_section = 'all' or section = p_section)
      and (p_status  = 'all' or status  = p_status)
      and (not p_today  or created_day = istoday())
    order by id desc limit 500
  ) o;
  return v_out;
end $$;



-- ============================================================
--  ACCESS GATE (common password for the whole app)
-- ============================================================
create table if not exists app_settings (
  key   text primary key,
  value text not null
);

insert into app_settings (key, value) values
  ('gate_pass_hash',    crypt('syllabites123', gen_salt('bf'))),
  ('gate_question',     'Enter your gmail'),
  ('gate_answer_hash',  crypt('ssgginfotech', gen_salt('bf'))),
  ('gate_version',      '1'),
  ('boys_pass_hash',    crypt('boyzz', gen_salt('bf'))),
  ('girls_pass_hash',   crypt('girls', gen_salt('bf'))),
  ('public_offer_active', '0'),
  ('public_offer_remaining', '0')
on conflict (key) do nothing;

alter table app_settings enable row level security;

create or replace function gate_version() returns int
language sql stable security definer set search_path = public, extensions as $$
  select coalesce((select value::int from app_settings where key = 'gate_version'), 1)
$$;

create or replace function gate_verify(p_password text) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_hash text;
begin
  select value into v_hash from app_settings where key = 'gate_pass_hash';
  if v_hash is null or p_password is null or crypt(p_password, v_hash) <> v_hash then
    raise exception 'Wrong password';
  end if;
  return gate_version();
end $$;

create or replace function gate_reset(p_answer text, p_new_password text) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ans text;
  v_ver int;
begin
  select value into v_ans from app_settings where key = 'gate_answer_hash';
  if v_ans is null or p_answer is null or crypt(btrim(p_answer), v_ans) <> v_ans then
    raise exception 'That answer is not correct';
  end if;
  if length(coalesce(p_new_password, '')) < 4 then
    raise exception 'New password must be at least 4 characters';
  end if;
  update app_settings set value = crypt(p_new_password, gen_salt('bf'))
   where key = 'gate_pass_hash';
  update app_settings set value = ((value::int) + 1)::text where key = 'gate_version';
  select value::int into v_ver from app_settings where key = 'gate_version';
  return v_ver;
end $$;

-- ---------- section passwords (Boys / Girls) ----------
create or replace function verify_section_password(p_section text, p_password text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text; v_key text;
begin
  if p_section not in ('boys','girls') then raise exception 'Invalid section'; end if;
  v_key := p_section || '_pass_hash';
  select value into v_hash from app_settings where key = v_key;
  if v_hash is null or crypt(p_password, v_hash) <> v_hash then
    raise exception 'Wrong password for %', initcap(p_section);
  end if;
  return true;
end $$;

create or replace function admin_set_section_password(p_token text, p_section text, p_new_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare v_key text;
begin
  perform admin_verify(p_token);
  if p_section not in ('boys','girls') then raise exception 'Invalid section'; end if;
  if length(coalesce(p_new_password,'')) < 3 then raise exception 'Password must be at least 3 characters'; end if;
  v_key := p_section || '_pass_hash';
  update app_settings set value = crypt(p_new_password, gen_salt('bf')) where key = v_key;
  if not found then
    insert into app_settings (key, value) values (v_key, crypt(p_new_password, gen_salt('bf')));
  end if;
end $$;

-- ============================================================
--  ADMIN: username change + gate password management
-- ============================================================
create or replace function admin_change_username(p_token text, p_new_username text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id   int;
  v_name text;
begin
  perform admin_verify(p_token);
  v_name := btrim(coalesce(p_new_username, ''));
  if v_name !~ '^[A-Za-z0-9_.]{3,40}$' then
    raise exception 'Username must be 3-40 characters (letters, numbers, dot, underscore)';
  end if;
  select id into v_id from admins order by id limit 1;
  begin
    update admins set username = v_name where id = v_id;
  exception when unique_violation then
    raise exception 'That username is already taken';
  end;
  return v_name;
end $$;

create or replace function admin_set_gate_password(p_token text, p_new_password text) returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_ver int;
begin
  perform admin_verify(p_token);
  if length(coalesce(p_new_password, '')) < 4 then
    raise exception 'Gate password must be at least 4 characters';
  end if;
  update app_settings set value = crypt(p_new_password, gen_salt('bf'))
   where key = 'gate_pass_hash';
  update app_settings set value = ((value::int) + 1)::text where key = 'gate_version';
  select value::int into v_ver from app_settings where key = 'gate_version';
  return v_ver;
end $$;

create or replace function admin_start_public_offer(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform admin_verify(p_token);
  update app_settings set value='1' where key='public_offer_active';
  update app_settings set value='3' where key='public_offer_remaining';
  -- clear previous discounted order flags for fresh run? keep history but reset active
  return jsonb_build_object('active', true, 'remaining', 3);
end $$;

create or replace function admin_offer_status(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_active text; v_remaining int; v_logs jsonb;
begin
  perform admin_verify(p_token);
  select value into v_active from app_settings where key='public_offer_active';
  select value::int into v_remaining from app_settings where key='public_offer_remaining';
  select coalesce(jsonb_agg(jsonb_build_object('code', code, 'customerName', customer_name, 'customerClass', customer_class, 'customerSection', customer_section, 'eventName', event_name, 'originalTotal', original_total, 'discountPercent', discount_percent, 'discountAmount', discount_amount, 'total', total, 'createdAt', created_at) order by id desc), '[]')
  into v_logs from public_orders where is_discounted = true;
  return jsonb_build_object('active', v_active='1', 'remaining', coalesce(v_remaining,0), 'discountedOrders', coalesce(v_logs, '[]'::jsonb));
end $$;

create or replace function public_offer_public_status() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object('active', coalesce((select value='1' from app_settings where key='public_offer_active'), false))
$$;

-- ============================================================
--  BACKUPS / RESET (company data lifecycle)
--  - reset always snapshots current data first
--  - import always snapshots current data before restoring
-- ============================================================
create table if not exists backups (
  id         bigint primary key generated always as identity,
  label      text not null default 'Backup',
  payload    jsonb not null,
  created_at timestamptz not null default now()
);
alter table backups enable row level security;

create or replace function backup_payload() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'items',      (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from items i),
    'orders',     (select coalesce(jsonb_agg(to_jsonb(o)), '[]'::jsonb) from orders o),
    'orderItems', (select coalesce(jsonb_agg(to_jsonb(oi)), '[]'::jsonb) from order_items oi)
  )
$$;

create or replace function admin_create_backup(p_token text, p_label text default null) returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id bigint;
  v_label text;
begin
  perform admin_verify(p_token);
  v_label := nullif(btrim(p_label, ''), '');
if v_label is null then
    v_label := 'Manual backup';
  end if;
  insert into backups (label, payload)
  values (v_label, backup_payload())
  returning id into v_id;
  return v_id;
end $$;

create or replace function admin_list_backups(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_out jsonb;
begin
  perform admin_verify(p_token);
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', b.id,
           'label', b.label,
           'createdAt', b.created_at,
           'items', jsonb_array_length(b.payload->'items'),
           'orders', jsonb_array_length(b.payload->'orders')
         ) order by b.id desc), '[]')
    into v_out
  from backups b;
  return v_out;
end $$;

create or replace function wipe_live_data() returns void
language sql security definer set search_path = public, extensions as $$
  truncate table order_items, orders, items restart identity cascade;
$$;

create or replace function restore_payload(p_payload jsonb) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform wipe_live_data();

  insert into items (id, name, emoji, category, price, stock, available, created_at, updated_at)
  overriding system value
  select (x->>'id')::bigint,
         x->>'name',
         coalesce(x->>'emoji', '🍽️'),
         coalesce(x->>'category', 'Snacks'),
         (x->>'price')::bigint,
         (x->>'stock')::int,
         coalesce((x->>'available')::boolean, true),
         coalesce((x->>'created_at')::timestamptz, now()),
         coalesce((x->>'updated_at')::timestamptz, now())
  from jsonb_array_elements(coalesce(p_payload->'items', '[]'::jsonb)) x;

  insert into orders (id, token_no, section, status, total, client_token, created_at, updated_at, created_day)
  overriding system value
  select (x->>'id')::bigint,
         (x->>'token_no')::int,
         x->>'section',
         x->>'status',
         (x->>'total')::bigint,
         x->>'client_token',
         coalesce((x->>'created_at')::timestamptz, now()),
         coalesce((x->>'updated_at')::timestamptz, now()),
         coalesce((x->>'created_day')::date, istoday())
  from jsonb_array_elements(coalesce(p_payload->'orders', '[]'::jsonb)) x;

  insert into order_items (id, order_id, item_id, name, emoji, price, qty, line_total)
  overriding system value
  select (x->>'id')::bigint,
         (x->>'order_id')::bigint,
         nullif(x->>'item_id','')::bigint,
         x->>'name',
         x->>'emoji',
         (x->>'price')::bigint,
         (x->>'qty')::int,
         (x->>'line_total')::bigint
  from jsonb_array_elements(coalesce(p_payload->'orderItems', '[]'::jsonb)) x;

  -- keep generated-id sequences ahead of restored ids
  perform setval(pg_get_serial_sequence('items', 'id'),
                 coalesce((select max(id) from items), 0) + 1, false);
  perform setval(pg_get_serial_sequence('orders', 'id'),
                 coalesce((select max(id) from orders), 0) + 1, false);
  perform setval(pg_get_serial_sequence('order_items', 'id'),
                 coalesce((select max(id) from order_items), 0) + 1, false);
end $$;

create or replace function admin_restore_backup(p_token text, p_backup_id bigint) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_payload jsonb;
  v_safety_id bigint;
begin
  perform admin_verify(p_token);

  select payload into v_payload from backups where id = p_backup_id;
  if not found then raise exception 'Backup not found'; end if;

  -- safety net: snapshot CURRENT data before overwriting it
  insert into backups (label, payload)
  values ('Auto — before importing backup #' || p_backup_id, backup_payload())
  returning id into v_safety_id;

  perform restore_payload(v_payload);

  return jsonb_build_object(
    'restoredFrom', p_backup_id,
    'safetyBackupId', v_safety_id,
    'items', jsonb_array_length(coalesce(v_payload->'items', '[]'::jsonb)),
    'orders', jsonb_array_length(coalesce(v_payload->'orders', '[]'::jsonb))
  );
end $$;

create or replace function admin_reset_all(p_token text, p_label text default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_backup_id bigint;
  v_counts jsonb;
  v_label text;
begin
  perform admin_verify(p_token);

  -- everything that exists right now is preserved on the server first
  v_label := nullif(btrim(p_label, ''), '');
  if v_label is null then
    v_label := 'Fresh start';
  end if;
  insert into backups (label, payload)
  values (v_label, backup_payload())
  returning id into v_backup_id;

  v_counts := backup_payload();
  perform wipe_live_data();

  return jsonb_build_object(
    'backupId', v_backup_id,
    'backedUpItems', jsonb_array_length(coalesce(v_counts->'items', '[]'::jsonb)),
    'backedUpOrders', jsonb_array_length(coalesce(v_counts->'orders', '[]'::jsonb))
  );
end $$;

-- ============================================================
--  PUBLIC PRE-GATE ORDERS (6-digit code, admin-only visibility)
--  Orders placed BEFORE the access password. Code shown only to
--  the orderer, visible only to admins. Handles heavy concurrent
--  traffic with non-repeating codes.
-- ============================================================
create table if not exists public_orders (
  id            bigint primary key generated always as identity,
  code          char(6) not null unique,
  total         bigint not null,
  status        text not null default 'placed' check (status in ('placed','completed','cancelled')),
  customer_name text not null default '',
  customer_class text not null default '',
  customer_section text not null default '',
  event_name    text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_day   date not null default istoday()
);
create index if not exists idx_public_orders_code on public_orders (code);
create index if not exists idx_public_orders_day on public_orders (created_day, status);

-- add discount columns if DB was created before this update
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='public_orders' and column_name='discount_percent') then
    alter table public_orders add column discount_percent int;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='public_orders' and column_name='discount_amount') then
    alter table public_orders add column discount_amount bigint;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='public_orders' and column_name='original_total') then
    alter table public_orders add column original_total bigint;
  end if;
  if not exists (select 1 from information_schema.columns where table_name='public_orders' and column_name='is_discounted') then
    alter table public_orders add column is_discounted boolean not null default false;
  end if;
end $$;

create table if not exists public_order_items (
  id         bigint primary key generated always as identity,
  order_id   bigint not null references public_orders(id) on delete cascade,
  item_id    bigint,
  name       text not null,
  emoji      text,
  price      bigint not null,
  qty        int not null check (qty > 0 and qty <= 10),
  line_total bigint not null
);
create index if not exists idx_public_order_items_order on public_order_items (order_id);

alter table public_orders enable row level security;
alter table public_order_items enable row level security;
drop policy if exists "public_orders_none" on public_orders;
drop policy if exists "public_order_items_none" on public_order_items;
-- No public read policies: only admin via security-definer functions can read

-- ensure new columns exist for DBs created before this update (idempotent migration)
do $$ begin
  if not exists (select 1 from information_schema.columns where table_name='public_orders' and column_name='customer_name') then
    alter table public_orders add column customer_name text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='public_orders' and column_name='customer_class') then
    alter table public_orders add column customer_class text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='public_orders' and column_name='customer_section') then
    alter table public_orders add column customer_section text not null default '';
  end if;
  if not exists (select 1 from information_schema.columns where table_name='public_orders' and column_name='event_name') then
    alter table public_orders add column event_name text not null default '';
  end if;
end $$;

do $$
begin
  begin alter publication supabase_realtime add table public_orders;
  exception when duplicate_object then null; when undefined_object then null; end;
end $$;

create or replace function generate_public_code() returns char(6)
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_code char(6);
  v_tries int := 0;
begin
  perform pg_advisory_xact_lock(hashtext('public_code'));
  loop
    v_code := lpad((floor(random()*900000) + 100000)::int::text, 6, '0');
    perform 1 from public_orders where code = v_code;
    if not found then return v_code; end if;
    v_tries := v_tries + 1;
    if v_tries > 20 then
      v_code := lpad((extract(epoch from clock_timestamp())::bigint % 900000 + 100000)::text,6,'0');
      perform 1 from public_orders where code = v_code;
      if not found then return v_code; end if;
    end if;
    if v_tries > 40 then raise exception 'Could not generate unique code, please try again'; end if;
  end loop;
end $$;

create or replace function public_order_full(p_order_id bigint) returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select to_jsonb(t) from (
    select o.id, o.code, o.total, o.status, o.created_at as "createdAt",
      o.customer_name as "customerName", o.customer_class as "customerClass",
      o.customer_section as "customerSection", o.event_name as "eventName",
      o.discount_percent as "discountPercent", o.discount_amount as "discountAmount",
      o.original_total as "originalTotal", o.is_discounted as "isDiscounted",
      (select coalesce(jsonb_agg(jsonb_build_object('name', oi.name,'emoji',oi.emoji,'price',oi.price,'qty',oi.qty,'lineTotal',oi.line_total) order by oi.id),'[]')
       from public_order_items oi where oi.order_id=o.id) as items
    from public_orders o where o.id=p_order_id
  ) t
$$;

create or replace function public_place_order(p_items jsonb, p_name text, p_class text, p_section text, p_event text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_item items%rowtype; v_el jsonb; v_id bigint; v_qty int; v_total bigint:=0; v_oid bigint; v_code char(6);
  v_active text; v_remaining int; v_roll double precision; v_pct int; v_discount bigint; v_original bigint;
begin
  if btrim(coalesce(p_name,'')) = '' then raise exception 'Please enter your Name'; end if;
  if btrim(coalesce(p_class,'')) = '' then raise exception 'Please enter your Class'; end if;
  if btrim(coalesce(p_section,'')) = '' then raise exception 'Please enter your Section'; end if;
  if btrim(coalesce(p_event,'')) = '' then raise exception 'Please enter Event participating'; end if;
  if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>50 then
    raise exception 'Your cart is empty'; end if;
  for v_el in select * from jsonb_array_elements(p_items) loop
    v_id := (v_el->>'itemId')::bigint; v_qty := coalesce((v_el->>'qty')::int,0);
    if v_qty < 1 or v_qty > 10 then raise exception 'Approach Volunteers For more orders'; end if;
    select * into v_item from items where id=v_id for update;
    if not found then raise exception 'Something in your cart was just removed'; end if;
    if not v_item.available then raise exception '"%" is unavailable right now', v_item.name; end if;
    if v_item.stock < v_qty then
      if v_item.stock=0 then raise exception '"%" just went out of stock', v_item.name;
      else raise exception 'Only % left of "%" ', v_item.stock, v_item.name; end if;
    end if;
    v_total := v_total + v_item.price * v_qty;
  end loop;
  v_code := generate_public_code();
  -- discount logic: only for public orders, 2% chance, max 2 times, 5-10% off
  v_original := v_total;
  select value into v_active from app_settings where key='public_offer_active';
  select value::int into v_remaining from app_settings where key='public_offer_remaining';
  if v_active='1' and coalesce(v_remaining,0) > 0 then
    v_roll := random();
    if v_roll < 0.06 then
      v_pct := floor(random()*6 + 5)::int;
      v_discount := round(v_total * v_pct / 100.0)::bigint;
      v_total := v_total - v_discount;
      update app_settings set value = ((value::int)-1)::text where key='public_offer_remaining';
      select value into v_active from app_settings where key='public_offer_active';
      -- auto-stop when remaining hits 0
      if (select value::int from app_settings where key='public_offer_remaining') <= 0 then
        update app_settings set value='0' where key='public_offer_active';
      end if;
      insert into public_orders (code, total, customer_name, customer_class, customer_section, event_name, original_total, discount_percent, discount_amount, is_discounted)
      values (v_code, v_total, btrim(p_name), btrim(p_class), btrim(p_section), btrim(p_event), v_original, v_pct, v_discount, true) returning id into v_oid;
      for v_el in select * from jsonb_array_elements(p_items) loop
        v_id := (v_el->>'itemId')::bigint; v_qty := (v_el->>'qty')::int;
        select * into v_item from items where id=v_id;
        insert into public_order_items (order_id, item_id, name, emoji, price, qty, line_total)
        values (v_oid, v_id, v_item.name, v_item.emoji, v_item.price, v_qty, v_item.price*v_qty);
        update items set stock = stock - v_qty, updated_at=now() where id=v_id;
      end loop;
      return public_order_full(v_oid);
    end if;
  end if;
  insert into public_orders (code, total, customer_name, customer_class, customer_section, event_name)
  values (v_code, v_total, btrim(p_name), btrim(p_class), btrim(p_section), btrim(p_event)) returning id into v_oid;
  for v_el in select * from jsonb_array_elements(p_items) loop
    v_id := (v_el->>'itemId')::bigint; v_qty := (v_el->>'qty')::int;
    select * into v_item from items where id=v_id;
    insert into public_order_items (order_id, item_id, name, emoji, price, qty, line_total)
    values (v_oid, v_id, v_item.name, v_item.emoji, v_item.price, v_qty, v_item.price*v_qty);
    update items set stock = stock - v_qty, updated_at=now() where id=v_id;
  end loop;
  return public_order_full(v_oid);
exception when unique_violation then
  -- extremely rare code collision under concurrent traffic: retry once with fresh code
  v_code := generate_public_code();
  insert into public_orders (code, total, customer_name, customer_class, customer_section, event_name)
  values (v_code, v_total, btrim(p_name), btrim(p_class), btrim(p_section), btrim(p_event)) returning id into v_oid;
  for v_el in select * from jsonb_array_elements(p_items) loop
    v_id := (v_el->>'itemId')::bigint; v_qty := (v_el->>'qty')::int;
    select * into v_item from items where id=v_id;
    insert into public_order_items (order_id, item_id, name, emoji, price, qty, line_total)
    values (v_oid, v_id, v_item.name, v_item.emoji, v_item.price, v_qty, v_item.price*v_qty);
  end loop;
  return public_order_full(v_oid);
end $$;

create or replace function admin_list_public_orders(p_token text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare v_out jsonb; begin
  perform admin_verify(p_token);
  select coalesce(jsonb_agg(public_order_full(o.id) order by o.id desc),'[]') into v_out
  from (select id from public_orders order by id desc limit 200) o;
  return v_out;
end $$;

create or replace function admin_update_public_order_status(p_token text, p_order_id bigint, p_status text) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform admin_verify(p_token);
  if p_status not in ('completed','cancelled') then raise exception 'Unknown status'; end if;
  update public_orders set status=p_status, updated_at=now() where id=p_order_id;
  if not found then raise exception 'Order not found'; end if;
  if p_status='cancelled' then
    update items i set stock=i.stock+oi.qty, updated_at=now() from public_order_items oi where oi.order_id=p_order_id and oi.item_id=i.id;
  end if;
  return public_order_full(p_order_id);
end $$;

-- ============================================================
--  DEVICE PRESENCE (multi-device, per-counter isolation)
--  Every sender/receiver phone registers itself; admins see
--  live counts separately for Boys and Girls.
-- ============================================================
create table if not exists device_presence (
  device_id text not null,
  section   text not null check (section in ('boys','girls')),
  role      text not null check (role in ('sender','receiver')),
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now(),
  primary key (device_id, section, role)
);
create index if not exists idx_device_presence_seen on device_presence (section, role, last_seen);
alter table device_presence enable row level security;
drop policy if exists "device_presence_all" on device_presence;
create policy "device_presence_all" on device_presence
  for all using (true) with check (true);

create or replace function register_device(
  p_device_id text, p_section text, p_role text
) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if p_device_id !~ '^[A-Za-z0-9_-]{8,64}$' then
    raise exception 'Bad device id';
  end if;
  if p_section not in ('boys','girls') then
    raise exception 'Invalid counter';
  end if;
  if p_role not in ('sender','receiver') then
    raise exception 'Invalid role';
  end if;
  insert into device_presence (device_id, section, role, last_seen)
  values (p_device_id, p_section, p_role, now())
  on conflict (device_id, section, role)
  do update set last_seen = excluded.last_seen;
  -- opportunistic cleanup of stale entries (> 10 min)
  delete from device_presence where last_seen < now() - interval '10 minutes';
end $$;

create or replace function device_counts() returns jsonb
language sql stable security definer set search_path = public, extensions as $$
  select jsonb_build_object(
    'boys', jsonb_build_object(
      'sender',   (select count(*) from device_presence where section='boys'  and role='sender'   and last_seen > now() - interval '2 minutes'),
      'receiver', (select count(*) from device_presence where section='boys'  and role='receiver' and last_seen > now() - interval '2 minutes'),
      'total',    (select count(*) from device_presence where section='boys'  and last_seen > now() - interval '2 minutes')
    ),
    'girls', jsonb_build_object(
      'sender',   (select count(*) from device_presence where section='girls' and role='sender'   and last_seen > now() - interval '2 minutes'),
      'receiver', (select count(*) from device_presence where section='girls' and role='receiver' and last_seen > now() - interval '2 minutes'),
      'total',    (select count(*) from device_presence where section='girls' and last_seen > now() - interval '2 minutes')
    ),
    'total', (select count(*) from device_presence where last_seen > now() - interval '2 minutes')
  )
$$;
