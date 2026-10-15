-- Migration 0008: Concurrency Race & Security Hardening
-- 1. Fix issue_certificates search_path for pgcrypto gen_random_bytes resolution
create or replace function public.issue_certificates(_event_id uuid) returns integer
language plpgsql security definer set search_path = public, extensions as $$
declare n int;
begin
  if not public.can_manage_event(_event_id) then raise exception 'Not permitted'; end if;
  insert into public.certificates(registration_id,event_id,user_id,issued_by)
    select a.registration_id,a.event_id,a.user_id,auth.uid() from public.attendance a where a.event_id=_event_id
    on conflict (registration_id) do nothing;
  get diagnostics n = row_count;
  perform public.log_audit('certificate.issue','event',_event_id,jsonb_build_object('count',n));
  return n;
end $$;

-- 2. Fix check_in_ticket vs cancel_registration race condition by locking registration FOR UPDATE
create or replace function public.check_in_ticket(_event_id uuid, _token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.tickets; r public.registrations; att_id uuid; p public.profiles;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not (public.can_manage_event(_event_id) or public.staff_perm(_event_id,'scan')) then
    raise exception 'Not permitted to scan for this event';
  end if;
  select * into t from public.tickets where token = _token;
  if not found then return jsonb_build_object('result','invalid'); end if;

  -- Lock registration row to prevent concurrent cancel_registration race
  select * into r from public.registrations where id = t.registration_id for update;
  if r.event_id <> _event_id then return jsonb_build_object('result','wrong_event'); end if;
  if r.status <> 'registered' then return jsonb_build_object('result','cancelled'); end if;

  select * into p from public.profiles where id = r.user_id;
  insert into public.attendance(registration_id, event_id, user_id, checked_in_by)
    values (r.id, r.event_id, r.user_id, auth.uid()) on conflict (registration_id) do nothing returning id into att_id;
  if att_id is null then return jsonb_build_object('result','duplicate','name',p.full_name); end if;

  perform public.log_audit('attendance.check_in','attendance',att_id,jsonb_build_object('event_id',_event_id));
  return jsonb_build_object('result','ok','name',p.full_name);
end $$;

-- 3. Add explicit auth.uid() check to cancel_registration
create or replace function public.cancel_registration(_registration_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  update public.registrations set status='cancelled', cancelled_at=now()
   where id = _registration_id and user_id = auth.uid() and status='registered'
     and not exists (select 1 from public.attendance a where a.registration_id = _registration_id);
  if not found then raise exception 'Cannot cancel this registration'; end if;
  perform public.log_audit('registration.cancel','registration',_registration_id,'{}');
end $$;

-- 4. Guard profiles against email and ID modification
create or replace function public.profiles_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if new.id <> old.id then raise exception 'Cannot change profile id'; end if;
  if new.email <> old.email and not public.has_role(auth.uid(), 'admin') then
    raise exception 'Cannot change profile email';
  end if;
  return new;
end $$;
drop trigger if exists trg_profiles_guard on public.profiles;
create trigger trg_profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

-- 5. Restrict notifications updates to read_at only
revoke update on public.notifications from authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Revoke execute from anon on updated routines for defense-in-depth
revoke execute on function public.issue_certificates(uuid) from public, anon;
grant execute on function public.issue_certificates(uuid) to authenticated, service_role;
revoke execute on function public.check_in_ticket(uuid, text) from public, anon;
grant execute on function public.check_in_ticket(uuid, text) to authenticated, service_role;
revoke execute on function public.cancel_registration(uuid) from public, anon;
grant execute on function public.cancel_registration(uuid) to authenticated, service_role;
