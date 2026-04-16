import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let email: string;
    let password: string;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      email = body.email;
      password = body.password;
    } else {
      // Native form submission (pre-hydration fallback)
      const formData = await request.formData();
      email = formData.get("email") as string;
      password = formData.get("password") as string;
    }

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (contentType.includes("application/json")) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }
      // Redirect back to login with error for native form
      return NextResponse.redirect(new URL("/login?error=" + encodeURIComponent(error.message), request.url));
    }

    if (contentType.includes("application/json")) {
      return NextResponse.json({ success: true });
    }
    // Redirect to home for native form
    return NextResponse.redirect(new URL("/", request.url));
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
