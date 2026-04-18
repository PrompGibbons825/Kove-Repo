// ============================================================
// kove Database Types — generated from schema design
// These map 1:1 to Supabase tables + RLS policies
// ============================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// --------------- Permission System ---------------

export interface PermissionSet {
  // Data access
  view_all_contacts: boolean;
  view_all_activities: boolean;
  view_team_commissions: boolean;
  view_team_analytics: boolean;
  view_business_analytics: boolean;
  // Actions
  create_contacts: boolean;
  edit_contacts: boolean;
  delete_contacts: boolean;
  assign_contacts: boolean;
  approve_commissions: boolean;
  create_workflows: boolean;
  manage_users: boolean;
  configure_commissions: boolean;
  access_billing: boolean;
  // AI scope
  ai_team_context: boolean;
  ai_business_context: boolean;
}

export const EMPTY_PERMISSIONS: PermissionSet = {
  view_all_contacts: false,
  view_all_activities: false,
  view_team_commissions: false,
  view_team_analytics: false,
  view_business_analytics: false,
  create_contacts: false,
  edit_contacts: false,
  delete_contacts: false,
  assign_contacts: false,
  approve_commissions: false,
  create_workflows: false,
  manage_users: false,
  configure_commissions: false,
  access_billing: false,
  ai_team_context: false,
  ai_business_context: false,
};

export const OWNER_PERMISSIONS: PermissionSet = {
  view_all_contacts: true,
  view_all_activities: true,
  view_team_commissions: true,
  view_team_analytics: true,
  view_business_analytics: true,
  create_contacts: true,
  edit_contacts: true,
  delete_contacts: true,
  assign_contacts: true,
  approve_commissions: true,
  create_workflows: true,
  manage_users: true,
  configure_commissions: true,
  access_billing: true,
  ai_team_context: true,
  ai_business_context: true,
};

// --------------- Enums ---------------

export type ContactStatus =
  | "new"
  | "qualifying"
  | "qualified"
  | "closing"
  | "won"
  | "lost"
  | "renewal";

export type ActivityType =
  | "call"
  | "sms"
  | "email"
  | "note"
  | "appointment"
  | "voicemail"
  | "meeting"
  | "handoff";

export type TaskType =
  | "follow_up"
  | "appointment"
  | "reactivation"
  | "call_back"
  | "handoff"
  | "ai_action";

export type CommissionType =
  | "appointment_set"
  | "deal_closed"
  | "renewal"
  | "upsell"
  | "bonus";

export type CommissionStatus = "pending" | "approved" | "paid";

export type WorkflowStatus = "draft" | "active" | "paused";

export type CustomFieldType = "text" | "number" | "boolean" | "select" | "address" | "checklist";

export interface CustomFieldDef {
  id: string;
  label: string;
  type: CustomFieldType;
  options?: string[]; // for select type
  items?: string[];   // for checklist type — default items
  required?: boolean;
}

// --------------- Table Row Types ---------------

export interface Organization {
  id: string;
  name: string;
  vertical: string;
  business_context: Json;
  custom_field_schema: CustomFieldDef[];
  source_options: string[];
  pipeline_options: string[];
  commission_rules: Json;
  telnyx_phone: string | null;
  telnyx_connection_id: string | null;
  telnyx_messaging_profile_id: string | null;
  smtp_config: SmtpConfig | null;
  brand_assets: Array<{ type: string; url: string; name: string }>;
  created_at: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from_name: string;
  from_email: string;
}

export interface PermissionTag {
  id: string;
  org_id: string;
  name: string;
  permissions: PermissionSet;
  created_by: string;
  created_at: string;
}

export interface User {
  id: string;
  org_id: string;
  email: string;
  full_name: string;
  is_owner: boolean;
  tag_ids: string[];
  computed_permissions: PermissionSet;
  individual_context: Json;
  telnyx_credential_id: string | null;
  created_at: string;
}

export interface Contact {
  id: string;
  org_id: string;
  assigned_to: string[];
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: ContactStatus;
  pipeline_stage: string | null;
  workflow_id: string | null;
  last_contacted_at: string | null;
  ai_summary: string | null;
  handoff_notes: string | null;
  custom_fields: Json;
  embedding_text: string | null;
  created_at: string;
}

export interface Activity {
  id: string;
  contact_id: string;
  user_id: string;
  org_id: string;
  type: ActivityType;
  content: string | null;
  ai_summary: string | null;
  action_items: Json;
  direction: "inbound" | "outbound";
  duration_seconds: number | null;
  recording_url: string | null;
  transcript: string | null;
  metadata: Json;
  occurred_at: string;
}

export interface Task {
  id: string;
  org_id: string;
  contact_id: string | null;
  assigned_to: string;
  type: TaskType;
  title: string;
  description: string | null;
  due_at: string;
  completed_at: string | null;
  ai_generated: boolean;
  created_at: string;
}

export interface Commission {
  id: string;
  org_id: string;
  user_id: string;
  contact_id: string;
  type: CommissionType;
  amount: number;
  status: CommissionStatus;
  period: string;
  approved_by: string | null;
  created_at: string;
}

export interface Workflow {
  id: string;
  org_id: string;
  name: string;
  description: string | null;
  python_logic: string | null;
  trigger: Json;
  status: WorkflowStatus;
  created_by_ai: boolean;
  created_by: string;
  created_at: string;
}

// --------------- Supabase Database Interface ---------------

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: Organization;
        Insert: Omit<Organization, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Organization, "id">>;
      };
      permission_tags: {
        Row: PermissionTag;
        Insert: Omit<PermissionTag, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<PermissionTag, "id">>;
      };
      users: {
        Row: User;
        Insert: Omit<User, "id" | "created_at" | "computed_permissions"> & {
          id?: string;
          created_at?: string;
          computed_permissions?: PermissionSet;
        };
        Update: Partial<Omit<User, "id">>;
      };
      contacts: {
        Row: Contact;
        Insert: Omit<Contact, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Contact, "id">>;
      };
      activities: {
        Row: Activity;
        Insert: Omit<Activity, "id"> & { id?: string };
        Update: Partial<Omit<Activity, "id">>;
      };
      tasks: {
        Row: Task;
        Insert: Omit<Task, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Task, "id">>;
      };
      commissions: {
        Row: Commission;
        Insert: Omit<Commission, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Commission, "id">>;
      };
      workflows: {
        Row: Workflow;
        Insert: Omit<Workflow, "id" | "created_at"> & {
          id?: string;
          created_at?: string;
        };
        Update: Partial<Omit<Workflow, "id">>;
      };
    };
  };
}
