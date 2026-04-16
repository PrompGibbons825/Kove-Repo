import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
    const { email, password, fullName, orgName, vertical } = await request.json();

    if (!email || !password || !fullName || !orgName) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }

    // 1. Create auth user via browser-scoped server client
    const supabase = await createClient();
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: authError?.message ?? "Signup failed" },
        { status: 400 }
      );
    }

    // 2. Use service role client to bypass RLS for org + user creation
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Create organization
    const { data: org, error: orgError } = await admin
      .from("organizations")
      .insert({ name: orgName, vertical: vertical ?? "other" })
      .select()
      .single();

    if (orgError || !org) {
      // Clean up auth user if org creation fails
      await admin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json(
        { error: orgError?.message ?? "Failed to create organization" },
        { status: 500 }
      );
    }

    // Create user record (owner)
    const { error: userError } = await admin.from("users").insert({
      id: authData.user.id,
      org_id: (org as { id: string }).id,
      email,
      full_name: fullName,
      is_owner: true,
      tag_ids: [],
    });

    if (userError) {
      await admin.auth.admin.deleteUser(authData.user.id);
      await admin.from("organizations").delete().eq("id", (org as { id: string }).id);
      return NextResponse.json({ error: userError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Signup error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
