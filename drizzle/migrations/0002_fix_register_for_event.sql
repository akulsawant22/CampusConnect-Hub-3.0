create or replace function public.register_for_event(_event_id uuid) returns uuid
language plpgsql security definer set search_path = public, extensions as $$
declare e public.events; cnt int; reg_id uuid; existing public.registrations; had_existing boolean;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.has_role(auth.uid(),'student') then raise exception 'Only students can register'; end if;
  select * into e from public.events where id = _event_id for update;
  if not found or e.status <> 'published' then raise exception 'Event not open for registration'; end if;
  if now() > e.registration_deadline then raise exception 'Registration deadline has passed'; end if;
  select * into existing from public.registrations where event_id = _event_id and user_id = auth.uid();
  had_existing := found;
  if had_existing and existing.status = 'registered' then raise exception 'Already registered'; end if;
  select count(*) into cnt from public.registrations where event_id = _event_id and status = 'registered';
  if cnt >= e.capacity then raise exception 'Event is full'; end if;
  if had_existing then
    update public.registrations set status='registered', cancelled_at=null where id = existing.id returning id into reg_id;
    update public.tickets set token = encode(extensions.gen_random_bytes(32),'hex') where registration_id = reg_id;
  else
    insert into public.registrations(event_id, user_id) values (_event_id, auth.uid()) returning id into reg_id;
    insert into public.tickets(registration_id, user_id) values (reg_id, auth.uid());
  end if;
  insert into public.notifications(user_id, title, body, link) values (auth.uid(), 'Registered: '||e.title, 'Your ticket is ready.', '/dashboard');
  perform public.log_audit('registration.create','registration',reg_id,jsonb_build_object('event_id',_event_id));
  return reg_id;
end $$;