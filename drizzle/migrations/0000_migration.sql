create extension if not exists pgcrypto;

create type public.app_role as enum ('admin','organizer','student');
create type public.event_status as enum ('draft','published','cancelled','completed');
create type public.registration_status as enum ('registered','cancelled');

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  department text,
  student_number text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
create index on public.user_roles(user_id);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.profiles(id) on delete restrict,
  title text not null check (char_length(title) between 3 and 160),
  description text not null default '',
  category text not null default 'general',
  venue text not null default '',
  cover_url text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  registration_deadline timestamptz not null,
  capacity integer not null check (capacity > 0 and capacity <= 100000),
  status public.event_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (registration_deadline <= ends_at)
);
create index on public.events(status, starts_at);
create index on public.events(organizer_id);
grant select, insert, update, delete on public.events to authenticated;
grant all on public.events to service_role;
alter table public.events enable row level security;

-- event staff (volunteers)
create table public.event_staff (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  can_scan boolean not null default true,
  can_view_registrations boolean not null default false,
  can_view_attendance boolean not null default false,
  assigned_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
create index on public.event_staff(user_id);
grant select on public.event_staff to authenticated;
grant all on public.event_staff to service_role;
alter table public.event_staff enable row level security;

-- registrations
create table public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status public.registration_status not null default 'registered',
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  unique (event_id, user_id)
);
create index on public.registrations(user_id);
create index on public.registrations(event_id, status);
grant select on public.registrations to authenticated;
grant all on public.registrations to service_role;
alter table public.registrations enable row level security;

-- opaque tickets (separate so staff never read tokens)
create table public.tickets (
  registration_id uuid primary key references public.registrations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(32),'hex'),
  created_at timestamptz not null default now()
);
create index on public.tickets(user_id);
grant select on public.tickets to authenticated;
grant all on public.tickets to service_role;
alter table public.tickets enable row level security;

-- attendance
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.registrations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  checked_in_by uuid references public.profiles(id),
  checked_in_at timestamptz not null default now()
);
create index on public.attendance(event_id);
create index on public.attendance(user_id);
grant select on public.attendance to authenticated;
grant all on public.attendance to service_role;
alter table public.attendance enable row level security;

-- certificates
create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null unique references public.registrations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  serial text not null unique default upper(encode(gen_random_bytes(8),'hex')),
  issued_by uuid references public.profiles(id),
  issued_at timestamptz not null default now()
);
create index on public.certificates(user_id);
grant select on public.certificates to authenticated;
grant all on public.certificates to service_role;
alter table public.certificates enable row level security;

-- feedback
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (char_length(comment) <= 2000),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);
grant select, insert on public.feedback to authenticated;
grant all on public.feedback to service_role;
alter table public.feedback enable row level security;

-- notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null default '',
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications(user_id, created_at desc);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;

-- audit logs
create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on public.audit_logs(created_at desc);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;

-- helpers
create or replace function public.can_manage_event(_event_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(),'admin') or exists (
    select 1 from public.events e where e.id = _event_id and e.organizer_id = auth.uid()
      and public.has_role(auth.uid(),'organizer'))
$$;

create or replace function public.staff_perm(_event_id uuid, _perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.event_staff s where s.event_id = _event_id and s.user_id = auth.uid()
    and case _perm when 'scan' then s.can_scan when 'registrations' then s.can_view_registrations
                   when 'attendance' then s.can_view_attendance else false end)
$$;

create or replace function public.log_audit(_action text, _entity text, _entity_id uuid, _meta jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.audit_logs(actor_id, action, entity, entity_id, metadata) values (auth.uid(), _action, _entity, _entity_id, coalesce(_meta,'{}'));
$$;
revoke execute on function public.log_audit(text,text,uuid,jsonb) from public, anon, authenticated;

create or replace function public.touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;
create trigger trg_profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger trg_events_touch before update on public.events for each row execute function public.touch_updated_at();

-- prevent organizer_id change / set published_at
create or replace function public.events_guard() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.organizer_id <> old.organizer_id and not public.has_role(auth.uid(),'admin') then
    raise exception 'Cannot change event organizer';
  end if;
  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.published_at = now();
  end if;
  return new;
end $$;
create trigger trg_events_guard before insert or update on public.events for each row execute function public.events_guard();

-- signup: profile + default student role
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), coalesce(new.email,''));
  insert into public.user_roles(user_id, role) values (new.id, 'student');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- policies
