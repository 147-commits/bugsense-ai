# BugSense AI

**AI-Powered Defect Intelligence Platform**

BugSense AI transforms messy bug reports into structured, actionable engineering tickets using artificial intelligence. It helps QA teams detect patterns, generate test cases, and predict root causes — all from a single modern dashboard.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss)
![Drizzle](https://img.shields.io/badge/Drizzle-0.45-c5f74f?logo=drizzle)
![Claude AI](https://img.shields.io/badge/Claude-Sonnet-cc785c?logo=anthropic)

---

## Features

### Core AI Capabilities

| Feature | Description |
|---------|-------------|
| **Bug Report Analyzer** | Converts raw descriptions into structured reports with title, severity, priority, steps to reproduce, and environment info |
| **Screenshot & Log Analysis** | Upload screenshots or error logs for AI-powered visual and textual signal analysis |
| **Duplicate Bug Detection** | AI compares new reports against existing bugs to flag potential duplicates |
| **Test Case Generator** | Automatically generates regression, edge-case, and smoke test cases from bug data |
| **Root Cause Predictor** | Suggests likely system areas and root causes based on bug patterns |
| **Bug Impact Prediction** | Estimates user impact, affected modules, and business consequences |
| **AI Quality Score** | Rates bug report clarity and completeness on a 0-100 scale with breakdown |
| **QA Assistant Chat** | Interactive chat to discuss bugs — ask "Why might this occur?" or "What tests should I add?" |
| **Reproduction Checklist** | Generates step-by-step checklists for QA engineers to confirm issues |
| **Jira / GitHub Export** | Formats structured reports for direct export to Jira or GitHub Issues |

### Dashboard & Analytics

- **Bug Statistics** — Total, critical, resolved counts with trends
- **Severity Distribution** — Pie chart of bug severity breakdown
- **Defect Trend Charts** — Area chart showing new vs resolved bugs over time
- **Module Heatmap** — Bar chart of most affected system modules
- **AI Bug Clustering** — Groups similar bugs automatically (e.g., Login Issues → Timeout, Session, Auth)
- **Recurring Bug Detection** — Identifies bugs that keep coming back
- **Quality Radar** — Radar chart of average report quality dimensions

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **Styling** | Tailwind CSS |
| **Database** | Neon Postgres + Drizzle ORM |
| **AI** | Anthropic Claude API |
| **Charts** | Recharts |
| **State** | Zustand |
| **Deployment** | Vercel |

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- PostgreSQL (optional — works with mock data out of the box)
- Anthropic API key (optional — runs in demo mode without one)

### 1. Clone & Install

```bash
git clone https://github.com/your-username/bugsense-ai.git
cd bugsense-ai
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
AI_API_KEY=sk-ant-your-key-here
DATABASE_URL=postgresql://user:password@localhost:5432/bugsense
NEXTAUTH_SECRET=long-random-string
# Used to encrypt integration secrets (Jira refresh tokens, Slack bot tokens) at rest.
# Generate with: openssl rand -hex 32
TOKEN_ENC_KEY=
```

> **Note:** The app runs in **demo mode** without an API key, using realistic mock AI responses.

### 3. Database Setup (Optional)

```bash
npm run db:generate   # generate SQL migrations from lib/database/schema.ts
npm run db:migrate    # apply migrations to the database
npm run db:studio     # open Drizzle Studio to inspect data
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Deploy to Vercel

### One-Click Deploy

1. Push code to GitHub
2. Import repository at [vercel.com/new](https://vercel.com/new)
3. Add environment variables:
   - `AI_API_KEY` — Your Anthropic API key
   - `DATABASE_URL` — PostgreSQL connection string (use [Neon](https://neon.tech), [Supabase](https://supabase.com), or [Railway](https://railway.app))
4. Deploy

Your app will be live at `your-project.vercel.app`

---

## Project Structure

```
bugsense-ai/
├── app/
│   ├── (app)/                          # Authenticated app routes (sidebar layout)
│   │   ├── analytics/page.tsx          # QA insights & pattern analysis
│   │   ├── analyze/page.tsx            # Bug analyzer with AI form
│   │   ├── apitests/page.tsx           # API test suite generator
│   │   ├── automation/page.tsx         # UI automation script generator
│   │   ├── bugs/page.tsx               # Bug database with search & filters
│   │   ├── coverage/page.tsx           # Coverage gap analyser
│   │   ├── dashboard/page.tsx          # Main dashboard with stats & charts
│   │   ├── history/page.tsx            # Past generations & analyses
│   │   ├── projects/page.tsx           # Project CRUD
│   │   ├── projects/[id]/page.tsx      # Project detail with content tabs
│   │   ├── qadocs/page.tsx             # QA documentation generator
│   │   ├── releasenotes/page.tsx       # Release notes generator
│   │   ├── settings/page.tsx           # Configuration & integrations
│   │   ├── testdata/page.tsx           # Test data generator
│   │   ├── testgen/page.tsx            # Test case generator from user stories
│   │   ├── testplan/page.tsx           # Sprint test plan generator
│   │   └── layout.tsx                  # App shell wrapper
│   ├── (auth)/                         # Sign-in / sign-up (centered shell)
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   └── layout.tsx
│   ├── api/
│   │   ├── analyze/route.ts            # POST — Full AI bug analysis pipeline
│   │   ├── apitests/route.ts           # POST — Generate API tests
│   │   ├── auth/
│   │   │   ├── [...nextauth]/route.ts  # NextAuth handler
│   │   │   └── register/route.ts       # POST — Sign-up
│   │   ├── automation/route.ts         # POST — Generate automation project
│   │   ├── bugs/route.ts               # GET — List & filter bugs
│   │   ├── bugs/stats/route.ts         # GET — Dashboard statistics
│   │   ├── chat/route.ts               # POST — QA assistant chat
│   │   ├── coverage/route.ts           # POST — Expand test coverage
│   │   ├── duplicates/route.ts         # POST — Duplicate detection
│   │   ├── export/route.ts             # POST — Jira/GitHub export
│   │   ├── health/route.ts             # GET — Health check
│   │   ├── history/route.ts            # GET — Project timeline
│   │   ├── projects/route.ts           # GET/POST — Projects
│   │   ├── projects/[id]/route.ts      # PATCH/DELETE — Single project
│   │   ├── projects/[id]/content/route.ts  # GET — Project content
│   │   ├── qadocs/route.ts             # POST — QA documentation
│   │   ├── releasenotes/route.ts       # POST — Release notes
│   │   ├── testdata/route.ts           # POST — Test data generation
│   │   ├── testgen/route.ts            # POST — Test cases from user stories
│   │   └── testplan/route.ts           # POST — Sprint test plan
│   ├── layout.tsx                      # Root layout
│   ├── providers.tsx                   # NextAuth SessionProvider
│   ├── not-found.tsx                   # 404 page
│   └── page.tsx                        # Redirect to /dashboard
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx                # Main layout wrapper
│   │   ├── Sidebar.tsx                 # Navigation sidebar
│   │   └── TopBar.tsx                  # Top header bar
│   ├── charts/
│   │   └── BugCharts.tsx               # Chart components (Recharts)
│   ├── ui/
│   │   ├── AIDisclaimer.tsx            # AI confidence badge / disclaimer
│   │   ├── CodeBlock.tsx               # Syntax-highlighted code block
│   │   ├── Feedback.tsx                # Thumbs up/down feedback widget
│   │   └── Loading.tsx                 # Spinners, skeletons, progress bars
│   ├── BugAnalysisCard.tsx             # AI analysis output display
│   ├── BugForm.tsx                     # Bug submission form
│   ├── BugListItem.tsx                 # Bug list row component
│   ├── GeneratorPage.tsx               # Shared shell for generator pages
│   └── QAChat.tsx                      # AI chat assistant
├── lib/
│   ├── ai/
│   │   ├── bugAnalyzer.ts              # All AI functions + prompts + mock fallbacks
│   │   └── validator.ts                # Post-process AI output (severity/priority guards)
│   ├── auth/
│   │   ├── authOptions.ts              # NextAuth config (Credentials + JWT)
│   │   ├── getCurrentUser.ts           # Server helper: load full user record
│   │   └── requireAuth.ts              # Route-handler guard (returns 401 NextResponse)
│   ├── database/
│   │   ├── db.ts                       # Drizzle client (Neon serverless Pool)
│   │   ├── index.ts                    # Re-exports db + schema
│   │   └── schema.ts                   # Drizzle schema (tables, enums, relations)
│   ├── hooks/
│   │   └── useStore.ts                 # Zustand global state
│   └── utils/
│       ├── index.ts                    # Helper functions
│       └── mockData.ts                 # Demo data for /bugs and /analytics
├── styles/
│   └── globals.css                     # Global styles + Tailwind + custom components
├── types/
│   └── index.ts                        # TypeScript type definitions
├── public/
│   └── assets/                         # Static assets
├── drizzle.config.ts                   # Drizzle Kit config (migrations output)
├── middleware.ts                       # NextAuth route protection
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── package.json
├── vercel.json
├── .env.example
└── README.md
```

---

## API Reference

### POST `/api/analyze`

Full AI analysis pipeline. Accepts raw bug input and returns structured report.

**Request:**
```json
{
  "rawInput": "Login crashes after SSO redirect...",
  "logContent": "TypeError: Cannot read...",
  "screenshotBase64": "base64_string (optional)"
}
```

**Response:**
```json
{
  "bugReport": { "title": "...", "severity": "HIGH", ... },
  "qualityScore": { "score": 85, "breakdown": { ... } },
  "duplicates": [],
  "testCases": [ ... ],
  "reproductionChecklist": { "checklist": [...], "scenarios": [...] }
}
```

### GET `/api/bugs`

List bugs with optional filters.

**Query Params:** `severity`, `status`, `search`, `sortBy`, `order`

### POST `/api/chat`

Chat with AI about a specific bug.

**Request:**
```json
{
  "bugReportId": "bug-001",
  "message": "Why might this bug occur?",
  "history": []
}
```

### POST `/api/export`

Export bug to Jira or GitHub format.

**Request:**
```json
{
  "platform": "github",
  "bugReportId": "bug-001"
}
```

### POST `/api/duplicates`

Check for duplicate bugs.

### GET `/api/health`

Health check endpoint.

---

## AI Prompts

The AI system uses carefully crafted prompts for each feature. All prompts are located in `lib/ai/bugAnalyzer.ts`:

- **Bug Analysis Prompt** — Converts raw text into structured JSON with severity, steps, root causes
- **Quality Scoring Prompt** — Evaluates clarity, reproducibility, completeness, technical detail, actionability
- **Duplicate Detection Prompt** — Compares new bugs against existing database with similarity scoring
- **Test Case Generation Prompt** — Creates regression, smoke, edge-case, and negative test cases
- **Reproduction Checklist Prompt** — Generates environment setup + multiple reproduction scenarios
- **Chat Assistant Prompt** — Context-aware QA discussion with bug-specific knowledge

---

## Demo Mode

When no `AI_API_KEY` is set, BugSense AI runs in **demo mode** with:

- Realistic mock AI responses for all analysis features
- Pre-seeded bug database with 6 diverse bugs
- Full dashboard statistics and charts
- Working search, filters, and navigation
- Chat responses for common QA questions

This makes it easy to showcase the app without any API costs.

---

## License

MIT

---

Built with [Next.js](https://nextjs.org), [Tailwind CSS](https://tailwindcss.com), [Drizzle ORM](https://orm.drizzle.team), and [Claude AI](https://anthropic.com).
