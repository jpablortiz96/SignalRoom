# SignalRoom 🚦

Built as a hackathon product for **Mind the Product World Product Day**.

> **“Don’t ask AI if your product works. Watch five real users prove where it breaks.”**

SignalRoom lets builders create a 90-second launch trial for their product. Builders set a clear mission, testers try to complete it, and SignalRoom logs interaction telemetry (rage clicks, slow steps, and console warnings) to generate an evidence-backed product report.

Phase 1 establishes a clean, modern, dark-themed Next.js App Router static frontend foundation compiling error-free.

---

## 🛠️ Tech Stack

* **Core**: [Next.js 15 (App Router)](https://nextjs.org/) + React 19
* **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
* **Icons**: [Lucide React](https://lucide.dev/)
* **Typography**: Geist Sans & Geist Mono (built-in Next.js font optimization)

---

## 🚦 Application Routes

The app implements the following layout routes:

* `/` — **Premium Landing Page**: Bold value proposition, how-it-works breakdown, and interactive telemetry simulator.
* `/create` — **Create Room**: Static configuration form to deploy a 90-second trial. Simulates API loading and returns copyable URLs.
* `/r/[roomId]` — **Tester Room**: A split-screen dashboard displaying the user mission & countdown timer on the left, and a fully interactive mock browser (an e-commerce checkout path simulating layout shift bottlenecks and rate-limited API endpoints) on the right.
* `/report/[roomId]` — **Product Report**: Summary dashboard aggregating success rate, average completion times, and a time-stamped timeline logs explorer.
* `/evidence` — **Evidence Feed**: Aggregated repository of captured console warnings, rage-clicks, and completed sessions filterable by event categories.

---

## ⚡ Local Setup & Commands

### Prerequisites

Ensure you have [Node.js v18.17.0+](https://nodejs.org/) installed.

### 1. Install Dependencies

Clone this repository and run:

```bash
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env.local
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Build for Production

To compile and verify all TypeScript and ESLint compliance:

```bash
npm run build
```

---

## 🔍 Telemetry & Database Architecture (Phase 3)

SignalRoom utilizes a central **Supabase** instance as its primary database. If configuration keys are missing or a connection error is thrown, the client automatically defaults back to browser `localStorage` and shows a warning status bar: *“Local demo mode active — evidence is stored only in this browser.”*

### 1. Database Table Schemas

Below is the required SQL schema setup for your PostgreSQL database instance:

```sql
-- 1. Rooms Configuration Table
CREATE TABLE rooms (
  id text PRIMARY KEY,
  product_name text NOT NULL,
  product_url text NOT NULL,
  tester_mission text NOT NULL,
  time_limit_seconds integer NOT NULL DEFAULT 90,
  tester_persona text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 2. Tester Sessions Table
CREATE TABLE sessions (
  id text PRIMARY KEY,
  room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  tester_alias text,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  duration_seconds integer,
  completed_mission boolean NOT NULL DEFAULT false,
  understood_value boolean NOT NULL DEFAULT false,
  found_cta boolean NOT NULL DEFAULT false,
  could_not_find_cta boolean NOT NULL DEFAULT false,
  offer_unclear boolean NOT NULL DEFAULT false,
  page_trustworthy boolean NOT NULL DEFAULT false,
  page_not_trustworthy boolean NOT NULL DEFAULT false,
  confusion_reported boolean NOT NULL DEFAULT false,
  confusion_reason text,
  feedback_text text
);

-- 3. Telemetry Events Stream Table
CREATE TABLE events (
  id text PRIMARY KEY,
  room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  session_id text REFERENCES sessions(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  event_category text NOT NULL DEFAULT 'session',
  event_payload jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 4. Analytics Reports Cache Table
CREATE TABLE reports (
  id text PRIMARY KEY,
  room_id text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  summary text,
  metrics_json jsonb NOT NULL,
  recommendations_json jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
```

### 2. Required Environment Configuration

Create a `.env.local` file containing the following variables:

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-public-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

*Note: `SUPABASE_SERVICE_ROLE_KEY` is high-privilege and is only loaded on server-side functions. It is never exposed to the client.*

### 3. Diagnostics Check

Access `/api/health` in your local dev environment to verify if Supabase is connected:

```json
{
  "app": "SignalRoom",
  "status": "ok",
  "supabaseConfigured": true,
  "timestamp": "2026-06-17T11:59:02-05:00"
}
```

---

## 🚦 Local Verification Workflow

1. Setup your local `.env.local` config with the keys above.
2. Confirm the server builds correctly by running `npm run build`.
3. Start the dev environment using `npm run dev` and navigate to `http://localhost:3000`.
4. Create a room at `/create` for your testing landing page.
5. Launch the mission, use the reactions panel to submit events, and complete the mission.
6. Verify `/report/[roomId]` calculates real-time metrics directly from the DB.
7. Open the global navigation evidence board `/evidence` to verify shared telemetry events.

---

## 🚀 Vercel Deployment Guide

Follow these steps to deploy SignalRoom to Vercel and verify the production environment.

### 1. Required Environment Variables

When deploying to Vercel, configure the following environment variables in the project settings:

| Variable | Description | Example / Safe Value | Exponent / Exposure |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | The fully qualified production domain of your deployment. | `https://signalroom.vercel.app` | Client-exposed (used to generate shareable copy links). |
| `NEXT_PUBLIC_SUPABASE_URL` | The API endpoint URL of your Supabase project. | `https://xyz.supabase.co` | Client-exposed (standard public anon access). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The public API key for your Supabase project. | `eyJhbGciOiJIUzI1NiIsIn...` | Client-exposed (standard public anon access). |
| `SUPABASE_SERVICE_ROLE_KEY` | The secret service role API key. Used to execute server-side database sync. | `eyJhbGciOiJIUzI1NiIsIn...` | **Server-only** (never exposed to browser client). |

### 2. Steps to Deploy via Vercel Dashboard

1. Push your local repository to GitHub, GitLab, or Bitbucket.
2. Log into the [Vercel Dashboard](https://vercel.com/) and click **Add New** > **Project**.
3. Import your SignalRoom repository.
4. Expand **Environment Variables** and paste the four environment variables listed above.
5. Click **Deploy**. Vercel will build the Next.js app and assign a production deployment domain.

### 3. Verify Database Connection Post-Deploy

Once the deployment completes, confirm that your production application is successfully communicating with your Supabase database:

1. Navigate to `https://<your-vercel-domain>/api/health` in your browser.
2. Verify that the response returns `"status": "ok"` and `"supabaseConfigured": true`.
3. If `supabaseConfigured` is `false`, verify that all database tables (`rooms`, `sessions`, `events`, `reports`) are created with the proper columns in your Supabase project, and that the environment variables are spelled correctly in the Vercel settings.

For a complete list of verification tasks, refer to the [DEPLOYMENT_CHECKLIST.md](file:///d:/signalroom/DEPLOYMENT_CHECKLIST.md) file.


