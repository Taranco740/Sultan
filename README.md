# TradeOS

TradeOS is a trading-only discipline and journaling workspace. A single Supabase login syncs account profiles and personal pre-trade checklists between the responsive web app, Android app, and compact desktop side panel.

## Workspace

- `apps/web` — responsive TradeOS web app, ready for Vercel.
- `apps/mobile` — Expo application for Android.
- `apps/desktop` — Electron checklist panel that stays on top beside a charting app.
- `packages/shared` — shared account, checklist, and date types.
- `supabase/migrations` — database schema and owner-only row-level security policies.

Trading account profiles are organizational labels only. Do not enter broker credentials. TradeOS does not provide signals or financial advice.

## Run the web app

Install dependencies with `pnpm install`, configure the Supabase values below, then run `pnpm dev:web`. Use `pnpm build:web` to create the production web build.

## Run Android

Run `pnpm dev:android` and open the Expo project on an Android device or emulator.

## Run the desktop side panel

Run `pnpm dev:desktop`. The panel is resizable, stays above other windows, and can be dragged by its title bar so it can sit beside TradingView or another charting app.

## Supabase configuration

Copy `.env.example` to `.env` and set the Supabase project URL and publishable key (or legacy anon key). Apply the SQL migrations in order. Use only the publishable/anon key in browser, desktop renderer, and mobile clients. Never add a service-role key or broker password to client code or Git.

## Current phase

The current foundation includes email authentication, multiple account profiles, user-created daily checklists, a checklist-gated trade journal, outcome and plan-following notes, and a calendar of days with logged trades. Backtest and performance statistics are follow-on phases.

