# Production Smoke Test Checklist 🚦

Use this checklist to verify that a new SignalRoom production deployment is fully functional.

## 1. Diagnostics Check & Setup

- [ ] **Database Connectivity**: Access `https://<your-domain>/api/health` and verify that the response contains:
  ```json
  {
    "status": "ok",
    "supabaseConfigured": true
  }
  ```
  *(If `supabaseConfigured` is false, check that the Supabase environment variables on Vercel are correctly configured and that your DB tables exist).*

---

## 2. Builder Flow (Room Creation)

- [ ] **Create Room**: Navigate to `https://<your-domain>/create`.
- [ ] **Submit Configuration**: Fill out the form with a test product:
  - Product Name: `Production Test`
  - Target URL: `https://example.com`
  - Mission Description: `Find the main heading and verify layout.`
  - Tester Persona: `Tech-savvy reviewer`
- [ ] **Form Submission**: Click **"Initialize Launch Room"**.
- [ ] **Successful Redirect**: Verify you are redirected to the tester room at `/r/[roomId]` (where `roomId` is a unique generated UUID).

---

## 3. Tester Flow (Incognito / Guest Session)

- [ ] **Incognito Access**: Open an incognito browser window and navigate directly to your generated tester link:
  `https://<your-domain>/r/[roomId]`.
- [ ] **Welcome Modal**: Confirm the welcome screen loads and displays the product name, target URL, and mission details.
- [ ] **Alias Input**: Enter a unique tester alias (e.g., `IncognitoTester-007`).
- [ ] **Start Mission**: Click **"Start Mission"** to enter the testing area.
- [ ] **External URL Interaction**: Click the target URL button. Confirm that the external site opens in a new tab.
- [ ] **Telemetry Remote**: Submit at least 3 telemetry events using the Reaction Remote panel:
  - [ ] Click a reaction button (e.g., "Confusion") and submit a reason.
  - [ ] Click a rage-click warning simulator.
  - [ ] Toggle a value proposition state.
- [ ] **Complete Mission**: Fill in the feedback text, select outcome checkboxes, and click **"Submit Final Evidence"**.
- [ ] **Redirect to Report**: Verify the app redirects you to the report page at `/report/[roomId]`.

---

## 4. Evidence Verification & Persistency

- [ ] **Supabase Verification**: Verify the session and telemetry events are saved in Supabase:
  - Go to `/report/[roomId]`.
  - Ensure the page displays **"Launch report computed from shared Supabase evidence captured across tester sessions."** at the top (and does *not* show the local fallback alert).
- [ ] **Real Metrics Check**: Ensure the metrics show:
  - `Total Tester Sessions`: `1` (or matching your test runs).
  - `Completion Rate`: `100%` (if you completed it).
  - `Average Completion Duration`: Realistic amount of seconds elapsed during your test.
  - `Confusion Count`: Matching the count of confusion reactions you submitted.
- [ ] **Autopsy & Timeline**: Check that the **Friction Autopsy Analysis** card for your session exists, and your custom telemetry logs populate the session timeline correctly.
- [ ] **Cinematic Story Mode**: Navigate to `/story/[roomId]`. Check that:
  - The story loads, quoting your alias and feedback text.
  - Clicking **"Export Story JSON"** successfully downloads a JSON payload containing the telemetry.
  - Clicking **"Replay strongest session"** triggers the timeline replay.
- [ ] **Evidence Feed**: Navigate to `/evidence` from the navigation bar. Check that:
  - Your submitted telemetry events (e.g., rage click, confusion report) appear in the public feed.
  - Clicking the **"Report"** or **"Story"** link on the event cards redirects back to your room's respective pages.

---

## 5. Strict Telemetry Rules

- [ ] **No Fake Metrics**: Ensure no fake/demo metrics are shown as real user evidence:
  - If a room has zero real sessions, `/report/[roomId]` must display an empty state prompting to invite testers, rather than rendering seed data as "real".
  - Demo/Sample data must *only* be visible when the builder explicitly toggles **"Preview with Demo Data"**.
