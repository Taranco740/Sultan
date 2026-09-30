import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const dealTypes = new Set(["buy", "sell", "balance", "credit", "charge", "correction", "bonus", "commission", "commission_daily", "commission_monthly", "interest", "dividend", "tax", "other"]);
const entryTypes = new Set(["in", "out", "inout", "out_by", "other"]);

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function getAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Supabase server settings are missing.");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function integerString(value: unknown, optional = false): string | null {
  if ((value === null || value === undefined || value === "") && optional) return null;
  const text = String(value ?? "");
  return /^\d{1,20}$/.test(text) ? text : null;
}

function decimalString(value: unknown, fallback = "0"): string | null {
  const text = String(value ?? fallback);
  return /^-?\d{1,12}(\.\d{1,10})?$/.test(text) ? text : null;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { error: "Use POST." });

  const token = (request.headers.get("Authorization") ?? "").match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token || token.length < 40 || token.length > 128) return json(401, { error: "Invalid MT5 connection key." });

  try {
    const supabase = getAdmin();
    const { data: secret, error: secretError } = await supabase.from("mt5_connection_secrets")
      .select("connection_id,user_id").eq("token_hash", await tokenHash(token)).maybeSingle();
    if (secretError || !secret) return json(401, { error: "Invalid or revoked MT5 connection key." });
    const { data: connection, error: connectionError } = await supabase.from("mt5_connections")
      .select("id,user_id,account_id,broker_server,account_fingerprint,revoked_at")
      .eq("id", secret.connection_id).eq("user_id", secret.user_id).maybeSingle();
    if (connectionError || !connection || connection.revoked_at) return json(401, { error: "This MT5 connection has been revoked." });

    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") return json(400, { error: "Invalid MT5 sync payload." });
    const server = typeof payload.broker_server === "string" ? payload.broker_server.trim().slice(0, 100) : "";
    const login = integerString(payload.account_login);
    const hasSnapshot = payload.balance !== undefined || payload.equity !== undefined || payload.currency !== undefined;
    const balance = typeof payload.balance === "number" ? payload.balance : Number.NaN;
    const equity = typeof payload.equity === "number" ? payload.equity : Number.NaN;
    const currency = typeof payload.currency === "string" ? payload.currency.trim().slice(0, 12) : "";
    if (!server || !login || (hasSnapshot && (!Number.isFinite(balance) || !Number.isFinite(equity) || Math.abs(balance) > 1e15 || Math.abs(equity) > 1e15 || !currency)) || !Array.isArray(payload.deals) || payload.deals.length > 100) {
      return json(400, { error: "Invalid MT5 account or deal batch." });
    }

    const fingerprint = await tokenHash(`${connection.id}:${server.toLowerCase()}:${login}`);
    if (connection.account_fingerprint && connection.account_fingerprint !== fingerprint) {
      return json(409, { error: "This MT5 key is paired with a different terminal account. Revoke it and create a new connection." });
    }
    if (!connection.account_fingerprint) {
      const { error: linkError } = await supabase.from("mt5_connections")
        .update({ account_fingerprint: fingerprint, broker_server: server })
        .eq("id", connection.id).is("account_fingerprint", null);
      if (linkError) return json(500, { error: "Could not verify the MT5 account." });
      const { data: linked, error: linkedError } = await supabase.from("mt5_connections")
        .select("account_fingerprint").eq("id", connection.id).single();
      if (linkedError || linked?.account_fingerprint !== fingerprint) return json(409, { error: "This MT5 key is already paired with a different terminal account." });
    }

    const rows = [];
    for (const deal of payload.deals) {
      if (!deal || typeof deal !== "object") return json(400, { error: "A deal entry is invalid." });
      const ticket = integerString(deal.ticket);
      const timeMsc = integerString(deal.time_msc);
      const orderId = integerString(deal.order_id, true);
      const positionId = integerString(deal.position_id, true);
      const volume = decimalString(deal.volume);
      const price = decimalString(deal.price);
      const profit = decimalString(deal.profit);
      const commission = decimalString(deal.commission);
      const swap = decimalString(deal.swap);
      const fee = decimalString(deal.fee);
      const type = String(deal.deal_type ?? "other").toLowerCase();
      const entry = String(deal.entry_type ?? "other").toLowerCase();
      if (!ticket || !timeMsc || orderId === null && deal.order_id != null || positionId === null && deal.position_id != null ||
          !volume || !price || !profit || !commission || !swap || !fee || !dealTypes.has(type) || !entryTypes.has(entry)) {
        return json(400, { error: "A deal has an invalid field." });
      }
      rows.push({
        user_id: connection.user_id,
        account_id: connection.account_id,
        connection_id: connection.id,
        ticket,
        order_id: orderId,
        position_id: positionId,
        time_msc: timeMsc,
        deal_type: type,
        entry_type: entry,
        symbol: typeof deal.symbol === "string" ? deal.symbol.slice(0, 32) : "",
        volume,
        price,
        profit,
        commission,
        swap,
        fee,
        currency: typeof deal.currency === "string" ? deal.currency.slice(0, 8) : "",
        updated_at: new Date().toISOString(),
      });
    }

    if (rows.length) {
      const { error: upsertError } = await supabase.from("mt5_deals")
        .upsert(rows, { onConflict: "connection_id,ticket" });
      if (upsertError) {
        console.error("MT5 deal upsert failed", upsertError);
        return json(500, { error: "Could not save this MT5 batch." });
      }
    }
    const { error: syncError } = await supabase.from("mt5_connections")
      .update({ last_sync_at: new Date().toISOString(), broker_server: server, ...(hasSnapshot ? { latest_balance: balance, latest_equity: equity, currency } : {}) })
      .eq("id", connection.id).eq("user_id", connection.user_id);
    if (syncError) return json(500, { error: "Deals were saved, but the latest account snapshot could not be updated." });
    return json(200, { accepted: rows.length });
  } catch (error) {
    console.error("MT5 sync request failed", error);
    return json(500, { error: "MT5 synchronization is temporarily unavailable." });
  }
});

