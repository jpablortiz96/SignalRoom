# SignalRoom Limitations & Design Choices

This document outlines key technical limitations, design decisions, and tradeoffs made for this version of SignalRoom.

## 1. No Authentication / Identity Layer
* **Shortcut**: There is no user login (Auth), builder sign-up, or session authorization checks in place.
* **Impact**: Anyone with a copyable public room link can view reports, configure rooms, or simulate tester telemetry events. Session alias inputs on tester portals are self-reported.
* **Reasoning**: Optimized for maximum speed during hackathon testing and demoing where judges want instant access without going through authentication gates.

## 2. Public Database Policies (Row Level Security)
* **Shortcut**: Database tables have public insert/select permissions enabled.
* **Impact**: Telemetry client components read and write directly to Supabase tables using only the public Anon Key for rapid execution.
* **Security Note**: This is acceptable for a hackathon proof-of-concept, but would require server-side validation, user roles, and RLS policies mapping user UUIDs before any production release.

## 3. External Redirection Tab Controls
* **Shortcut**: External product target URLs open in a separate browser tab instead of being nested in an iframe.
* **Impact**: SignalRoom registers a `target_url_opened` redirect click but cannot track micro-interactions (mouse paths, console errors, scroll positions) directly on third-party target domains.
* **Reasoning**: Modern browsers block cross-origin iframe framing by default using security policies (like `X-Frame-Options: SAMEORIGIN` or Content Security Policies), rendering standard iframe embedding unreliable for general target URLs. We resolve this by opening a new tab and presenting the Reaction Remote console to capture real-time telemetry from testers.

## 4. Directional Behavioral Evidence, Not Market Validation
* **Shortcut**: SignalRoom measures usability blockers, UI friction patterns, and initial response to landing page value propositions during a short 90-second mission.
* **Impact**: SignalRoom provides **directional behavioral evidence** (identifying where and why a tester gets stuck or confused). It does **not** provide market validation, product-market fit verification, price sensitivity analysis, or long-term engagement metrics.
* **Reasoning**: High completion rates and positive session replays prove that the design is functional and the value proposition is clear, but they do not prove that a commercial demand or paying customer base exists.
