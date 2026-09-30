# TradeOS

TradeOS is a discipline and journaling platform for forex traders. It starts with a shared-account Android app and a compact always-on-top desktop companion.

## Apps

- `apps/web` is the existing responsive Vercel website.
- `apps/mobile` is the Expo Android application.
- `apps/desktop` is the Electron corner widget (320×420).
- `packages/shared` contains TradeOS shared types.
- `supabase` holds database schema and row-level security policies.

Mobile and desktop use one Supabase account and database. The Vercel web app remains available as it is while the TradeOS clients are built. Use only Supabase publishable/legacy anon keys in client apps; never add service-role or secret keys to client code.

## Start the web preview

Install dependencies with `pnpm install`, then run `pnpm dev:web` for the existing web app.

## Android

Install dependencies with `pnpm install`, then run `pnpm dev:android` and open the Expo project on an Android device or emulator.

## Desktop

Run `pnpm dev:desktop` to start the 320×420 always-on-top companion.

## Configuration

Copy `.env.example` to `.env` and set the Supabase project URL and publishable key. The publishable key is suitable for client apps only when every exposed table has row-level security enabled. Never put a Supabase secret or service-role key in a browser, desktop renderer, or mobile app.

## Current scope

Phase 0 establishes the typed monorepo, Supabase Auth, owner-only TradeOS schema, and Trading/Personal dashboard shell. Strategy checklist enforcement, journaling, Daily Focus, statistics, MT5 import, and life-area scores are planned follow-on phases.

