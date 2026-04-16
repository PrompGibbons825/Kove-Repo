-- ============================================================
-- kove Database Schema — v3.2
-- PostgreSQL via Supabase with pgvector + RLS
-- ============================================================

-- Enable extensions
create extension if not exists "vector" with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;

-- ============================================================
-- ENUMS
-- ============================================================

create type contact_status as enum (
  'new', 'qualifying', 'qualified', 'closing', 'won', 'lost', 'renewal'
);

create type activity_type as enum (
  'call', 'sms', 'email', 'note', 'appointment', 'voicemail', 'meeting', 'handoff'
);

create type task_type as enum (
  'follow_up', 'appointment', 'reactivation', 'call_back', 'handoff', 'ai_action'
);

create type commission_type as enum (
  'appointment_set', 'deal_closed', 'renewal', 'upsell', 'bonus'
);

create type commission_status as enum ('pending', 'approved', 'paid');

create type workflow_status as enum ('draft', 'active', 'paused');

-- ============================================================
-- TABLES
-- ============================================================

-- Organizations
create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  vertical text not null default 'other',
  business_context jsonb not null default '{}',
  custom_field_schema jsonb not null default '[]',
  commission_rules jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Permission Tags
create table permission_tags (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  permissions jsonb not null default '{}',
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create index idx_permission_tags_org on permission_tags(org_id);

-- Users (extends Supabase auth.users)
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  email text not null unique,
  full_name text not null default '',
  is_owner boolean not null default false,
  tag_ids uuid[] not null default '{}',
  computed_permissions jsonb not null default '{}',
  individual_context jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_users_org on users(org_id);

-- Contacts
create table contacts (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  assigned_to uuid[] not null default '{}',
  name text not null,
  phone text,
  email text,
  source text,
  status contact_status not null default 'new',
  pipeline_stage text,
  last_contacted_at timestamptz,
  ai_summary text,
  handoff_notes text,
  custom_fields jsonb not null default '{}',
  embedding_text text,
  embedding extensions.vector(1536),
  created_at timestamptz not null default now()
);

create index idx_contacts_org on contacts(org_id);
create index idx_contacts_status on contacts(org_id, status);
create index idx_contacts_assigned on contacts using gin(assigned_to);
create index idx_contacts_embedding on contacts
  using ivfflat (embedding extensions.vector_cosine_ops) with (lists = 100);

-- Activities
create table activities (
  id uuid primary key default uuid_generate_v4(),
  contact_id uuid not null references contacts(id) on delete cascade,
  user_id uuid not null references users(id),
  org_id uuid not null references organizations(id) on delete cascade,
  type activity_type not null,
  content text,
  ai_summary text,
  action_items jsonb not null default '[]',
  embedding_text text,
  embedding extensions.vector(1536),
  occurred_at timestamptz not null default now()
);

create index idx_activities_contact on activities(contact_id);
create index idx_activities_user on activities(user_id);
create index idx_activities_org on activities(org_id);

-- Tasks
create table tasks (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  assigned_to uuid not null references users(id),
  type task_type not null,
  title text not null,
  description text,
  due_at timestamptz not null default now(),
  completed_at timestamptz,
  ai_generated boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_tasks_assigned on tasks(assigned_to);
create index idx_tasks_due on tasks(assigned_to, due_at) where completed_at is null;

-- Commissions
create table commissions (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references users(id),
  contact_id uuid not null references contacts(id),
  type commission_type not null,
  amount numeric not null default 0,
  status commission_status not null default 'pending',
  period text not null,
  approved_by uuid references users(id),
  created_at timestamptz not null default now()
);

create index idx_commissions_user on commissions(user_id);
create index idx_commissions_org_period on commissions(org_id, period);

-- Workflows
create table workflows (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  description text,
  python_logic text,
  trigger jsonb not null default '{}',
  status workflow_status not null default 'draft',
  created_by_ai boolean not null default false,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create index idx_workflows_org on workflows(org_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table organizations enable row level security;
alter table permission_tags enable row level security;
alter table users enable row level security;
alter table contacts enable row level security;
alter table activities enable row level security;
alter table tasks enable row level security;
alter table commissions enable row level security;
alter table workflows enable row level security;

-- Helper: get current user's row
create or replace function get_current_user_record()
returns users as $$
  select * from users where id = auth.uid()
$$ language sql security definer stable;

-- Helper: check if current user is owner
create or replace function is_org_owner()
returns boolean as $$
  select exists (
    select 1 from users
    where id = auth.uid() and is_owner = true
  )
$$ language sql security definer stable;

-- Helper: get current user's org_id
create or replace function get_user_org_id()
returns uuid as $$
  select org_id from users where id = auth.uid()
$$ language sql security definer stable;

-- Helper: check a specific permission
create or replace function has_permission(perm text)
returns boolean as $$
  select
    case
      when u.is_owner then true
      else coalesce((u.computed_permissions ->> perm)::boolean, false)
    end
  from users u where u.id = auth.uid()
$$ language sql security definer stable;

-- ---- Organizations ----
create policy "Users can view their own org"
  on organizations for select
  using (id = get_user_org_id());

create policy "Owners can update their org"
  on organizations for update
  using (id = get_user_org_id() and is_org_owner());

-- ---- Permission Tags ----
create policy "Users can view their org tags"
  on permission_tags for select
  using (org_id = get_user_org_id());

create policy "Users with manage_users can manage tags"
  on permission_tags for all
  using (org_id = get_user_org_id() and has_permission('manage_users'));

-- ---- Users ----
create policy "Users can view themselves"
  on users for select
  using (id = auth.uid());

create policy "Users can view org members"
  on users for select
  using (org_id = get_user_org_id());

create policy "Users can update themselves"
  on users for update
  using (id = auth.uid());

create policy "Owners can manage users"
  on users for all
  using (org_id = get_user_org_id() and is_org_owner());

-- CRITICAL: individual_context is private per user
-- This is enforced by only returning individual_context when id = auth.uid()
-- via a view or API layer. RLS ensures row access, column filtering at API level.

-- ---- Contacts ----
create policy "Users view contacts (scoped)"
  on contacts for select
  using (
    org_id = get_user_org_id()
    and (
      has_permission('view_all_contacts')
      or auth.uid() = any(assigned_to)
    )
  );

create policy "Users with create permission can insert"
  on contacts for insert
  with check (
    org_id = get_user_org_id()
    and has_permission('create_contacts')
  );

create policy "Users with edit permission can update"
  on contacts for update
  using (
    org_id = get_user_org_id()
    and has_permission('edit_contacts')
    and (has_permission('view_all_contacts') or auth.uid() = any(assigned_to))
  );

create policy "Users with delete permission can delete"
  on contacts for delete
  using (
    org_id = get_user_org_id()
    and has_permission('delete_contacts')
  );

-- ---- Activities ----
create policy "Users view activities (scoped)"
  on activities for select
  using (
    org_id = get_user_org_id()
    and (
      has_permission('view_all_activities')
      or user_id = auth.uid()
    )
  );

create policy "Users can create activities"
  on activities for insert
  with check (
    org_id = get_user_org_id()
    and user_id = auth.uid()
  );

-- ---- Tasks ----
create policy "Users view their own tasks"
  on tasks for select
  using (
    org_id = get_user_org_id()
    and (
      assigned_to = auth.uid()
      or has_permission('view_team_analytics')
    )
  );

create policy "Users can manage their own tasks"
  on tasks for all
  using (
    org_id = get_user_org_id()
    and assigned_to = auth.uid()
  );

-- ---- Commissions ----
create policy "Users view commissions (scoped)"
  on commissions for select
  using (
    org_id = get_user_org_id()
    and (
      has_permission('view_team_commissions')
      or user_id = auth.uid()
    )
  );

create policy "Users with approve permission can update"
  on commissions for update
  using (
    org_id = get_user_org_id()
    and has_permission('approve_commissions')
  );

-- ---- Workflows ----
create policy "Users can view org workflows"
  on workflows for select
  using (org_id = get_user_org_id());

create policy "Users with create_workflows can manage"
  on workflows for all
  using (
    org_id = get_user_org_id()
    and has_permission('create_workflows')
  );

-- ============================================================
-- FUNCTIONS: Recompute permissions on tag change
-- ============================================================

create or replace function recompute_user_permissions()
returns trigger as $$
declare
  tag_row permission_tags;
  merged jsonb := '{}';
  perm_key text;
begin
  -- Union all permissions from assigned tags
  for tag_row in
    select * from permission_tags where id = any(new.tag_ids)
  loop
    for perm_key in select jsonb_object_keys(tag_row.permissions) loop
      if (tag_row.permissions ->> perm_key)::boolean then
        merged := jsonb_set(merged, array[perm_key], 'true'::jsonb);
      elsif not (merged ? perm_key) then
        merged := jsonb_set(merged, array[perm_key], 'false'::jsonb);
      end if;
    end loop;
  end loop;

  new.computed_permissions := merged;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_recompute_permissions
  before insert or update of tag_ids on users
  for each row execute function recompute_user_permissions();

-- ============================================================
-- FUNCTION: Vector similarity search (used by AI agent)
-- ============================================================

create or replace function match_contacts(
  query_embedding extensions.vector(1536),
  match_threshold float default 0.7,
  match_count int default 5,
  filter_org_id uuid default null
)
returns table (
  id uuid,
  name text,
  status contact_status,
  ai_summary text,
  embedding_text text,
  similarity float
) as $$
  select
    c.id,
    c.name,
    c.status,
    c.ai_summary,
    c.embedding_text,
    1 - (c.embedding <=> query_embedding) as similarity
  from contacts c
  where
    c.org_id = coalesce(filter_org_id, get_user_org_id())
    and 1 - (c.embedding <=> query_embedding) > match_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$ language sql security definer;

create or replace function match_activities(
  query_embedding extensions.vector(1536),
  match_threshold float default 0.7,
  match_count int default 5,
  filter_org_id uuid default null
)
returns table (
  id uuid,
  contact_id uuid,
  type activity_type,
  ai_summary text,
  embedding_text text,
  similarity float
) as $$
  select
    a.id,
    a.contact_id,
    a.type,
    a.ai_summary,
    a.embedding_text,
    1 - (a.embedding <=> query_embedding) as similarity
  from activities a
  where
    a.org_id = coalesce(filter_org_id, get_user_org_id())
    and 1 - (a.embedding <=> query_embedding) > match_threshold
  order by a.embedding <=> query_embedding
  limit match_count;
$$ language sql security definer;
