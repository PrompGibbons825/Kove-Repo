import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import type { User, Organization } from "@/lib/types/database";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) redirect("/login");

  const { data: koveUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", authUser.id)
    .single() as { data: User | null; error: unknown };

  if (!koveUser) redirect("/login");

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", koveUser.org_id)
    .single() as { data: Organization | null; error: unknown };

  if (!org) redirect("/login");

  return (
    <AppShell user={koveUser} org={org}>
      {children}
    </AppShell>
  );
}
