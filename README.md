# Sultan

Sultan is a personal operating system for web and Android, based on the attached Life OS blueprint. The first slice is the animated dashboard and Daily Focus. The product structure groups the blueprint's modules into four areas: Personal, Trading, Health, and Work & Wealth.

## Apps

- `apps/web` is the responsive Vercel website.
- `apps/mobile` is the Expo Android application.
- `packages/shared` contains shared types and scoring helpers.
- `supabase` will hold the database schema, row-level security policies, and server functions.

The web and Android clients are designed to use one Supabase account and database. Until project credentials are configured, the web dashboard runs in preview mode with local demo data. Do not add private API keys to either client.

## Start the web preview

Install dependencies with `pnpm install`, then run `pnpm dev:web`.

## Android

Install dependencies with `pnpm install`, then run `pnpm dev:android` and open the Expo project on an Android device or emulator.

## Configuration

Copy `.env.example` to `.env` and set the Supabase project URL and publishable key after the backend project is ready. The publishable key is suitable for client apps only when every exposed table has row-level security enabled. Never put a Supabase secret or service-role key in a browser or mobile app.

## Current scope

This starter establishes the shared app layout and the first Daily Focus slice. Trading checklists and journaling, health routines, work/wealth tracking, reminders, scoring, and the remaining blueprint modules are planned follow-on slices.