create policy "profiles self read" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'organizer'));
create policy "profiles self update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "roles own or admin read" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create policy "events read" on public.events for select to authenticated using (status in ('published','completed') or public.can_manage_event(id) or exists (select 1 from public.event_staff s where s.event_id = id and s.user_id = auth.uid()));
create policy "events insert" on public.events for insert to authenticated with check ((public.has_role(auth.uid(),'organizer') and organizer_id = auth.uid()) or public.has_role(auth.uid(),'admin'));
create policy "events update" on public.events for update to authenticated using (public.can_manage_event(id)) with check (public.can_manage_event(id));
create policy "events delete" on public.events for delete to authenticated using (public.can_manage_event(id) and status = 'draft');

create policy "staff read" on public.event_staff for select to authenticated using (user_id = auth.uid() or public.can_manage_event(event_id));

create policy "registrations read" on public.registrations for select to authenticated using (user_id = auth.uid() or public.can_manage_event(event_id) or public.staff_perm(event_id,'registrations'));
create policy "tickets own read" on public.tickets for select to authenticated using (user_id = auth.uid());
create policy "attendance read" on public.attendance for select to authenticated using (user_id = auth.uid() or public.can_manage_event(event_id) or public.staff_perm(event_id,'attendance'));
create policy "certificates read" on public.certificates for select to authenticated using (user_id = auth.uid() or public.can_manage_event(event_id));
create policy "feedback read" on public.feedback for select to authenticated using (user_id = auth.uid() or public.can_manage_event(event_id));
create policy "feedback insert" on public.feedback for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.attendance a where a.event_id = feedback.event_id and a.user_id = auth.uid()));
create policy "notifications own read" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications own update" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "audit admin read" on public.audit_logs for select to authenticated using (public.has_role(auth.uid(),'admin'));

