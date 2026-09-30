import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function getAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase server settings are missing.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Use POST." });

  const authorization = request.headers.get("Authorization") ?? "";
  const jwt = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!jwt) return json(401, { error: "Sign in to manage this MT5 connection." });

  try {
    const supabase = getAdmin();
    const { data: userData, error: authError } = await supabase.auth.getUser(jwt);
    const user = userData.user;
    if (authError || !user) return json(401, { error: "Your session is invalid or expired." });

    const payload = await request.json().catch(() => null);
    if (!payload || !["create", "rotate", "revoke"].includes(payload.action)) {
      return json(400, { error: "Choose create, rotate, or revoke." });
    }

    if (payload.action === "create") {
      const accountId = typeof payload.account_id === "string" ? payload.account_id : "";
      const label = typeof payload.label === "string" ? payload.label.trim().slice(0, 60) : "MetaTrader 5";
      if (!accountId || !label) return json(400, { error: "Choose a Sultan trading account and connection name." });
      const { data: account, error: accountError } = await supabase.from("trading_accounts")
        .select("id").eq("id", accountId).eq("user_id", user.id).maybeSingle();
      if (accountError || !account) return json(404, { error: "That trading account was not found." });

      const { data: connection, error: createError } = await supabase.from("mt5_connections")
        .insert({ user_id: user.id, account_id: accountId, label }).select("id,user_id,account_id,label,broker_server,last_sync_at,created_at,revoked_at").single();
      if (createError || !connection) return json(500, { error: "Could not create the MT5 connection." });

      const token = randomToken();
      const { error: secretError } = await supabase.from("mt5_connection_secrets")
        .insert({ connection_id: connection.id, user_id: user.id, token_hash: await tokenHash(token) });
      if (secretError) {
        await supabase.from("mt5_connections").delete().eq("id", connection.id).eq("user_id", user.id);
        return json(500, { error: "Could not securely prepare the connection key." });
      }
      return json(201, { connection, token });
    }

    const connectionId = typeof payload.connection_id === "string" ? payload.connection_id : "";
    if (!connectionId) return json(400, { error: "A connection id is required." });
    const { data: connection, error: connectionError } = await supabase.from("mt5_connections")
      .select("id,user_id,account_id,label,broker_server,last_sync_at,created_at,revoked_at")
      .eq("id", connectionId).eq("user_id", user.id).maybeSingle();
    if (connectionError || !connection) return json(404, { error: "MT5 connection not found." });

    if (payload.action === "revoke") {
      const { error: revokeError } = await supabase.from("mt5_connections")
        .update({ revoked_at: new Date().toISOString() }).eq("id", connectionId).eq("user_id", user.id);
      if (revokeError) return json(500, { error: "Could not revoke this connection." });
      const { error: secretError } = await supabase.from("mt5_connection_secrets").delete().eq("connection_id", connectionId).eq("user_id", user.id);
      if (secretError) return json(500, { error: "Connection was disabled, but its key record could not be removed." });
      return json(200, { ok: true });
    }

    const token = randomToken();
    const { error: rotateError } = await supabase.from("mt5_connection_secrets")
      .upsert({ connection_id: connectionId, user_id: user.id, token_hash: await tokenHash(token) }, { onConflict: "connection_id" });
    if (rotateError) return json(500, { error: "Could not rotate this connection key." });
    const { error: restoreError } = await supabase.from("mt5_connections")
      .update({ revoked_at: null }).eq("id", connectionId).eq("user_id", user.id);
    if (restoreError) return json(500, { error: "The new key was created, but the connection could not be re-enabled." });
    return json(200, { connection, token });
  } catch (error) {
    console.error("MT5 connection management failed", error);
    return json(500, { error: "MT5 connection management is temporarily unavailable." });
  }
});

