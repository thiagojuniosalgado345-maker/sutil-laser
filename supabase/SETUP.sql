-- SÚTIL LASER — configuração inicial do backend
-- Use em um projeto Supabase NOVO e exclusivo desta loja.
-- Execute o arquivo inteiro no SQL Editor, uma única vez.
-- A chave publishable/anon pode aparecer no site; service_role NUNCA pode aparecer no frontend.

create extension if not exists pgcrypto;

-- 1. Permissões administrativas. Administradores são atribuídos manualmente pelo responsável.
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin'))
);
alter table public.user_roles enable row level security;

create or replace function public.is_sutil_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;
revoke all on function public.is_sutil_admin() from public;
grant execute on function public.is_sutil_admin() to anon, authenticated;

drop policy if exists "Admin can read own role" on public.user_roles;
create policy "Admin can read own role"
on public.user_roles for select
to authenticated
using (user_id = auth.uid());

-- 2. Produtos.
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  category text not null,
  short_description text not null default '',
  description text not null default '',
  price numeric(10,2),
  price_label text not null default 'Consulte o valor',
  image_url text,
  gallery jsonb not null default '[]'::jsonb,
  model_type text not null default 'other',
  personalization jsonb not null default '{"text":true,"logo":true,"font":true,"color":true,"position":true,"size":true}'::jsonb,
  featured boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_active_sort_idx
on public.products (active, sort_order, created_at desc);
alter table public.products enable row level security;

drop policy if exists "Public can view active products and admins all" on public.products;
create policy "Public can view active products and admins all"
on public.products for select
to anon, authenticated
using (active = true or public.is_sutil_admin());

drop policy if exists "Admins can insert products" on public.products;
create policy "Admins can insert products"
on public.products for insert
to authenticated
with check (public.is_sutil_admin());

drop policy if exists "Admins can update products" on public.products;
create policy "Admins can update products"
on public.products for update
to authenticated
using (public.is_sutil_admin())
with check (public.is_sutil_admin());

drop policy if exists "Admins can delete products" on public.products;
create policy "Admins can delete products"
on public.products for delete
to authenticated
using (public.is_sutil_admin());

-- 3. Dados públicos e editáveis da loja.
create table if not exists public.store_settings (
  id smallint primary key default 1 check (id = 1),
  store_name text not null default 'Sútil Laser',
  tagline text not null default 'Personalizados com significado',
  instagram_url text,
  whatsapp_number text,
  contact_email text,
  updated_at timestamptz not null default now()
);
alter table public.store_settings enable row level security;

drop policy if exists "Public can view store settings" on public.store_settings;
create policy "Public can view store settings"
on public.store_settings for select
to anon, authenticated
using (id = 1);

drop policy if exists "Admins can update store settings" on public.store_settings;
create policy "Admins can update store settings"
on public.store_settings for update
to authenticated
using (public.is_sutil_admin())
with check (public.is_sutil_admin());

-- O registro inicial permite ao painel editar configurações sem expor operações de INSERT ao público.
insert into public.store_settings (id, store_name, tagline, instagram_url)
values (1, 'Sútil Laser', 'Personalizamos peças e presentes com gravação a laser, transformando ideias em lembranças com significado.', 'https://www.instagram.com/sutillaser/')
on conflict (id) do nothing;

-- 4. Atualização automática da data de modificação.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists store_settings_set_updated_at on public.store_settings;
create trigger store_settings_set_updated_at
before update on public.store_settings
for each row execute function public.set_updated_at();

-- 5. Permissões SQL. RLS continua controlando quais linhas cada papel pode acessar.
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select on public.store_settings to anon, authenticated;
grant update on public.store_settings to authenticated;
grant select on public.user_roles to authenticated;

-- 6. Armazenamento público de fotos dos produtos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view product images" on storage.objects;
create policy "Anyone can view product images"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'product-images');

drop policy if exists "Admins can upload product images" on storage.objects;
create policy "Admins can upload product images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and public.is_sutil_admin());

