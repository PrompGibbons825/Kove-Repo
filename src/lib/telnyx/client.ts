// ============================================================
// Telnyx helper — kove master account manages all org numbers
// ============================================================

const TELNYX_API = "https://api.telnyx.com/v2";

function headers() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
  };
}

/**
 * Search for available phone numbers by area code.
 */
export async function searchNumbers(areaCode?: string, limit = 5) {
  const params = new URLSearchParams({
    "filter[country_code]": "US",
    "filter[features]": "sms,voice",
    "filter[limit]": String(limit),
  });
  if (areaCode) params.set("filter[national_destination_code]", areaCode);

  const res = await fetch(`${TELNYX_API}/available_phone_numbers?${params}`, {
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Telnyx search failed: ${res.statusText}`);
  const data = await res.json();
  return data.data as { phone_number: string; region_information: unknown[] }[];
}

/**
 * Purchase a phone number and assign it to the kove connection.
 * Auto-creates a credential connection if TELNYX_CONNECTION_ID is not set.
 */
export async function ensureConnection(): Promise<string> {
  const existing = process.env.TELNYX_CONNECTION_ID;
  if (existing) return existing;

  // Auto-create a credential connection named "kove"
  const res = await fetch(`${TELNYX_API}/credential_connections`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      connection_name: "kove",
      webhook_event_url: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://kove-seven.vercel.app"}/api/comms/call/webhook`,
      webhook_event_failover_url: "",
      active: true,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Telnyx connection creation failed: ${err.errors?.[0]?.detail ?? res.statusText}`);
  }
  const conn = (await res.json()).data;
  // NOTE: persist this ID to your env for future calls
  return conn.id as string;
}

/**
 * Ensure a Telnyx credential connection exists.
 * If TELNYX_CONNECTION_ID is set, returns it directly.
 * Otherwise auto-creates one named "kove" via the API.
 */
export async function ensureConnection(): Promise<string> {
  const existing = process.env.TELNYX_CONNECTION_ID;
  if (existing) return existing;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://trykove.app";
  const res = await fetch(`${TELNYX_API}/credential_connections`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      connection_name: "kove",
      webhook_event_url: `${appUrl}/api/comms/call/webhook`,
      active: true,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Telnyx connection creation failed: ${err.errors?.[0]?.detail ?? res.statusText}`);
  }
  return ((await res.json()).data.id) as string;
}

/**
 * Purchase a phone number and assign it to the kove connection.
 */
export async function purchaseNumber(phoneNumber: string) {
  const connectionId = process.env.TELNYX_CONNECTION_ID;
  const res = await fetch(`${TELNYX_API}/number_orders`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      phone_numbers: [{ phone_number: phoneNumber }],
      connection_id: connectionId,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Telnyx purchase failed: ${err.errors?.[0]?.detail ?? res.statusText}`);
  }
  return (await res.json()).data;
}

/**
 * Generate a WebRTC credential token for browser-based calling.
 * Uses the Telnyx TeXML / WebRTC credential approach.
 */
export async function generateWebRTCToken(connectionId: string) {
  const res = await fetch(`${TELNYX_API}/telephony_credentials`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      connection_id: connectionId,
      name: `kove-webrtc-${Date.now()}`,
    }),
  });
  if (!res.ok) throw new Error(`Telnyx credential creation failed: ${res.statusText}`);
  const credential = (await res.json()).data;

  // Now generate a short-lived token from the credential
  const tokenRes = await fetch(
    `${TELNYX_API}/telephony_credentials/${credential.id}/token`,
    { method: "POST", headers: headers() }
  );
  if (!tokenRes.ok) throw new Error(`Telnyx token generation failed: ${tokenRes.statusText}`);
  return (await tokenRes.text()); // returns raw JWT string
}

/**
 * Send an SMS via Telnyx.
 */
export async function sendSMS(from: string, to: string, text: string) {
  const res = await fetch(`${TELNYX_API}/messages`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      from,
      to,
      text,
      type: "SMS",
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Telnyx SMS failed: ${err.errors?.[0]?.detail ?? res.statusText}`);
  }
  return (await res.json()).data;
}
