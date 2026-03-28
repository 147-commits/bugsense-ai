# BugSense AI

**AI-Powered Defect Intelligence Platform**

BugSense AI transforms messy bug reports into structured, actionable engineering tickets using artificial intelligence. It helps QA teams detect patterns, generate test cases, and predict root causes — all from a single modern dashboard.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwindcss)
![Prisma](https://img.shields.io/badge/Prisma-5.22-2d3748?logo=prisma)
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
| **Database** | PostgreSQL + Prisma ORM |
| **AI** | Anthropic Claude API (with OpenAI fallback support) |
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
```

> **Note:** The app runs in **demo mode** without an API key, using realistic mock AI responses.

### 3. Database Setup (Optional)

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
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
│   ├── (app)/                    # App routes with sidebar layout
│   │   ├── dashboard/page.tsx    # Main dashboard with stats & charts
│   │   ├── analyze/page.tsx      # Bug analyzer with AI form
│   │   ├── bugs/page.tsx         # Bug database with search & filters
│   │   ├── analytics/page.tsx    # QA insights & pattern analysis
│   │   ├── settings/page.tsx     # Configuration & integrations
│   │   └── layout.tsx            # App shell with sidebar
│   ├── api/
│   │   ├── analyze/route.ts      # POST — Full AI bug analysis pipeline
│   │   ├── bugs/route.ts         # GET — List & filter bugs
│   │   ├── bugs/stats/route.ts   # GET — Dashboard statistics
│   │   ├── chat/route.ts         # POST — QA assistant chat
│   │   ├── duplicates/route.ts   # POST — Duplicate detection
│   │   ├── export/route.ts       # POST — Jira/GitHub export
│   │   ├── quality-score/route.ts # POST — Report quality scoring
│   │   ├── testcases/route.ts    # POST — Test case generation
│   │   └── health/route.ts       # GET — Health check
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Redirect to /dashboard
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx          # Main layout wrapper
│   │   ├── Sidebar.tsx           # Navigation sidebar
│   │   └── TopBar.tsx            # Top header bar
│   ├── charts/
│   │   └── BugCharts.tsx         # All chart components (Recharts)
│   ├── ui/
│   │   └── Loading.tsx           # Spinners, skeletons, progress bars
│   ├── BugForm.tsx               # Bug submission form
│   ├── BugAnalysisCard.tsx       # AI analysis output display
│   ├── BugListItem.tsx           # Bug list row component
│   └── QAChat.tsx                # AI chat assistant
├── lib/
│   ├── ai/
│   │   └── bugAnalyzer.ts        # All AI functions + prompts + mock fallbacks
│   ├── database/
│   │   └── prisma.ts             # Prisma client singleton
│   ├── hooks/
│   │   └── useStore.ts           # Zustand global state
│   └── utils/
│       ├── index.ts              # Helper functions
│       └── mockData.ts           # Demo data for all features
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── seed.ts                   # Seed data
├── styles/
│   └── globals.css               # Global styles + Tailwind + custom components
├── types/
│   └── index.ts                  # TypeScript type definitions
├── public/
│   └── assets/
│       └── noise.svg             # Background texture
├── tailwind.config.ts
├── next.config.js
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

### POST `/api/testcases`

Generate test cases from bug data.

### POST `/api/duplicates`

Check for duplicate bugs.

### POST `/api/quality-score`

Calculate report quality score.

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

Built with [Next.js](https://nextjs.org), [Tailwind CSS](https://tailwindcss.com), [Prisma](https://prisma.io), and [Claude AI](https://anthropic.com).
