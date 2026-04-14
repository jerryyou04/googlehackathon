# myspend

AI-powered personal finance tracker built on Google Cloud. Upload bank statements and let Gemini extract your transactions automatically.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![Gemini](https://img.shields.io/badge/Gemini-1.5%20Flash-4285F4) ![Prisma](https://img.shields.io/badge/Prisma-7-2D3748) ![Tailwind](https://img.shields.io/badge/Tailwind-v4-38BDF8)

---

## What it does

- Upload a PDF, image, or CSV bank statement
- Gemini 1.5 Flash reads the file and extracts all transactions
- View spending broken down by category, merchant, and date range
- Filter, edit, and delete transactions inline
- Ask Gemini natural language questions about your spending
- Track against a monthly budget with a live gauge

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL via Prisma 7 + pg adapter |
| Storage | Google Cloud Storage |
| AI | Gemini 1.5 Flash (`@google/generative-ai`) |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Font | Geist |

---

## Getting started

### 1. Clone and install

```bash
git clone <repo-url>
cd googlehackathon/myspend
npm install
```

### 2. Set up services

**PostgreSQL** — get a free database from [Neon](https://neon.tech) or [Supabase](https://supabase.com). Copy the connection string.

**Google Cloud Storage** — create a bucket in [GCS](https://console.cloud.google.com/storage), then create a service account with **Storage Object Admin** role and download the JSON key.

**Gemini API** — get a free key from [Google AI Studio](https://aistudio.google.com/apikey).

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
DATABASE_URL=postgresql://user:password@host:5432/myspend

GCS_BUCKET_NAME=myspend-documents
GOOGLE_APPLICATION_CREDENTIALS_JSON={"type":"service_account",...}

GEMINI_API_KEY=AIza...
```

> For Cloud Run or local `gcloud auth application-default login`, leave `GOOGLE_APPLICATION_CREDENTIALS_JSON` blank — it will use Application Default Credentials automatically.

### 4. Push the database schema

```bash
npm run db:push
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Pages

| Route | Description |
|---|---|
| `/` | Dashboard — net balance, budget gauge, category breakdown, recent transactions |
| `/upload` | Upload a statement and trigger Gemini extraction |
| `/history` | Full transaction list with search, category filter, and sort |
| `/categories` | Spending grouped by category with progress bars |
| `/files` | Uploaded documents — rename, delete, reprocess |
| `/insights` | Gemini AI chat + spending-over-time chart + stat tiles |

## API routes

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/upload` | Upload file to GCS, create Document row |
| `POST` | `/api/process-document` | Download from GCS, extract via Gemini, insert Transactions |
| `PATCH` | `/api/documents/[id]` | Rename document |
| `DELETE` | `/api/documents/[id]` | Delete document + GCS file + all transactions |
| `POST` | `/api/transactions` | Create manual transaction |
| `PATCH` | `/api/transactions/[id]` | Edit transaction |
| `DELETE` | `/api/transactions/[id]` | Delete transaction |
| `POST` | `/api/insights` | Ask Gemini a question about spending |
| `GET` | `/api/test-db` | DB healthcheck |

---

## Project structure

```
myspend/
├── app/                  # Next.js App Router pages and API routes
│   ├── page.tsx          # Dashboard
│   ├── upload/           # Upload page
│   ├── history/          # Transaction history
│   ├── categories/       # Category breakdown
│   ├── files/            # Document management
│   ├── insights/         # AI chat and charts
│   └── api/              # API routes
├── components/           # Shared React components
│   ├── nav.tsx           # Top bar + mobile tab bar
│   ├── date-range-bar.tsx
│   ├── spending-gauge.tsx
│   └── charts/
├── lib/                  # Utilities
│   ├── prisma.ts         # DB client singleton
│   ├── gcs.ts            # Google Cloud Storage helpers
│   ├── categories.ts     # Category list and formatters
│   └── date-utils.ts     # Date range helpers
├── prisma/
│   └── schema.prisma     # Document + Transaction models
└── generated/prisma/     # Auto-generated Prisma client
```

---

## Deploying to Cloud Run

The app includes a `Dockerfile` for container-based deployment. Run all commands from the `myspend/` subdirectory.

```bash
cd googlehackathon/myspend

# Build and push the image
gcloud builds submit --tag gcr.io/PROJECT_ID/myspend .

# Deploy
gcloud run deploy myspend \
  --image gcr.io/PROJECT_ID/myspend \
  --platform managed \
  --region us-central1 \
  --set-env-vars DATABASE_URL="...",GEMINI_API_KEY="...",GCS_BUCKET_NAME="myspend-documents" \
  --allow-unauthenticated
```

When running on Cloud Run, omit `GOOGLE_APPLICATION_CREDENTIALS_JSON` and attach a service account with **Storage Object Admin** to the Cloud Run service instead — it will use Application Default Credentials automatically.

> **Why a Dockerfile?** Cloud Run's automatic buildpack detection runs from the repo root. Since `package.json` lives in `myspend/`, the buildpack can't find it and the build fails. The Dockerfile makes the build explicit and self-contained.

---

## Scripts

```bash
npm run dev        # Start dev server (Turbopack)
npm run build      # Production build
npm run db:push    # Push Prisma schema to database
npm run db:studio  # Open Prisma Studio
```
