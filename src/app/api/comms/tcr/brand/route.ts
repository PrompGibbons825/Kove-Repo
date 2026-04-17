import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const TELNYX_API = "https://api.telnyx.com/v2";

/**
 * POST /api/comms/tcr/brand
 * Submits a brand registration to Telnyx TCR.
 * Body: {
 *   entityType, displayName, companyName, ein, phone,
 *   street, city, state, postalCode, country, email, vertical, website?
 * }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase.from("users").select("org_id").eq("id", user.id).single();
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await request.json();
  const {
    entityType, displayName, companyName, ein, phone,
    street, city, state, postalCode, country = "US", email, vertical, website,
  } = body;

  if (!entityType || !displayName || !companyName || !ein || !phone || !street || !city || !state || !postalCode || !email || !vertical) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    entityType, displayName, companyName, ein, phone, street, city,
    state, postalCode, country, email, vertical,
  };
  if (website) payload.website = website;

  const res = await fetch(`${TELNYX_API}/brand_registrations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();

  if (!res.ok) {
    const detail = json?.errors?.[0]?.detail ?? json?.message ?? "Telnyx brand registration failed";
    return NextResponse.json({ error: detail, telnyx: json }, { status: res.status });
  }

  const brandId: string = json?.data?.brandId ?? json?.data?.id;
  const brandStatus: string = json?.data?.status ?? json?.data?.brandStatus ?? "PENDING";

  // Persist to org
  await supabase
    .from("organizations")
    .update({ tcr_brand_id: brandId, tcr_brand_status: brandStatus })
    .eq("id", koveUser.org_id);

  return NextResponse.json({ brand_id: brandId, brand_status: brandStatus, telnyx: json });
}