drop policy if exists "Admins can update product images" on storage.objects;
create policy "Admins can update product images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and public.is_sutil_admin())
with check (bucket_id = 'product-images' and public.is_sutil_admin());

drop policy if exists "Admins can delete product images" on storage.objects;
create policy "Admins can delete product images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and public.is_sutil_admin());

-- 7. Catálogo inicial. Fotos e preços ficam em branco para evitar publicar imagens
-- de marketplace ou valores antigos sem confirmação da empresa.
insert into public.products
(slug,name,category,short_description,description,price,price_label,model_type,featured,active,sort_order)
values
('copo-termico-473','Copo térmico 473 ml','Copos térmicos','Copo térmico em inox com tampa.','Copo térmico em inox com tampa, disponível para avaliação de gravação personalizada.',null,'Consulte o valor','other',true,true,10),
('taca-termica-cocktail-414','Taça térmica Cocktail 414 ml','Taças térmicas','Taça térmica em inox para brindar momentos especiais.','Taça térmica em inox para brindar momentos especiais com personalização sob consulta.',null,'Consulte o valor','other',true,true,20),
('garrafa-termica-800','Garrafa térmica 800 ml','Garrafas','Garrafa térmica personalizável.','Garrafa térmica de 800 ml. Confirme modelo, disponibilidade e possibilidade de gravação.',null,'Consulte o valor','other',false,true,30),
('garrafa-termica-1000','Garrafa térmica 1.000 ml','Garrafas','Garrafa térmica de maior capacidade.','Garrafa térmica de 1.000 ml. Confirme modelo, disponibilidade e possibilidade de gravação.',null,'Consulte o valor','other',false,true,40),
('copo-com-canudo-1200','Copo com canudo 1.200 ml','Copos térmicos','Copo de grande capacidade.','Copo com canudo de 1.200 ml, disponível para consulta de personalização.',null,'Consulte o valor','other',false,true,50),
('cuia-350','Cuia 350 ml','Acessórios','Cuia personalizável para presentear.','Cuia de 350 ml. Consulte opções de personalização e disponibilidade.',null,'Consulte o valor','other',false,true,60),
('garrafa-magsafe-802','Garrafa MagSafe 802 ml','Garrafas','Garrafa com suporte MagSafe.','Garrafa MagSafe de 802 ml. Confirme detalhes do modelo e gravação com a equipe.',null,'Consulte o valor','other',false,true,70),
('copo-dindo-dinda-470','Copo Dindo e Dinda 470 ml','Presentes','Lembrança personalizada para padrinhos e madrinhas.','Copo de 470 ml com proposta de presente para padrinhos e madrinhas.',null,'Consulte o valor','other',false,true,80),
('kit-presentes-personalizado','Kit de presentes personalizado','Kits','Monte um presente especial.','Kit de presentes com possibilidades de gravação a laser sob consulta.',null,'Consulte o valor','other',false,true,90),
('copo-termico-com-alca','Copo térmico com alça','Copos térmicos','Copo com alça para personalizar.','Copo térmico com alça. Consulte opções, cores e disponibilidade.',null,'Consulte o valor','other',false,true,100),
('kit-tacas-personalizadas','Kit de taças personalizadas','Kits','Kit para comemorações e presentes.','Kit de taças com personalização sob consulta.',null,'Consulte o valor','other',false,true,110)
on conflict (slug) do nothing;

-- 8. Criar o primeiro administrador:
-- a) No Supabase: Authentication > Users > Add user. Crie o e-mail e a senha do proprietário.
-- b) Copie o UUID desse usuário.
-- c) Execute a instrução abaixo substituindo o valor pelo UUID real:
--
-- insert into public.user_roles (user_id, role)
-- values ('UUID-REAL-DO-USUARIO', 'admin')
-- on conflict (user_id) do update set role = 'admin';
--
-- Depois, no arquivo config.js do site, informe Project URL e a chave publishable/anon.
-- NÃO use a chave service_role no frontend.
