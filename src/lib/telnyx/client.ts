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
 * Ensure a Telnyx credential connection exists for voice/WebRTC.
 * If TELNYX_CONNECTION_ID is set, updates its webhook URL and returns it.
 * Otherwise auto-creates a credential connection named "kove".
 */
export async function ensureConnection(): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://trykove.app";
  const webhookUrl = `${appUrl}/api/comms/call/webhook`;

  const existing = process.env.TELNYX_CONNECTION_ID;
  if (existing) {
    // Always keep the webhook URL current
    await fetch(`${TELNYX_API}/credential_connections/${existing}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ webhook_event_url: webhookUrl }),
    });
    return existing;
  }

  const res = await fetch(`${TELNYX_API}/credential_connections`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      connection_name: "kove",
      webhook_event_url: webhookUrl,
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
 * Ensure a Telnyx messaging profile exists for SMS.
 * Telnyx separates voice (credential connection) from SMS (messaging profile).
 * The SMS webhook is configured here, NOT on the credential connection.
 *
 * Pass an existing messaging profile ID to update its webhook URL,
 * or omit to create a new profile.
 */
export async function ensureMessagingProfile(existingId?: string | null): Promise<string> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://trykove.app";
  const webhookUrl = `${appUrl}/api/comms/sms/webhook`;

  if (existingId) {
    // Update webhook URL on the existing profile
    await fetch(`${TELNYX_API}/messaging_profiles/${existingId}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ webhook_url: webhookUrl }),
    });
    return existingId;
  }

  // Create a new messaging profile
  const res = await fetch(`${TELNYX_API}/messaging_profiles`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      name: "kove",
      webhook_url: webhookUrl,
      enabled: true,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Telnyx messaging profile creation failed: ${err.errors?.[0]?.detail ?? res.statusText}`);
  }
  return ((await res.json()).data.id) as string;
}

/**
 * Purchase a phone number and assign it to the kove connection (voice)
 * and messaging profile (SMS). Both must be configured for a fully
 * functional number.
 */
export async function purchaseNumber(
  phoneNumber: string,
  connectionId: string,
  messagingProfileId: string
) {
  const res = await fetch(`${TELNYX_API}/number_orders`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      phone_numbers: [{ phone_number: phoneNumber }],
      connection_id: connectionId,
      messaging_profile_id: messagingProfileId,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Telnyx purchase failed: ${err.errors?.[0]?.detail ?? res.statusText}`);
  }
  return (await res.json()).data;
}

/**
 * Ensure a telephony credential exists for a user (for WebRTC calling).
 * Creates one if credentialId is not provided, otherwise returns the existing ID.
 * Store the returned ID in the user's record and reuse it on subsequent calls.
 */
export async function ensureTelephonyCredential(
  connectionId: string,
  userId: string,
  existingCredentialId?: string | null
): Promise<string> {
  if (existingCredentialId) return existingCredentialId;

  const res = await fetch(`${TELNYX_API}/telephony_credentials`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      connection_id: connectionId,
      name: `kove-user-${userId}`,
    }),
  });
  if (!res.ok) throw new Error(`Telnyx credential creation failed: ${res.statusText}`);
  return ((await res.json()).data.id) as string;
}

/**
 * Generate a short-lived WebRTC token from an existing telephony credential.
 * The credential ID should be persisted per-user (see ensureTelephonyCredential).
 */
export async function generateWebRTCToken(credentialId: string) {
  const tokenRes = await fetch(
    `${TELNYX_API}/telephony_credentials/${credentialId}/token`,
    { method: "POST", headers: headers() }
  );
  if (!tokenRes.ok) throw new Error(`Telnyx token generation failed: ${tokenRes.statusText}`);
  return tokenRes.text(); // returns raw JWT string
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
