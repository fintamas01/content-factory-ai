-- Weekly AI Growth Report: opt-in + send deduplication (per user + workspace).

alter table public.user_notification_settings
  add column if not exists weekly_growth_report_enabled boolean not null default true;

alter table public.user_notification_settings
  add column if not exists last_weekly_growth_report_sent_at timestamptz null;

comment on column public.user_notification_settings.weekly_growth_report_enabled is
  'When true and email_enabled, user may receive the weekly AI Growth Report for this workspace.';

comment on column public.user_notification_settings.last_weekly_growth_report_sent_at is
  'Last time the weekly growth email was sent for this user+client (cron deduplication).';
