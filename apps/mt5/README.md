# Sultan MT5 Sync

Sultan MT5 Sync is a read-only MetaTrader 5 Expert Advisor. The MT5 desktop terminal stays connected to the broker; the EA sends account deal history to Sultan over HTTPS. It does not send, change, or close orders.

## Install

1. Sign in to Sultan, open **Accounts**, select the matching trading account, and create an **MT5 connection**. Copy the one-time connection key before closing the dialog.
2. Open `SultanTradeSync.mq5` in MetaEditor, compile it, and return to the MT5 terminal.
3. In MT5, open **Tools → Options → Expert Advisors** and allow this URL: `https://uwbglnkdsgwbjorqxvcj.supabase.co/functions/v1/mt5-sync`.
4. Attach **Sultan Trade Sync** to a chart in the account you selected in Sultan. In the EA inputs, paste the connection key and public Supabase key shown in the Sultan connection dialog. Enable algorithmic trading for the EA to run; this EA only reads account history.
5. Leave MT5 running while you want live synchronization. When the terminal reconnects after being offline, it catches up from its saved sync cursor. Imported trade history will appear in Sultan on web, Android, and desktop.

The connector reports the terminal account number only during pairing. Sultan stores a salted fingerprint instead of the account number. The connection key can import trade data only; it cannot authenticate to your broker. Revoke or rotate it from **Accounts → MT5 connections** if it is lost.

## Server deployment

Apply the migration in `supabase/migrations/20260930102000_mt5_trade_sync.sql`, deploy `mt5-connection` with JWT verification enabled, then deploy `mt5-sync` with JWT verification disabled. The second function verifies the per-connection bearer key itself; never disable its code-level token check.

```sh
supabase functions deploy mt5-connection
supabase functions deploy mt5-sync --no-verify-jwt
```

Supabase Edge Functions must have `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured. The service key stays in Supabase and is never included in this EA or in a client app.

