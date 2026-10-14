drop policy "events read" on public.events;
create policy "events read" on public.events for select to authenticated using (
  status in ('published','completed') or public.can_manage_event(id)
  or exists (select 1 from public.event_staff s where s.event_id = events.id and s.user_id = auth.uid()));