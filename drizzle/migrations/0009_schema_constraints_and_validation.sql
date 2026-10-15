-- Migration 0009: Schema Constraints, Invariants & Validation

-- 1. Events Constraints: capacity > 0, ends_at > starts_at, registration_deadline <= starts_at
alter table public.events drop constraint if exists events_capacity_check;
alter table public.events add constraint events_capacity_check check (capacity > 0 and capacity <= 100000);

alter table public.events drop constraint if exists events_ends_after_starts;
alter table public.events add constraint events_ends_after_starts check (ends_at > starts_at);

-- Drop legacy/anonymous deadline checks if present and enforce deadline <= starts_at
alter table public.events drop constraint if exists events_check;
alter table public.events drop constraint if exists events_check1;
alter table public.events drop constraint if exists events_check2;
alter table public.events drop constraint if exists events_registration_deadline_check;
alter table public.events drop constraint if exists events_registration_deadline_before_start;
alter table public.events add constraint events_registration_deadline_before_start check (registration_deadline <= starts_at);

-- 2. Feedback Constraints: rating between 1 and 5
alter table public.feedback drop constraint if exists feedback_rating_check;
alter table public.feedback drop constraint if exists feedback_rating_range;
alter table public.feedback add constraint feedback_rating_range check (rating >= 1 and rating <= 5);

-- 3. Invariant Guard Trigger: Prevent reducing capacity below active registered attendees
create or replace function public.events_guard() returns trigger language plpgsql set search_path = public as $$
declare
  active_registrations_count int;
begin
  if tg_op = 'UPDATE' and new.organizer_id <> old.organizer_id and not public.has_role(auth.uid(),'admin') then
    raise exception 'Cannot change event organizer';
  end if;

  if tg_op = 'UPDATE' and new.capacity < old.capacity then
    select count(*) into active_registrations_count
    from public.registrations
    where event_id = new.id and status = 'registered';

    if new.capacity < active_registrations_count then
      raise exception 'Cannot reduce capacity to %: event has % active registrations', new.capacity, active_registrations_count;
    end if;
  end if;

  if new.status = 'published' and (tg_op = 'INSERT' or old.status <> 'published') then
    new.published_at = now();
  end if;
  return new;
end $$;

drop trigger if exists trg_events_guard on public.events;
create trigger trg_events_guard before insert or update on public.events for each row execute function public.events_guard();

-- 4. Compound Indexes and Missing Foreign-Key Lookup Indexes
create index if not exists idx_feedback_user_id on public.feedback(user_id);
create index if not exists idx_certificates_event_id on public.certificates(event_id);
create index if not exists idx_events_category_status on public.events(category, status);
create index if not exists idx_events_registration_deadline on public.events(registration_deadline);
