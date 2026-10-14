create or replace function public.cover_event_id(_name text) returns uuid
language plpgsql immutable set search_path = public as $$
begin
  return split_part(_name, '/', 1)::uuid;
exception when others then return null;
end $$;

create policy "covers read visible events" on storage.objects for select to authenticated
using (bucket_id = 'event-covers' and exists (select 1 from public.events e where e.id = public.cover_event_id(name)));

create policy "covers insert by manager" on storage.objects for insert to authenticated
with check (bucket_id = 'event-covers' and public.can_manage_event(public.cover_event_id(name))
  and lower(storage.extension(name)) in ('jpg','jpeg','png','webp'));

create policy "covers update by manager" on storage.objects for update to authenticated
using (bucket_id = 'event-covers' and public.can_manage_event(public.cover_event_id(name)))
with check (bucket_id = 'event-covers' and public.can_manage_event(public.cover_event_id(name)));

create policy "covers delete by manager" on storage.objects for delete to authenticated
using (bucket_id = 'event-covers' and public.can_manage_event(public.cover_event_id(name)));