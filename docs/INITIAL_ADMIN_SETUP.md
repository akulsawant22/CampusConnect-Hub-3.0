# Initial administrator setup

CampusConnect intentionally has no public way for a user to promote themselves to administrator. Provision the first administrator only through a trusted database session after verifying the account.

## 1. Verify the intended account

Open the SQL editor for the correct Supabase project and run this preview query. Replace the placeholder with the exact, already-registered email address.

```sql
select u.id, u.email, u.email_confirmed_at, u.created_at
from auth.users u
where lower(u.email) = lower('REPLACE_WITH_ADMIN_EMAIL@example.edu');
```

Proceed only when the result contains exactly one row and the email and user ID match the account you intend to authorize. Require a confirmed email.

## 2. Grant the role

After verifying the result above, run:

```sql
insert into public.user_roles (user_id, role)
select u.id, 'admin'::public.app_role
from auth.users u
where lower(u.email) = lower('REPLACE_WITH_ADMIN_EMAIL@example.edu')
  and u.email_confirmed_at is not null
on conflict (user_id, role) do nothing;
```

## 3. Verify and refresh the session

```sql
select ur.user_id, ur.role
from public.user_roles ur
where ur.role = 'admin';
```

The administrator should sign out and sign back in so the application reloads the assigned roles.

## Safety rules

- Use a placeholder in repository documentation; never commit a real email, user ID, database URL, or credential.
- Run queries only against the intended project after double-checking its identity.
- The account retains its existing student role. This is expected.
- Do not add an in-app role selector or allow users to grant themselves permissions.
- Further role administration should follow the existing database authorization rules and audit requirements.
