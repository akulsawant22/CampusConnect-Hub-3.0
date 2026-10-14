create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = _user_id and ur.role = _role
      and (
        _user_id = auth.uid()
        or exists (select 1 from public.user_roles a where a.user_id = auth.uid() and a.role = 'admin')
      )
  )
$$;
revoke execute on function public.has_role(uuid, public.app_role) from public, anon;
revoke execute on function public.can_manage_event(uuid) from public, anon;
revoke execute on function public.can_view_profile(uuid) from public, anon;
revoke execute on function public.staff_perm(uuid, text) from public, anon;
revoke execute on function public.cover_event_id(text) from public, anon;
grant execute on function public.has_role(uuid, public.app_role) to authenticated, service_role;
grant execute on function public.can_manage_event(uuid) to authenticated, service_role;
grant execute on function public.can_view_profile(uuid) to authenticated, service_role;
grant execute on function public.staff_perm(uuid, text) to authenticated, service_role;
grant execute on function public.cover_event_id(text) to authenticated, service_role;