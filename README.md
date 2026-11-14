# Web2App Studio

A SaaS platform that converts websites into native Android and iOS applications, powered by GitHub Actions.

## Stack

- Next.js 16 (App Router, TypeScript, Tailwind CSS)
- Supabase (PostgreSQL + Auth)
- Redis + BullMQ (build queue)
- GitHub API + GitHub Actions
- Capacitor (Android/iOS templates)

## Setup

1. Copy `.env.example` to `.env.local` and fill in values.
2. Run Supabase migrations: `supabase db push` (or apply `supabase/migrations/001_init.sql`).
3. Install dependencies: `npm install`
4. Run dev server: `npm run dev`

## Features

- GitHub OAuth + PAT connection
- Project management
- Website-to-app configuration
- Android & iOS build pipelines (GitHub Actions)
- Build queue with BullMQ
- Admin dashboard

## Notes

- iOS builds require macOS GitHub-hosted runners.
- Store GitHub PATs encrypted server-side (ENCRYPTION_KEY).
- Never expose tokens to the client.
