"use client";

/**
 * Safe analytics wrapper for SignalRoom events.
 * Connects to the existing Novus/Pendo SDK installation.
 */

// Helper to determine the current environment
const isProd = process.env.NODE_ENV === "production";

/**
 * Safely track a custom product event using the existing global Pendo/Novus installation.
 * @param eventName Name of the event to track
 * @param payload Optional metadata to attach to the event
 */
export function trackSignalRoomEvent(eventName: string, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") {
    return;
  }

  const pendoSdk = window.pendo;

  // Build the enriched payload with standard properties
  const enrichedPayload = {
    ...payload,
    eventSource: "signalroom",
    environment: isProd ? "production" : "development"
  };

  if (pendoSdk && typeof pendoSdk.track === "function") {
    try {
      pendoSdk.track(eventName, enrichedPayload);
      if (!isProd) {
        console.debug(`[SignalRoom Analytics] Event tracked: "${eventName}"`, enrichedPayload);
      }
    } catch (err) {
      if (!isProd) {
        console.debug(`[SignalRoom Analytics] Error tracking event "${eventName}":`, err);
      }
    }
  } else {
    if (!isProd) {
      console.debug(`[SignalRoom Analytics] SDK not found. Event skipped: "${eventName}"`, enrichedPayload);
    }
  }
}

/**
 * Safely identify the visitor using the existing global Pendo/Novus installation.
 * @param metadata Metadata to associate with the visitor
 */
export function identifySignalRoomVisitor(metadata: Record<string, unknown> = {}) {
  if (typeof window === "undefined") {
    return;
  }

  const pendoSdk = window.pendo;

  if (pendoSdk && typeof pendoSdk.identify === "function") {
    try {
      pendoSdk.identify(metadata);
      if (!isProd) {
        console.debug(`[SignalRoom Analytics] Visitor identified:`, metadata);
      }
    } catch (err) {
      if (!isProd) {
        console.debug(`[SignalRoom Analytics] Error identifying visitor:`, err);
      }
    }
  } else {
    if (!isProd) {
      console.debug(`[SignalRoom Analytics] SDK not found. Identification skipped:`, metadata);
    }
  }
}
