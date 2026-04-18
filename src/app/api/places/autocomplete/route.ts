import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!q || q.trim().length < 3) {
    return NextResponse.json({ predictions: [] });
  }

  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return NextResponse.json({ predictions: [], error: "no_key" }, { status: 200 });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(q)}&types=address&key=${key}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.error("Places API error:", data.status, data.error_message);
      return NextResponse.json({ predictions: [], error: data.status }, { status: 200 });
    }

    return NextResponse.json({ predictions: data.predictions ?? [] });
  } catch (err) {
    console.error("Places proxy error:", err);
    return NextResponse.json({ predictions: [], error: "fetch_failed" }, { status: 200 });
  }
}
