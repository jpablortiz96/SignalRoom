# SignalRoom 🚦 — Technical Limitations & Architecture Trade-offs

This document outlines the calculated technical trade-offs, shortcuts, and structural limitations accepted during the initial MVP release of SignalRoom. It details our current state, risk analysis, and the concrete path to enterprise-grade production.

---

## 🛡️ Architectural Trade-off Summary

SignalRoom was built to demonstrate rapid usability feedback loops for digital products. To optimize for launch day speed, certain capabilities (like authentication and multi-tenant isolation) were simplified. These choices are documented below to ensure total transparency.

| Area | Shortcut Taken | Operational Impact | Risk Profile |
| :--- | :--- | :--- | :--- |
| **Identity & Access** | No Authentication Layer | Open room creation; public URLs | Low-Medium (Public read/write access to test rooms) |
| **Data Storage** | Public Database Policies | Direct client-to-Supabase writes | Medium (Requires RLS migration before scale) |
| **Sandboxing** | External Tab Redirection | No iframe micro-tracking | Low (Calculated browser security override) |
| **Product Scope** | Directional Telemetry Only | Measures friction, not PMF | Low (Scoping design limits) |

---

## 1. Zero Authentication / Identity Layer

### **Shortcut Taken**
The application operates without builder accounts, user sign-ups, session-verification tokens, or permission controls. 

### **Operational Impact**
* Anyone with access to the production domain can create rooms, configure test guidelines, or simulated tester profiles.
* Tester session aliases are self-reported during launch.
* Report URLs (`/report/[roomId]`) and Signal Stories (`/story/[roomId]`) are public and accessible to anyone with the UUID.

### **Reasoning & Hackathon Trade-off**
Optimized for instant, zero-friction review. Judges and testers can evaluate the application end-to-end without registration barriers.

### **Path to Enterprise Production**
1. Integrate **Supabase Auth** or **NextAuth.js** to manage builder user records.
2. Restrict `/create`, `/report/[roomId]`, and `/story/[roomId]` behind middleware-enforced session verification.
3. Map room records to a specific `owner_id` linked to the authenticated workspace.

---

## 2. Public Database Policies (Row Level Security)

### **Shortcut Taken**
The PostgreSQL tables (`rooms`, `sessions`, `events`, `reports`) are configured with permissive Read/Write policies in Supabase using the client-side Anon Key.

### **Operational Impact**
* The client application writes telemetry records directly from the tester viewport to Supabase tables.
* A malicious actor could theoretically intercept the public Supabase keys and execute unauthorized bulk queries or insert garbage telemetry events.

### **Reasoning & Hackathon Trade-off**
Allows rapid client-side event streaming and serverless rendering without requiring a complex backend API translation layer.

### **Path to Enterprise Production**
1. Enforce strict **Row Level Security (RLS)** policies on all tables.
2. Transition database insert actions to server-side **Next.js Server Actions** or API routes.
3. Use signing tokens (JWT) to authorize client telemetry posts, validating that events match the current session metadata.

---

## 3. External Redirection Tab Controls

### **Shortcut Taken**
Rather than rendering the product under test inside an `iframe`, SignalRoom launches the target URL in a separate browser tab, running a split-screen control overlay alongside it.

### **Operational Impact**
* SignalRoom logs the initial redirect event (`target_url_opened`) but cannot capture detailed DOM micro-interactions (mouse heatmaps, inline errors, input field transitions) directly on third-party target domains.
* Telemetry collection relies on tester reaction buttons submitted to the Control Remote panel.

### **Reasoning & Hackathon Trade-off**
Modern browsers block cross-origin iframes using strict headers (`X-Frame-Options: SAMEORIGIN` or `Content-Security-Policy: frame-ancestors`). Attempting to force third-party product pages into frames causes rendering failures. Opening a new tab with the Reaction Remote side-panel is the only way to test general target URLs.

### **Path to Enterprise Production**
1. Offer a lightweight, installable **SignalRoom SDK** (via NPM or script tag) that builders inject into their staging sites.
2. The SDK will securely handshake with the SignalRoom parent window to stream high-fidelity telemetry events (scroll speed, layout shifts, clicks) across domains.

---

## 4. Directional Telemetry Scoping

### **Shortcut Taken**
SignalRoom is designed to evaluate immediate usability friction patterns, visual clarity, and initial response to landing page value propositions during a short 90-second mission.

### **Operational Impact**
* SignalRoom does **not** measure long-term retention, pricing sensitivity, product-market fit, or market sizing.
* High completion rates prove that the landing page or checkout interface is usable, but do not guarantee commercial viability or paying customer demand.

### **Reasoning & Hackathon Trade-off**
Product builders must validate core usability before scaling. SignalRoom focuses exclusively on this initial barrier: proving whether a user *can* navigate the product.

### **Path to Enterprise Production**
1. Integrate cohort retention tracking.
2. Build support for long-running, asynchronous testing windows (e.g. multi-day trials).
3. Introduce benchmark modules linking usability scores directly to conversion prediction algorithms.
