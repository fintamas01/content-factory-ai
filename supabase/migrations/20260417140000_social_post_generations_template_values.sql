-- Allow arbitrary template field values alongside legacy fixed columns.

alter table public.social_post_generations
  add column if not exists template_id text;

alter table public.social_post_generations
  add column if not exists values jsonb not null default '{}'::jsonb;

alter table public.social_post_generations
  alter column headline drop not null;

alter table public.social_post_generations
  alter column subheadline drop not null;

alter table public.social_post_generations
  alter column body drop not null;

alter table public.social_post_generations
  alter column image_top drop not null;

alter table public.social_post_generations
  alter column image_middle drop not null;

alter table public.social_post_generations
  alter column image_bottom drop not null;

comment on column public.social_post_generations.template_id is 'Registry template id (e.g. triple-image-story).';
comment on column public.social_post_generations.values is 'Submitted field values as JSON for any template shape.';
