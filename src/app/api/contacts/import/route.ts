import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase.from("users").select("*").eq("id", user.id).single();
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!koveUser.is_owner && !koveUser.computed_permissions?.create_contacts) {
    return NextResponse.json({ error: "No permission to create contacts" }, { status: 403 });
  }

  const body = await request.json();
  const { rows, mapping } = body as {
    rows: Record<string, string>[];
    mapping: Record<string, string>; // csv_column -> contact_field
  };

  if (!rows?.length || !mapping) {
    return NextResponse.json({ error: "rows and mapping are required" }, { status: 400 });
  }

  const contacts = rows.map((row) => {
    const contact: Record<string, unknown> = {
      org_id: koveUser.org_id,
      assigned_to: [user.id],
      status: "new" as const,
      custom_fields: {} as Record<string, string>,
    };

    for (const [csvCol, field] of Object.entries(mapping)) {
      const val = row[csvCol]?.trim();
      if (!val) continue;

      if (["name", "phone", "email", "source", "pipeline_stage"].includes(field)) {
        contact[field] = val;
      } else if (field === "status") {
        contact.status = val.toLowerCase();
      } else if (field !== "_skip") {
        (contact.custom_fields as Record<string, string>)[field] = val;
      }
    }

    return contact;
  }).filter((c) => c.name); // name is required

  if (!contacts.length) {
    return NextResponse.json({ error: "No valid contacts found (name is required)" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert(contacts)
    .select();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: data?.length ?? 0 }, { status: 201 });
}
