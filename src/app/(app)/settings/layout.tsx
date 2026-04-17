import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { User } from "@/lib/types/database";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) redirect("/login");

  const { data: koveUser } = await supabase
    .from("users").select("*").eq("id", authUser.id).single() as { data: User | null; error: unknown };
  if (!koveUser) redirect("/login");

  // Only owners or users with manage_users permission
  if (!koveUser.is_owner && !koveUser.computed_permissions?.manage_users) {
    redirect("/");
  }

  return <>{children}</>;
}
