# SignalRoom 🚦 — Production Deployment Checklist

Use this checklist to prepare, deploy, and verify the SignalRoom application in a production environment (Vercel + Supabase).

---

## 📋 1. Pre-Deployment Configuration Audit

Before triggering a production build, verify that all environment keys are documented and structured.

### **Required Production Environment Variables**

| Variable Name | Exposure | Purpose | Verification Command / Format |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | Client | Generates absolute sharing links for tester portals and reports. | Must start with `https://` (no trailing slash). |
| `NEXT_PUBLIC_SUPABASE_URL` | Client | Endpoint URL for Supabase client queries. | Standard URL: `https://<proj-id>.supabase.co`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client | Public API token for client-side reads/writes. | Standard JWT string. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-Only** | High-privilege API token for secure database resets. | **CRITICAL**: Never prefix with `NEXT_PUBLIC_`. |

> [!WARNING]
> Ensure that `SUPABASE_SERVICE_ROLE_KEY` is not exposed in any client-side file or code block. If exposed, revoke and regenerate the key immediately in the Supabase console.

---

## 🗃️ 2. Supabase Database Schema Setup

Verify that all target PostgreSQL tables are active and columns match the application model exactly.

- [ ] **Table Check: `rooms`**
  - Columns: `id` (text, PK), `product_name` (text), `product_url` (text), `tester_mission` (text), `time_limit_seconds` (integer), `tester_persona` (text), `created_at` (timestamptz).
- [ ] **Table Check: `sessions`**
  - Columns: `id` (text, PK), `room_id` (text, FK), `tester_alias` (text), `started_at` (timestamptz), `completed_at` (timestamptz), `duration_seconds` (integer), `completed_mission` (boolean), `understood_value` (boolean), `found_cta` (boolean), `could_not_find_cta` (boolean), `offer_unclear` (boolean), `page_trustworthy` (boolean), `page_not_trustworthy` (boolean), `confusion_reported` (boolean), `confusion_reason` (text), `feedback_text` (text).
- [ ] **Table Check: `events`**
  - Columns: `id` (text, PK), `room_id` (text, FK), `session_id` (text, FK), `event_name` (text), `event_category` (text), `event_payload` (jsonb), `created_at` (timestamptz).
- [ ] **Table Check: `reports`**
  - Columns: `id` (text, PK), `room_id` (text, FK), `summary` (text), `metrics_json` (jsonb), `recommendations_json` (jsonb), `created_at` (timestamptz).

---

## 💻 3. Local Compilation & Quality Checks

Run local compilation tasks to prevent build failures during deployment.

```bash
# 1. Clean build cache
rm -rf .next

# 2. Run code validation (Linter)
npm run lint

# 3. Test production compilation
npm run build
```

- [ ] **Linting**: Linter returns zero errors or warnings.
- [ ] **TypeScript Compile**: All App Router paths compile successfully.
- [ ] **Diagnostics**: Local `/api/health` returns status `ok`.

---

## 🚀 4. Vercel Deployment Workflow

1. Push clean codebase changes to your production branch.
2. Link your repository in the Vercel Dashboard.
3. Configure the **four environment variables** listed in Section 1.
4. Click **Deploy**. Vercel compiles the static pages and assigns a production URL.

---

## 🚦 5. Post-Deployment Verification Flow

Conduct these verification steps on the live production URL to ensure the environment is fully operational.

### **Step 1: Diagnostics Health Check**
- [ ] Access `https://<your-vercel-domain>/api/health` in your browser.
- [ ] Verify that the JSON response returns:
  ```json
  {
    "app": "SignalRoom",
    "status": "ok",
    "supabaseConfigured": true,
    "novusInstalled": true,
    "customAnalyticsWrapper": true
  }
  ```

### **Step 2: End-to-End User Verification**
- [ ] **Create Room**: Access `/create`, fill out target mission details, and click **Create Room**. Confirm you are redirected to the success screen and tester links are copied to the clipboard.
- [ ] **Tester Simulation**: Open the copied Tester Link (`/r/[roomId]`) in a separate browser tab (or incognito window).
  * Check that the premium skeleton UI loads first before displaying the sandbox.
  * Enter a tester alias, click **Start Mission**, and perform a reaction (e.g. click "I found the main value").
  * Complete the mission by entering feedback and clicking **Complete Mission**.
- [ ] **Check Report**: Navigate to the Report URL (`/report/[roomId]`) and confirm that average completed duration, success metrics, and timestamped events are calculated in real-time.
- [ ] **Read Signal Story**: Navigate to the Signal Story URL (`/story/[roomId]`) and confirm the cinematic log narrative compiles correctly without errors.
- [ ] **Telemetry Audit**: Navigate to `/evidence` and verify that the tester events appear instantly in the global telemetry log stream.

---

## 📊 6. Novus / Pendo Analytics Verification Flow

Ensure custom analytics events route correctly to Pendo's event collection servers.

- [ ] **Verify Layout HEAD Injection**: Inspect the HTML page source of your production deployment. Confirm that the official Pendo script block containing apiKey `'06c77be2-7fed-4ff9-a1f0-eec335a92f54'` is loaded inside `<head>`.
- [ ] **Verify Client Diagnostics Logging**: In local development (`npm run dev`), open the browser Developer Console. Verify that events are tracked in the logs:
  - [ ] Page Home view logs `[SignalRoom Analytics] Event tracked: "page_home_viewed"`
  - [ ] Create Page logs `[SignalRoom Analytics] Event tracked: "create_room_viewed"`
  - [ ] Room Save logs `[SignalRoom Analytics] Event tracked: "room_created"`
  - [ ] Tester Page logs `[SignalRoom Analytics] Event tracked: "tester_room_viewed"`
  - [ ] Reactions log `[SignalRoom Analytics] Event tracked: "value_found"`, `"cta_found"`, etc.
  - [ ] Report Page logs `[SignalRoom Analytics] Event tracked: "report_viewed"`
  - [ ] Replay start logs `[SignalRoom Analytics] Event tracked: "replay_session_opened"`
  - [ ] Signal Story Page logs `[SignalRoom Analytics] Event tracked: "signal_story_viewed"`
- [ ] **Check Analytics Offline Resiliency**: Block script loading (e.g., using an ad-blocker or browser config). Navigate the site and verify that the application continues to run without freezing or throwing UI exceptions.
