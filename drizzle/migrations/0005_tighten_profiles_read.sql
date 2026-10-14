create or replace function public.can_view_profile(_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.registrations r
    where r.user_id = _profile_id
      and (public.can_manage_event(r.event_id)
           or public.staff_perm(r.event_id,'registrations')
           or public.staff_perm(r.event_id,'attendance')))
$$;
drop policy if exists "profiles self read" on public.profiles;
create policy "profiles self read" on public.profiles for select to authenticated
using (id = auth.uid() or public.has_role(auth.uid(),'admin') or public.can_view_profile(id));