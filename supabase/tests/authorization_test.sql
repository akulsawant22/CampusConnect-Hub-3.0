-- CampusConnect authorization rule tests.
-- Runs as one block and ALWAYS rolls back (final RAISE), so no test data is kept.
-- Expected final message: "ALL TESTS PASSED: ..." ; any failure stops with "FAIL: ...".
do $$
declare
  admin_id uuid := gen_random_uuid();
  org_id uuid := gen_random_uuid();
  org2_id uuid := gen_random_uuid();
  s1 uuid := gen_random_uuid();
  s2 uuid := gen_random_uuid();
  s3 uuid := gen_random_uuid();
  ev uuid; reg1 uuid; reg2 uuid; tok text; tok2 text; res jsonb; n int; ok boolean; passed text[] := '{}';
begin
  insert into auth.users (id, email, instance_id, aud, role) values
    (admin_id,'t-admin@test.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
    (org_id,'t-org@test.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
    (org2_id,'t-org2@test.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
    (s1,'t-s1@test.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
    (s2,'t-s2@test.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated'),
    (s3,'t-s3@test.local','00000000-0000-0000-0000-000000000000','authenticated','authenticated');
  -- signup trigger gives everyone student only
  if (select count(*) from public.user_roles where user_id in (admin_id,org_id,org2_id,s1,s2,s3) and role <> 'student') <> 0
    then raise exception 'FAIL: signup granted non-student role'; end if;
  passed := passed || 'signup_defaults_to_student'::text;
  insert into public.user_roles(user_id, role) values (admin_id,'admin'),(org_id,'organizer'),(org2_id,'organizer');
  delete from public.user_roles where user_id in (org_id, org2_id) and role = 'student'; -- pure organizers

  -- Anonymous role verification: anon read denied on profiles, registrations, tickets
  execute 'set local role anon';
  ok := false;
  begin
    if (select count(*) from public.profiles) <> 0 then raise exception 'FAIL: anon read profiles'; end if;
    if (select count(*) from public.registrations) <> 0 then raise exception 'FAIL: anon read registrations'; end if;
    if (select count(*) from public.tickets) <> 0 then raise exception 'FAIL: anon read tickets'; end if;
    ok := true;
  exception when insufficient_privilege then
    ok := true;
  end;
  execute 'reset role';
  if not ok then raise exception 'FAIL: anon access not denied'; end if;
  passed := passed || 'anon_read_denied'::text;

  -- 1. self-promotion: student calling set_user_role
  perform set_config('request.jwt.claims', json_build_object('sub',s1,'role','authenticated')::text, true);
  ok := false; begin perform public.set_user_role(s1,'admin',true); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: student promoted self via set_user_role'; end if;
  passed := passed || 'student_cannot_call_set_user_role'::text;

  -- 2. self-promotion: direct insert into user_roles as authenticated
  execute 'set local role authenticated';
  ok := false; begin insert into public.user_roles(user_id, role) values (s1,'admin'); exception when others then ok := true; end;
  ok := ok and not exists (select 1 from public.user_roles where user_id = s1 and role='admin');
  -- profile update cannot touch roles; student cannot see other users' profiles
  if (select count(*) from public.profiles where id <> s1) <> 0 then raise exception 'FAIL: student can read other profiles'; end if;
  execute 'reset role';
  if not ok then raise exception 'FAIL: direct role insert allowed'; end if;
  passed := passed || 'direct_role_insert_denied'::text || 'student_cannot_read_others_profiles'::text;

  -- 3. admin cannot change own roles; admin CAN promote others
  perform set_config('request.jwt.claims', json_build_object('sub',admin_id,'role','authenticated')::text, true);
  ok := false; begin perform public.set_user_role(admin_id,'organizer',true); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: admin changed own role'; end if;
  perform public.set_user_role(s3,'organizer',true);
  if not public.has_role(s3,'organizer') then raise exception 'FAIL: admin could not grant role'; end if;
  perform public.set_user_role(s3,'organizer',false);
  passed := passed || 'admin_cannot_self_modify'::text || 'admin_can_grant_others'::text;

  -- 4. students cannot create events (RLS)
  perform set_config('request.jwt.claims', json_build_object('sub',s1,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  ok := false;
  begin
    insert into public.events(organizer_id,title,starts_at,ends_at,registration_deadline,capacity)
    values (s1,'Hack',now()+interval '2 day',now()+interval '3 day',now()+interval '1 day',2);
  exception when others then ok := true; end;
  execute 'reset role';
  if not ok then raise exception 'FAIL: student created event'; end if;
  passed := passed || 'student_cannot_create_event'::text;

  -- organizer creates published event, capacity 2
  insert into public.events(organizer_id,title,starts_at,ends_at,registration_deadline,capacity,status)
  values (org_id,'Test Fest',now()+interval '2 day',now()+interval '3 day',now()+interval '1 day',2,'published') returning id into ev;

  -- Cross-organizer event isolation: Organizer 2 cannot update Organizer 1's event
  perform set_config('request.jwt.claims', json_build_object('sub',org2_id,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  update public.events set title = 'Hijacked' where id = ev;
  execute 'reset role';
  if (select title from public.events where id = ev) = 'Hijacked' then raise exception 'FAIL: cross-organizer edit allowed'; end if;
  passed := passed || 'cross_organizer_isolation'::text;

  -- 5. registration + duplicate protection
  perform set_config('request.jwt.claims', json_build_object('sub',s1,'role','authenticated')::text, true);
  reg1 := public.register_for_event(ev);
  ok := false; begin perform public.register_for_event(ev); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: duplicate registration allowed'; end if;
  passed := passed || 'duplicate_registration_blocked'::text;

  -- Direct table mutation denial on registrations and tickets
  perform set_config('request.jwt.claims', json_build_object('sub',s1,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  ok := false;
  begin
    insert into public.registrations(event_id, user_id) values (ev, s1);
  exception when others then
    ok := true;
  end;
  if not ok then raise exception 'FAIL: direct registration insert permitted'; end if;
  ok := false;
  begin
    insert into public.tickets(registration_id, user_id) values (reg1, s1);
  exception when others then
    ok := true;
  end;
  if not ok then raise exception 'FAIL: direct ticket insert permitted'; end if;
  execute 'reset role';
  passed := passed || 'direct_mutation_denied'::text;

  -- 6. capacity
  perform set_config('request.jwt.claims', json_build_object('sub',s2,'role','authenticated')::text, true);
  reg2 := public.register_for_event(ev);
  select token into tok2 from public.tickets where registration_id = reg2;
  perform set_config('request.jwt.claims', json_build_object('sub',s3,'role','authenticated')::text, true);
  ok := false; begin perform public.register_for_event(ev); exception when others then ok := sqlerrm like '%full%'; end;
  if not ok then raise exception 'FAIL: capacity exceeded'; end if;
  if (select count(*) from public.registrations where event_id=ev and status='registered') <> 2 then raise exception 'FAIL: wrong registration count'; end if;
  passed := passed || 'capacity_enforced'::text;

  -- Feedback submission without attendance rejection (RLS check: s2 has registered but not attended)
  perform set_config('request.jwt.claims', json_build_object('sub',s2,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  ok := false;
  begin
    insert into public.feedback(event_id, user_id, rating, comment) values (ev, s2, 5, 'Great event');
  exception when others then
    ok := true;
  end;
  execute 'reset role';
  if not ok then raise exception 'FAIL: feedback allowed without attendance'; end if;
  passed := passed || 'feedback_requires_attendance'::text;

  -- 7. deadline
  update public.events set registration_deadline = now() - interval '1 minute' where id = ev;
  ok := false; begin perform public.register_for_event(ev); exception when others then ok := sqlerrm like '%deadline%'; end;
  if not ok then raise exception 'FAIL: deadline not enforced'; end if;
  passed := passed || 'deadline_enforced'::text;

  -- 8. ticket privacy: organizer and other students cannot read s1 ticket
  select token into tok from public.tickets where registration_id = reg1;
  perform set_config('request.jwt.claims', json_build_object('sub',org_id,'role','authenticated')::text, true);
  execute 'set local role authenticated';
  n := (select count(*) from public.tickets);
  execute 'reset role';
  if n <> 0 then raise exception 'FAIL: organizer can read tickets'; end if;
  passed := passed || 'tickets_private_to_owner'::text;

  -- 9. scanning: non-staff student denied, volunteer assignment admin-only
  perform set_config('request.jwt.claims', json_build_object('sub',s3,'role','authenticated')::text, true);
  ok := false; begin perform public.check_in_ticket(ev, tok); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: non-staff scanned'; end if;
  ok := false; begin perform public.assign_volunteer(ev, s3, true, false, false); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: student self-assigned as volunteer'; end if;
  passed := passed || 'non_staff_cannot_scan'::text || 'student_cannot_self_assign_volunteer'::text;

  perform set_config('request.jwt.claims', json_build_object('sub',admin_id,'role','authenticated')::text, true);
  perform public.assign_volunteer(ev, s3, true, false, false);
  ok := false; begin perform public.assign_volunteer(ev, org_id, true, false, false); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: non-student assigned as volunteer'; end if;
  passed := passed || 'volunteer_must_be_student'::text;

  -- 10. volunteer check-in, repeated (duplicate) check-in is idempotent
  perform set_config('request.jwt.claims', json_build_object('sub',s3,'role','authenticated')::text, true);
  res := public.check_in_ticket(ev, tok);
  if res->>'result' <> 'ok' then raise exception 'FAIL: volunteer check-in %', res; end if;
  res := public.check_in_ticket(ev, tok);
  if res->>'result' <> 'duplicate' then raise exception 'FAIL: second check-in %', res; end if;
  if (select count(*) from public.attendance where registration_id = reg1) <> 1 then raise exception 'FAIL: duplicate attendance rows'; end if;
  res := public.check_in_ticket(ev, 'bogus');
  if res->>'result' <> 'invalid' then raise exception 'FAIL: bogus token %', res; end if;
  -- volunteer without registrations permission cannot list registrations; still a student
  execute 'set local role authenticated';
  n := (select count(*) from public.registrations where event_id = ev);
  execute 'reset role';
  if n <> 0 then raise exception 'FAIL: volunteer saw registrations without permission'; end if;
  if not public.has_role(s3,'student') then raise exception 'FAIL: volunteer lost student role'; end if;
  passed := passed || 'repeat_check_in_idempotent'::text || 'invalid_token_rejected'::text || 'volunteer_perms_granular'::text;

  -- 11. student cannot cancel someone else's registration
  ok := false; begin perform public.cancel_registration(reg1); exception when others then ok := true; end;
  if not ok then raise exception 'FAIL: cancelled another user registration'; end if;
  passed := passed || 'cannot_cancel_others_registration'::text;

  -- 12. Cancelled ticket check-in rejection (returns 'cancelled')
  perform set_config('request.jwt.claims', json_build_object('sub',s2,'role','authenticated')::text, true);
  perform public.cancel_registration(reg2);
  perform set_config('request.jwt.claims', json_build_object('sub',s3,'role','authenticated')::text, true);
  res := public.check_in_ticket(ev, tok2);
  if res->>'result' <> 'cancelled' then raise exception 'FAIL: cancelled ticket was not rejected with cancelled: %', res; end if;
  passed := passed || 'cancelled_ticket_rejected'::text;

  raise exception 'ALL TESTS PASSED (% tests): %', array_length(passed,1), array_to_string(passed, ', ');
end $$;