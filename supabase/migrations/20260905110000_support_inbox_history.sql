create function public.is_support_staff() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admin_users where user_id=auth.uid() and role in ('owner','editor','support'));
$$;
revoke all on function public.is_support_staff() from public,anon;
grant execute on function public.is_support_staff() to authenticated,service_role;
alter policy support_read on public.studio_support_conversations using (user_id=auth.uid() or public.is_support_staff());
alter policy support_staff_update on public.studio_support_conversations using (public.is_support_staff()) with check(public.is_support_staff());

alter table public.studio_support_conversations
 add column staff_replies jsonb not null default '[]',
 add column last_customer_at timestamptz,
 add column last_staff_at timestamptz,
 add column staff_seen_at timestamptz,
 add column customer_seen_at timestamptz;
update public.studio_support_conversations set
 last_customer_at=case when status<>'chat' then updated_at end,
 last_staff_at=case when nullif(btrim(staff_reply),'') is not null then updated_at end,
 staff_replies=case when nullif(btrim(staff_reply),'') is not null then jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'content',staff_reply,'created_at',updated_at)) else '[]'::jsonb end;

-- Preserve replies from older admin clients while they roll over to the new RPC.
create function public.studio_support_staff_history() returns trigger
language plpgsql set search_path=public as $$
begin
 if new.staff_reply is distinct from old.staff_reply and nullif(btrim(new.staff_reply),'') is not null then
  if new.staff_replies=old.staff_replies then
   new.staff_replies:=old.staff_replies||jsonb_build_array(jsonb_build_object('id',gen_random_uuid(),'content',btrim(new.staff_reply),'created_at',now()));
  end if;
  new.last_staff_at:=now(); new.updated_at:=now();
 elsif new.status is distinct from old.status and public.is_support_staff() then
  new.last_staff_at:=now(); new.updated_at:=now();
 end if;
 return new;
end;
$$;
create trigger support_staff_history before update on public.studio_support_conversations
 for each row execute function public.studio_support_staff_history();

create or replace function public.studio_support_append(p_id uuid,p_messages jsonb,p_escalate boolean)
returns jsonb language sql security definer set search_path=public as $$
 with updated as (
 update studio_support_conversations set transcript=transcript||p_messages,
 status=case when p_escalate or status='resolved' then 'open' else status end,
 last_customer_at=now(), updated_at=now()
 where id=p_id returning *
 ) select to_jsonb(updated) from updated;
$$;

create function public.studio_support_staff_save(p_id uuid,p_reply text,p_status text,p_request_id uuid,p_customer_at timestamptz)
returns jsonb language plpgsql security definer set search_path=public as $$
declare c studio_support_conversations; reply text:=btrim(coalesce(p_reply,''));
begin
 if not public.is_support_staff() then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_status not in ('open','resolved') or p_request_id is null or length(reply)>6000 then raise exception 'invalid_support_update'; end if;
 select * into c from studio_support_conversations where id=p_id for update;
 if not found or c.status='chat' then raise exception 'ticket_not_found'; end if;
 if exists(select 1 from jsonb_array_elements(c.staff_replies) r where r->>'id'=p_request_id::text) then return to_jsonb(c); end if;
 if p_status='resolved' and c.last_customer_at is distinct from p_customer_at then raise exception 'support_changed_refresh_first'; end if;
 if reply='' and c.status=p_status then return to_jsonb(c); end if;
 update studio_support_conversations set status=p_status,
 staff_reply=case when reply<>'' then reply else staff_reply end,
 staff_replies=case when reply<>'' then staff_replies||jsonb_build_array(jsonb_build_object('id',p_request_id,'content',reply,'created_at',now())) else staff_replies end,
 last_staff_at=now(), updated_at=now()
 where id=p_id returning * into c;
 return to_jsonb(c);
end;
$$;
revoke all on function public.studio_support_staff_save(uuid,text,text,uuid,timestamptz) from public,anon;
grant execute on function public.studio_support_staff_save(uuid,text,text,uuid,timestamptz) to authenticated;

create function public.studio_support_mark_seen(p_id uuid,p_seen_at timestamptz,p_staff boolean default false)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_staff then
  if not public.is_support_staff() then raise exception 'not_authorized' using errcode='42501'; end if;
  update studio_support_conversations set staff_seen_at=greatest(staff_seen_at,least(p_seen_at,last_customer_at)) where id=p_id;
 else
  update studio_support_conversations set customer_seen_at=greatest(customer_seen_at,least(p_seen_at,last_staff_at)) where id=p_id and user_id=auth.uid();
 end if;
end;
$$;
revoke all on function public.studio_support_mark_seen(uuid,timestamptz,boolean) from public,anon;
grant execute on function public.studio_support_mark_seen(uuid,timestamptz,boolean) to authenticated;

create function public.studio_support_inbox(p_filter text default 'open',p_search text default '',p_offset integer default 0)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not public.is_support_staff() then raise exception 'not_authorized' using errcode='42501'; end if;
 if p_filter not in ('all','open','resolved','unread') or p_offset<0 or length(p_search)>200 then raise exception 'invalid_filter'; end if;
 with matched as (
 select * from studio_support_conversations c where status<>'chat'
 and (p_filter='all' or status=p_filter or (p_filter='unread' and status='open' and last_customer_at>coalesce(staff_seen_at,'-infinity')))
 and (p_search='' or coalesce(email,'') ilike '%'||p_search||'%' or ticket_number::text=replace(p_search,'#','') or transcript::text ilike '%'||p_search||'%')
 ), page as (select * from matched order by updated_at desc,id limit 50 offset p_offset)
 select jsonb_build_object('tickets',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),'total',(select count(*) from matched),
 'open',(select count(*) from studio_support_conversations where status='open'),
 'unread',(select count(*) from studio_support_conversations where status='open' and last_customer_at>coalesce(staff_seen_at,'-infinity'))) into result;
 return result;
end;
$$;
revoke all on function public.studio_support_inbox(text,text,integer) from public,anon;
grant execute on function public.studio_support_inbox(text,text,integer) to authenticated;
