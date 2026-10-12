# LION-KUP

[![Open in Bolt](https://bolt.new/static/open-in-bolt.svg)](https://bolt.new/~/sb1-xpx8rbcb)

## Supabase setup

Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the local `.env` file and in the deployment environment. Never use a service-role key in the app.

For a new Supabase project, run the migrations in `supabase/migrations` in timestamp order, skipping `20261007203433_create_evaluations_table.sql` (documentation only). Existing installations should apply any migrations not already run, including `20261012110000_add_school_accounts_and_isolation.sql` and `20261012110500_rename_schools_to_clubs.sql`.

Staff create a club or sign in and join one using its join code. The migrations assign any existing student, evaluation, and session data to an `Existing club records` club. A project administrator can retrieve its code in the Supabase SQL Editor:

```sql
SELECT name, join_code
FROM public.clubs
WHERE name = 'Existing club records';
```

Share that code only with authorized staff. Row-level security restricts student and grading records to authenticated members of their club.
