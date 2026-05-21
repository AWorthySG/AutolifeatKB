# AutolifeatKB

A shared fridge inventory tracker. Add groceries by typing or photographing receipts, deduct ingredients automatically when you cook, and keep an auto-generated shopping list in sync. Works across multiple users in a household, with a web app (primary) and a Telegram bot (secondary).

## Stack

- **Web**: Next.js 15 (App Router) + TypeScript + Tailwind + shadcn/ui
- **Backend**: Supabase (Postgres + Auth + Storage)
- **LLM**: Anthropic Claude (`claude-haiku-4-5` for text, `claude-sonnet-4-6` for vision)
- **Bot**: Python + `python-telegram-bot` (Phase 6)
- **Hosting**: Vercel (web) + Fly.io (bot)

## Repository layout

```
/web                    Next.js web app
/bot                    Python Telegram bot (Phase 6)
/supabase/migrations    SQL schema migrations
/prompts                Shared LLM prompt templates
```

## Setup

### 1. Supabase project

1. Create a project at https://supabase.com
2. In the SQL editor, run `supabase/migrations/0001_init.sql`
3. Enable Email auth (magic link) under Authentication > Providers
4. Copy your project URL, anon key, and service-role key

### 2. Anthropic API key

Get one at https://console.anthropic.com

### 3. Web app

```bash
cd web
cp ../.env.example .env.local
# Fill in the values
npm install
npm run dev
```

Open http://localhost:3000 and sign in with your email.

### 4. Telegram bot (Phase 6 — coming later)

```bash
cd bot
cp ../.env.example .env
# Fill in TELEGRAM_BOT_TOKEN (get one from @BotFather)
uv sync
uv run python bot.py
```

## Current status

| Phase | Feature | Status |
|---|---|---|
| 1 | Web skeleton + DB + households + text add | In progress |
| 2 | Freeform cook + deduct | Planned |
| 3 | Auto shopping list | Planned |
| 4 | Receipt + fridge photos (vision) | Planned |
| 5 | Recipes (CRUD + cook flow) | Planned |
| 6 | Telegram bot | Planned |
| 7 | PWA + suggestions + reminders | Planned |

See `/root/.claude/plans/i-am-looking-to-glimmering-lecun.md` for the full plan.
