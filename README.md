# NGTZ — Never Go To Zero

3-color habit tracker built on the NGTZ framework. Yellow is a win. The streak stays alive.

## Stack

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL via Neon (serverless)
- **ORM**: Drizzle ORM
- **Auth**: NextAuth.js (Google + GitHub OAuth)
- **Charts**: Recharts
- **Styling**: Tailwind CSS
- **Deploy**: Vercel

## Setup

### 1. Create Neon database

1. Go to [neon.tech](https://neon.tech), create a project
2. Copy the connection string

### 2. Configure OAuth

**Google:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID
3. Authorized redirect URI: `https://your-domain.vercel.app/api/auth/callback/google`
4. For local dev: `http://localhost:3000/api/auth/callback/google`

**GitHub:**
1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. New OAuth App
3. Authorization callback URL: `https://your-domain.vercel.app/api/auth/callback/github`
4. For local dev: `http://localhost:3000/api/auth/callback/github`

### 3. Environment variables

```bash
cp .env.example .env
# Fill in all values
```

Generate NEXTAUTH_SECRET:
```bash
openssl rand -base64 32
```

### 4. Install & run

```bash
npm install
npm run db:push    # Push schema to Neon
npm run dev        # Start dev server
```

### 5. Deploy to Vercel

```bash
# Push to GitHub, connect repo in Vercel
# Add all env vars in Vercel project settings
# Set NEXTAUTH_URL to your Vercel domain
```

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/   # NextAuth handler
│   │   ├── habits/               # CRUD habits
│   │   │   └── [id]/             # Single habit ops
│   │   ├── logs/                 # Upsert daily logs (idempotent)
│   │   └── analytics/            # Server-computed analytics
│   ├── login/                    # OAuth login page
│   ├── dashboard/                # Main tracker view
│   └── analytics/                # Charts & stats
├── components/
│   ├── habit-card.tsx            # Per-habit card with status buttons
│   ├── habit-form.tsx            # Create/edit form
│   ├── mini-calendar.tsx         # Monthly calendar grid
│   ├── navbar.tsx                # Top nav
│   ├── providers.tsx             # SessionProvider wrapper
│   └── status-button.tsx         # 3-color toggle buttons
├── hooks/
│   ├── use-habits.ts             # Habits CRUD hook
│   ├── use-logs.ts               # Logs fetch + optimistic upsert
│   └── use-analytics.ts          # Analytics data hook
└── lib/
    ├── auth.ts                   # NextAuth config
    ├── session.ts                # Auth helper
    └── db/
        ├── index.ts              # Drizzle + Neon connection
        └── schema.ts             # All tables (NextAuth + domain)
```

## Key Design Decisions

- **Idempotent log upsert**: `PUT /api/logs` uses `ON CONFLICT DO UPDATE` on `(userId, habitId, date)` — safe for retries and duplicate requests
- **Soft delete for habits**: Archived, not deleted — preserves historical log data
- **Optimistic UI updates**: Status changes reflect instantly, persist async
- **Server-computed analytics**: Streaks and aggregates computed in SQL, not client-side
- **90-day log window**: Dashboard fetches 90 days of logs to support calendar navigation without excessive payloads

## The NGTZ Framework

- **Version 1.0**: Full habit execution (good days)
- **Version 0.1**: Minimum viable action — too small to fail (chaotic days)
- **3 colors**: 🟢 Green (v1.0), 🟡 Yellow (v0.1), 🔴 Red (zero)
- **Core rule**: Yellow is a win. The streak only breaks on red.
- **Philosophy**: 100 days of one pushup beats 5 days of intense workouts.
