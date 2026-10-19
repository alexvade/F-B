-- Moves the 15-minute "tick" call (birthdays + checklist-finish reminders,
-- see src/app/api/cron/tick/route.ts) off GitHub Actions' `schedule` trigger
-- and onto Supabase's own pg_cron + pg_net, which runs inside this database
-- and isn't subject to GitHub's well-documented throttling/dropping of
-- frequent scheduled workflows (confirmed in production: real gaps of
-- 2-7 hours between runs of a job configured for every 15 minutes, which
-- is why a checklist reminder due in a specific 30-minute window was
-- silently missed).
--
-- IMPORTANT — before running this in the Supabase SQL editor, replace
-- REPLACE_WITH_YOUR_CRON_SECRET below with the real value of the
-- CRON_SECRET environment variable (Vercel → Settings → Environment
-- Variables). Never commit the real secret back into this file.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'team-ops-tick',
  '*/15 * * * *',
  $$
  select net.http_get(
    url := 'https://www.team-ops.co.uk/api/cron/tick',
    headers := jsonb_build_object('Authorization', 'Bearer REPLACE_WITH_YOUR_CRON_SECRET')
  );
  $$
);

-- To check it's scheduled: select * from cron.job;
-- To see recent run results: select * from cron.job_run_details order by start_time desc limit 20;
-- To remove it again: select cron.unschedule('team-ops-tick');
