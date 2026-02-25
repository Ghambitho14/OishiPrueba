-- Funciones y RLS: igualar producción a prueba
-- Ejecutar en producción (zznrxsinjxsozhkbjyvq) por partes si es necesario

-- create_order_transaction (ya aplicadas antes: helpers, cash_open_shift, cash_add_movement)
CREATE OR REPLACE FUNCTION public.create_order_transaction(
  p_client_name text, p_client_phone text, p_client_rut text, p_items jsonb,
  p_total numeric, p_payment_type text, p_payment_ref text, p_note text,
  p_branch_id uuid, p_company_id uuid, p_status text
)
RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $function$
declare
  v_client_id uuid;
  v_new_order jsonb;
  v_existing_client_id uuid;
  v_company_id uuid;
  v_items jsonb := '[]'::jsonb;
  v_total numeric := 0;
  v_item jsonb;
  v_product_id uuid;
  v_qty integer;
  v_name text;
  v_price numeric;
  v_has_discount boolean;
  v_discount_price numeric;
  v_unit_price numeric;
begin
  if p_branch_id is null then raise exception 'branch_required' using errcode = '22000'; end if;
  if p_items is null or jsonb_array_length(p_items) is null then raise exception 'items_required' using errcode = '22000'; end if;
  if p_company_id is null then select company_id into v_company_id from public.branches where id = p_branch_id;
  else v_company_id := p_company_id; end if;
  if v_company_id is null then raise exception 'company_not_found' using errcode = 'P0001'; end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_product_id := null;
    begin v_product_id := (v_item->>'id')::uuid; exception when others then v_product_id := null; end;
    if v_product_id is null then raise exception 'invalid_item_product' using errcode = '22000'; end if;
    v_qty := greatest(1, coalesce((v_item->>'quantity')::int, 1));
    select p.name, pp.price, pp.has_discount, pp.discount_price into v_name, v_price, v_has_discount, v_discount_price
      from public.product_prices pp
      join public.products p on p.id = pp.product_id
      join public.product_branch pb on pb.product_id = pp.product_id
     where pp.product_id = v_product_id and pp.branch_id = p_branch_id and pp.is_active = true
       and pb.branch_id = p_branch_id and pb.is_active = true;
    if v_price is null then raise exception 'invalid_item_price' using errcode = '22000'; end if;
    v_unit_price := case when coalesce(v_has_discount, false) and v_discount_price is not null and v_discount_price > 0 then v_discount_price else v_price end;
    v_total := v_total + (v_unit_price * v_qty);
    v_items := v_items || jsonb_build_array(jsonb_build_object('id', v_product_id, 'name', v_name, 'quantity', v_qty, 'price', v_price, 'has_discount', coalesce(v_has_discount, false), 'discount_price', v_discount_price, 'description', v_item->>'description'));
  end loop;
  select id into v_existing_client_id from public.clients where phone = p_client_phone limit 1;
  if v_existing_client_id is not null then
    update public.clients set name = coalesce(p_client_name, name), rut = case when length(p_client_rut) > 6 then p_client_rut else rut end, total_spent = coalesce(total_spent, 0) + v_total, total_orders = coalesce(total_orders, 0) + 1, last_order_at = now() where id = v_existing_client_id returning id into v_client_id;
  else
    insert into public.clients (name, phone, rut, total_spent, total_orders, last_order_at, company_id) values (p_client_name, p_client_phone, coalesce(p_client_rut, 'SIN-RUT-' || floor(extract(epoch from now()))::text), v_total, 1, now(), v_company_id) returning id into v_client_id;
  end if;
  insert into public.orders (client_id, client_name, client_phone, client_rut, items, total, payment_type, payment_ref, note, status, branch_id, company_id, created_at)
  values (v_client_id, p_client_name, p_client_phone, p_client_rut, v_items, v_total, p_payment_type, p_payment_ref, p_note, p_status, p_branch_id, v_company_id, now())
  returning to_jsonb(orders.*) into v_new_order;
  return v_new_order;
end;
$function$;