-- trusted operations
create or replace function public.register_for_event(_event_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare e public.events; cnt int; reg_id uuid; existing public.registrations;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not public.has_role(auth.uid(),'student') then raise exception 'Only students can register'; end if;
  select * into e from public.events where id = _event_id for update;
  if not found or e.status <> 'published' then raise exception 'Event not open for registration'; end if;
  if now() > e.registration_deadline then raise exception 'Registration deadline has passed'; end if;
  select * into existing from public.registrations where event_id = _event_id and user_id = auth.uid();
  if found and existing.status = 'registered' then raise exception 'Already registered'; end if;
  select count(*) into cnt from public.registrations where event_id = _event_id and status = 'registered';
  if cnt >= e.capacity then raise exception 'Event is full'; end if;
  if found then
    update public.registrations set status='registered', cancelled_at=null where id = existing.id returning id into reg_id;
    update public.tickets set token = encode(gen_random_bytes(32),'hex') where registration_id = reg_id;
  else
    insert into public.registrations(event_id, user_id) values (_event_id, auth.uid()) returning id into reg_id;
    insert into public.tickets(registration_id, user_id) values (reg_id, auth.uid());
  end if;
  insert into public.notifications(user_id, title, body, link) values (auth.uid(), 'Registered: '||e.title, 'Your ticket is ready.', '/dashboard');
  perform public.log_audit('registration.create','registration',reg_id,jsonb_build_object('event_id',_event_id));
  return reg_id;
end $$;

create or replace function public.cancel_registration(_registration_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.registrations set status='cancelled', cancelled_at=now()
   where id = _registration_id and user_id = auth.uid() and status='registered'
     and not exists (select 1 from public.attendance a where a.registration_id = _registration_id);
  if not found then raise exception 'Cannot cancel this registration'; end if;
  perform public.log_audit('registration.cancel','registration',_registration_id,'{}');
end $$;

create or replace function public.check_in_ticket(_event_id uuid, _token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare t public.tickets; r public.registrations; att_id uuid; p public.profiles;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not (public.can_manage_event(_event_id) or public.staff_perm(_event_id,'scan')) then raise exception 'Not permitted to scan for this event'; end if;
  select * into t from public.tickets where token = _token;
  if not found then return jsonb_build_object('result','invalid'); end if;
  select * into r from public.registrations where id = t.registration_id;
  if r.event_id <> _event_id then return jsonb_build_object('result','wrong_event'); end if;
  if r.status <> 'registered' then return jsonb_build_object('result','cancelled'); end if;
  select * into p from public.profiles where id = r.user_id;
  insert into public.attendance(registration_id, event_id, user_id, checked_in_by)
    values (r.id, r.event_id, r.user_id, auth.uid()) on conflict (registration_id) do nothing returning id into att_id;
  if att_id is null then return jsonb_build_object('result','duplicate','name',p.full_name); end if;
  perform public.log_audit('attendance.check_in','attendance',att_id,jsonb_build_object('event_id',_event_id));
  return jsonb_build_object('result','ok','name',p.full_name);
end $$;

create or replace function public.assign_volunteer(_event_id uuid, _user_id uuid, _can_scan boolean, _can_view_registrations boolean, _can_view_attendance boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admins only'; end if;
  if not public.has_role(_user_id,'student') then raise exception 'Volunteers must be existing students'; end if;
  insert into public.event_staff(event_id,user_id,can_scan,can_view_registrations,can_view_attendance,assigned_by)
  values (_event_id,_user_id,_can_scan,_can_view_registrations,_can_view_attendance,auth.uid())
  on conflict (event_id,user_id) do update set can_scan=excluded.can_scan, can_view_registrations=excluded.can_view_registrations, can_view_attendance=excluded.can_view_attendance
  returning id into sid;
  insert into public.notifications(user_id,title,body,link) values (_user_id,'You are a volunteer','You were assigned to an event.','/dashboard/volunteer');
  perform public.log_audit('staff.assign','event_staff',sid,jsonb_build_object('event_id',_event_id,'user_id',_user_id));
  return sid;
end $$;

create or replace function public.remove_volunteer(_event_id uuid, _user_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admins only'; end if;
  delete from public.event_staff where event_id=_event_id and user_id=_user_id;
  perform public.log_audit('staff.remove','event_staff',null,jsonb_build_object('event_id',_event_id,'user_id',_user_id));
end $$;

create or replace function public.set_user_role(_user_id uuid, _role public.app_role, _grant boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Admins only'; end if;
  if _user_id = auth.uid() then raise exception 'Cannot change your own roles'; end if;
  if _grant then insert into public.user_roles(user_id,role) values (_user_id,_role) on conflict do nothing;
  else delete from public.user_roles where user_id=_user_id and role=_role; end if;
  perform public.log_audit(case when _grant then 'role.grant' else 'role.revoke' end,'user_roles',_user_id,jsonb_build_object('role',_role));
end $$;

create or replace function public.issue_certificates(_event_id uuid) returns integer
language plpgsql security definer set search_path = public as $$
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

create or replace function public.event_stats(_event_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.can_manage_event(_event_id) then raise exception 'Not permitted'; end if;
  return jsonb_build_object(
    'registered',(select count(*) from public.registrations where event_id=_event_id and status='registered'),
    'attended',(select count(*) from public.attendance where event_id=_event_id),
    'certificates',(select count(*) from public.certificates where event_id=_event_id),
    'avg_rating',(select round(avg(rating)::numeric,2) from public.feedback where event_id=_event_id));
end $$;

revoke execute on function public.register_for_event(uuid), public.cancel_registration(uuid), public.check_in_ticket(uuid,text),
  public.assign_volunteer(uuid,uuid,boolean,boolean,boolean), public.remove_volunteer(uuid,uuid), public.set_user_role(uuid,public.app_role,boolean),
  public.issue_certificates(uuid), public.event_stats(uuid) from public, anon;
grant execute on function public.register_for_event(uuid), public.cancel_registration(uuid), public.check_in_ticket(uuid,text),
  public.assign_volunteer(uuid,uuid,boolean,boolean,boolean), public.remove_volunteer(uuid,uuid), public.set_user_role(uuid,public.app_role,boolean),
  public.issue_certificates(uuid), public.event_stats(uuid) to authenticated;