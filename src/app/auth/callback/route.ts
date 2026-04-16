import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`);
  }

  const supabase = await createClient();
  const { data: session, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !session.user) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  // Check if this user already has a kove profile
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: existingUser } = await admin
    .from("users")
    .select("id")
    .eq("id", session.user.id)
    .single();

  if (!existingUser) {
    // First-time Google sign-in: create org + user
    const fullName =
      session.user.user_metadata?.full_name ??
      session.user.user_metadata?.name ??
      session.user.email?.split("@")[0] ??
      "User";

    const { data: org } = await admin
      .from("organizations")
      .insert({ name: `${fullName}'s Team`, vertical: "other" })
      .select()
      .single();

    if (org) {
      await admin.from("users").insert({
        id: session.user.id,
        org_id: (org as { id: string }).id,
        email: session.user.email!,
        full_name: fullName,
        is_owner: true,
        tag_ids: [],
      });
    }
  }

  return NextResponse.redirect(`${origin}/`);
}
