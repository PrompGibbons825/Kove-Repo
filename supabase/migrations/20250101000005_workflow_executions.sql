-- ============================================================
-- Migration 005: Workflow execution engine
-- ============================================================

-- Execution log
create table if not exists workflow_executions (
  id uuid primary key default extensions.uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  workflow_id uuid not null references workflows(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  trigger_type text not null,
  status text not null default 'running', -- running | completed | failed
  steps jsonb not null default '[]',      -- [{nodeId, type, status, result, startedAt, finishedAt}]
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_wf_exec_org on workflow_executions(org_id);
create index idx_wf_exec_workflow on workflow_executions(workflow_id);
create index idx_wf_exec_contact on workflow_executions(contact_id);

alter table workflow_executions enable row level security;

create policy "Users can view org executions"
  on workflow_executions for select
  using (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Auto-cleanup: keep only 90 days of executions (run via pg_cron externally)
-- SELECT cron.schedule('cleanup-workflow-executions', '0 3 * * *',
--   $$DELETE FROM workflow_executions WHERE created_at < now() - interval '90 days'$$
-- );
