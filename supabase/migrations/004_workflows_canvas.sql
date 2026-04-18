-- ============================================================
-- Migration 004: Add canvas columns to workflows table
-- ============================================================

-- Add nodes + edges for the canvas builder
alter table workflows
  add column if not exists nodes jsonb not null default '[]',
  add column if not exists edges jsonb not null default '[]',
  add column if not exists updated_at timestamptz not null default now();

-- Keep updated_at fresh automatically
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger workflows_updated_at
  before update on workflows
  for each row execute procedure touch_updated_at();

-- Allow org members to insert their own workflows (was missing from original policies)
create policy "Users can insert workflows for their org"
  on workflows for insert
  with check (
    org_id = (select org_id from users where id = auth.uid())
  );

-- Allow org members to update/delete their own org's workflows
create policy "Users can update org workflows"
  on workflows for update
  using (
    org_id = (select org_id from users where id = auth.uid())
  );

create policy "Users can delete org workflows"
  on workflows for delete
  using (
    org_id = (select org_id from users where id = auth.uid())
  );
