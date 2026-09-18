# Thai Study Companion

A Thai-language learning web app built from the *Can You Speak Thai* Level 1 & 2 textbooks — vocabulary drills, sentence pattern practice, picture matching, and listening stories.

This repo is the production codebase for turning the original single-file prototype into a real product: accounts, per-student progress, spaced repetition, and a teacher/admin dashboard.

## Status

Early setup. Account and infra wiring (GitHub, Supabase, Vercel, Google Cloud TTS, Stripe) is in progress — see the planning doc for the full schema, spaced-repetition algorithm, dashboard design, and cost breakdown:

https://claude.ai/artifact/186b32f8-df10-49b9-9d1c-52472d6410ad

## Stack (planned)

- **Next.js** — frontend, deployed on Vercel (auto-deploys on every push to `main`)
- **Supabase** — Postgres database, auth, and row-level security
- **Google Cloud Text-to-Speech** — pre-rendered audio for every vocab word and sentence
- **Stripe** — billing

## Local development

```bash
npm install
cp .env.example .env.local   # fill in your own Supabase/Stripe/Google keys
npm run dev
```

## Environment variables

See `.env.example` for the full list. None of these belong in this repo, in a commit, or in chat — they're set as encrypted Environment Variables in the Vercel project once it's connected.
