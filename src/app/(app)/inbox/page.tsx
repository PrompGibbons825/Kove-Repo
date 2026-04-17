import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import InboxPage from "@/components/inbox/inbox-page";

export default async function Inbox() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: koveUser } = await supabase
    .from("users").select("*").eq("id", user.id).single();
  if (!koveUser) redirect("/login");

  return <InboxPage user={koveUser} />;
}
