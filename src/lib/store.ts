import { supabaseClient } from "./supabase/client";
import * as localStore from "./localStore";

// Export the same interfaces to maintain typescript alignment
export interface Room {
  id: string;
  productName: string;
  productUrl: string;
  testerMission: string;
  timeLimitSeconds: number;
  testerPersona: string;
  createdAt: string;
}

export interface Session {
  id: string;
  roomId: string;
  testerAlias: string;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number;
  completedMission: boolean;
  understoodValue: boolean;
  clickedExpectedAction: boolean;
  confusionReported: boolean;
  confusionReason: string;
  feedbackText: string;
  // Extra columns supported in database
  couldNotFindCta?: boolean;
  offerUnclear?: boolean;
  pageTrustworthy?: boolean;
  pageNotTrustworthy?: boolean;
}

export interface TelemetryEvent {
  id: string;
  roomId: string;
  sessionId: string;
  eventName: string;
  eventPayload: Record<string, unknown>;
  createdAt: string;
}

export interface ReportMetrics {
  completionRate: number;
  avgDurationSeconds: number;
  confusionCount: number;
  totalEvents: number;
  sessions: Session[];
  events: TelemetryEvent[];
  feedback: { alias: string; text: string; completed: boolean }[];
}

// Check if configuration exists
const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
const hasKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const isConfigured = hasUrl && hasKey;

// Track active fallback mode dynamically
let fallbackActive = !isConfigured;

export const isSupabaseConfigured = (): boolean => {
  return isConfigured && !fallbackActive;
};

export const activateFallback = (): void => {
  if (!fallbackActive) {
    console.warn("SignalRoom: Entering Local fallback mode. Telemetry is local-only.");
    fallbackActive = true;
  }
};

interface DbRoom {
  id: string;
  product_name: string;
  product_url: string;
  tester_mission: string;
  time_limit_seconds: number;
  tester_persona?: string | null;
  created_at: string;
}

interface DbSession {
  id: string;
  room_id: string;
  tester_alias: string | null;
  started_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  completed_mission: boolean;
  understood_value: boolean;
  found_cta: boolean;
  could_not_find_cta: boolean;
  offer_unclear: boolean;
  page_trustworthy: boolean;
  page_not_trustworthy: boolean;
  confusion_reported: boolean;
  confusion_reason: string | null;
  feedback_text: string | null;
}

interface DbEvent {
  id: string;
  room_id: string;
  session_id: string | null;
  event_name: string;
  event_category: string;
  event_payload: Record<string, unknown> | null;
  created_at: string;
}

// Database Column Mapping Helpers
function mapRoomFromDb(row: DbRoom): Room {
  return {
    id: row.id,
    productName: row.product_name,
    productUrl: row.product_url,
    testerMission: row.tester_mission,
    timeLimitSeconds: row.time_limit_seconds,
    testerPersona: row.tester_persona || "",
    createdAt: row.created_at,
  };
}

function mapSessionFromDb(row: DbSession): Session {
  return {
    id: row.id,
    roomId: row.room_id,
    testerAlias: row.tester_alias || "Anonymous Tester",
    startedAt: row.started_at,
    completedAt: row.completed_at,
    durationSeconds: row.duration_seconds || 0,
    completedMission: row.completed_mission || false,
    understoodValue: row.understood_value || false,
    clickedExpectedAction: row.found_cta || false,
    confusionReported: row.confusion_reported || false,
    confusionReason: row.confusion_reason || "",
    feedbackText: row.feedback_text || "",
    couldNotFindCta: row.could_not_find_cta || false,
    offerUnclear: row.offer_unclear || false,
    pageTrustworthy: row.page_trustworthy || false,
    pageNotTrustworthy: row.page_not_trustworthy || false,
  };
}

function mapEventFromDb(row: DbEvent): TelemetryEvent {
  return {
    id: row.id,
    roomId: row.room_id,
    sessionId: row.session_id || "",
    eventName: row.event_name,
    eventPayload: row.event_payload || {},
    createdAt: row.created_at,
  };
}

function mapSessionUpdatesToDb(updates: Partial<Session>): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  if (updates.completedAt !== undefined) mapped.completed_at = updates.completedAt;
  if (updates.durationSeconds !== undefined) mapped.duration_seconds = updates.durationSeconds;
  if (updates.completedMission !== undefined) mapped.completed_mission = updates.completedMission;
  if (updates.understoodValue !== undefined) mapped.understood_value = updates.understoodValue;
  if (updates.clickedExpectedAction !== undefined) mapped.found_cta = updates.clickedExpectedAction;
  
  if (updates.couldNotFindCta !== undefined) mapped.could_not_find_cta = updates.couldNotFindCta;
  if (updates.offerUnclear !== undefined) mapped.offer_unclear = updates.offerUnclear;
  if (updates.pageTrustworthy !== undefined) mapped.page_trustworthy = updates.pageTrustworthy;
  if (updates.pageNotTrustworthy !== undefined) mapped.page_not_trustworthy = updates.pageNotTrustworthy;

  if (updates.confusionReported !== undefined) mapped.confusion_reported = updates.confusionReported;
  if (updates.confusionReason !== undefined) mapped.confusion_reason = updates.confusionReason;
  if (updates.feedbackText !== undefined) mapped.feedback_text = updates.feedbackText;
  
  return mapped;
}

const getEventCategory = (eventName: string): string => {
  const name = eventName.toLowerCase();
  if (name.includes("completed") || name.includes("checkout_submit") || name.includes("success")) return "Completion";
  if (name.includes("understood") || name.includes("value_found") || name.includes("reaction_value") || name.includes("trustworthy") || name.includes("credibility")) return "Understanding";
  if (name.includes("error") || name.includes("timeout") || name.includes("friction") || name.includes("confusion") || name.includes("rage") || name.includes("aborted") || name.includes("missing") || name.includes("unclear") || name.includes("untrustworthy")) return "Friction";
  if (name.includes("click") || name.includes("add_to_cart") || name.includes("target_url_opened") || name.includes("reaction_cta")) return "Click";
  return "Session";
};

// Generate a random 6-character room code (e.g., XR83JA)
const generateRoomId = (): string => {
  const chars = "ABCDEFGHJKLMNOPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// 1. Create a launch room
export const createRoom = async (input: Omit<Room, "id" | "createdAt">): Promise<Room> => {
  if (fallbackActive) {
    return localStore.createRoom(input);
  }
  try {
    const roomId = generateRoomId();
    const dbRow = {
      id: roomId,
      product_name: input.productName,
      product_url: input.productUrl,
      tester_mission: input.testerMission,
      time_limit_seconds: input.timeLimitSeconds,
      tester_persona: input.testerPersona || "",
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabaseClient
      .from("rooms")
      .insert(dbRow)
      .select()
      .single();

    if (error) throw error;
    return mapRoomFromDb(data);
  } catch (error) {
    console.error("Supabase createRoom error, falling back:", error);
    activateFallback();
    return localStore.createRoom(input);
  }
};

// 2. Get a single room
export const getRoom = async (roomId: string): Promise<Room | null> => {
  if (fallbackActive) {
    return localStore.getRoom(roomId);
  }
  try {
    const { data, error } = await supabaseClient
      .from("rooms")
      .select("*")
      .eq("id", roomId.toUpperCase())
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return mapRoomFromDb(data);
  } catch (error) {
    console.error("Supabase getRoom error, falling back:", error);
    activateFallback();
    return localStore.getRoom(roomId);
  }
};

// 3. List all rooms
export const listRooms = async (): Promise<Room[]> => {
  if (fallbackActive) {
    return localStore.listRooms();
  }
  try {
    const { data, error } = await supabaseClient
      .from("rooms")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(mapRoomFromDb);
  } catch (error) {
    console.error("Supabase listRooms error, falling back:", error);
    activateFallback();
    return localStore.listRooms();
  }
};

// 4. Create a tester session
export const createSession = async (roomId: string, testerAlias: string = "Anonymous Tester"): Promise<Session> => {
  if (fallbackActive) {
    return localStore.createSession(roomId, testerAlias);
  }
  try {
    const sessionId = "sess_" + Math.random().toString(36).substring(2, 11);
    const dbRow = {
      id: sessionId,
      room_id: roomId.toUpperCase(),
      tester_alias: testerAlias || "Anonymous Tester",
      started_at: new Date().toISOString(),
      completed_mission: false,
      understood_value: false,
      found_cta: false,
      could_not_find_cta: false,
      offer_unclear: false,
      page_trustworthy: false,
      page_not_trustworthy: false,
      confusion_reported: false,
      confusion_reason: "",
      feedback_text: ""
    };

    const { data, error } = await supabaseClient
      .from("sessions")
      .insert(dbRow)
      .select()
      .single();

    if (error) throw error;
    return mapSessionFromDb(data);
  } catch (error) {
    console.error("Supabase createSession error, falling back:", error);
    activateFallback();
    return localStore.createSession(roomId, testerAlias);
  }
};

// 5. Update an existing session
export const updateSession = async (
  sessionId: string, 
  updates: Partial<Omit<Session, "id" | "roomId" | "startedAt">>
): Promise<Session | null> => {
  if (fallbackActive) {
    return localStore.updateSession(sessionId, updates);
  }
  try {
    const dbUpdates = mapSessionUpdatesToDb(updates);
    const { data, error } = await supabaseClient
      .from("sessions")
      .update(dbUpdates)
      .eq("id", sessionId)
      .select()
      .single();

    if (error) throw error;
    return mapSessionFromDb(data);
  } catch (error) {
    console.error("Supabase updateSession error, falling back:", error);
    activateFallback();
    return localStore.updateSession(sessionId, updates);
  }
};

// 6. Add a telemetry event
export const addEvent = async (event: Omit<TelemetryEvent, "id" | "createdAt">): Promise<TelemetryEvent> => {
  if (fallbackActive) {
    return localStore.addEvent(event);
  }
  try {
    const eventId = "evt_" + Math.random().toString(36).substring(2, 11);
    const dbRow = {
      id: eventId,
      room_id: event.roomId.toUpperCase(),
      session_id: event.sessionId,
      event_name: event.eventName,
      event_category: getEventCategory(event.eventName),
      event_payload: event.eventPayload,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabaseClient
      .from("events")
      .insert(dbRow)
      .select()
      .single();

    if (error) throw error;
    return mapEventFromDb(data);
  } catch (error) {
    console.error("Supabase addEvent error, falling back:", error);
    activateFallback();
    return localStore.addEvent(event);
  }
};

// 7. Get events by room ID
export const getEventsByRoom = async (roomId: string): Promise<TelemetryEvent[]> => {
  if (fallbackActive) {
    return localStore.getEventsByRoom(roomId);
  }
  try {
    const { data, error } = await supabaseClient
      .from("events")
      .select("*")
      .eq("room_id", roomId.toUpperCase())
      .order("created_at", { ascending: true });

    if (error) throw error;
    return (data || []).map(mapEventFromDb);
  } catch (error) {
    console.error("Supabase getEventsByRoom error, falling back:", error);
    activateFallback();
    return localStore.getEventsByRoom(roomId);
  }
};

// 8. Get all events
export const getAllEvents = async (): Promise<TelemetryEvent[]> => {
  if (fallbackActive) {
    // Falls back to direct local events reading
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("signalroom_events");
      if (!stored) return [];
      const parsed: TelemetryEvent[] = JSON.parse(stored);
      parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return parsed;
    } catch {
      return [];
    }
  }
  try {
    const { data, error } = await supabaseClient
      .from("events")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(mapEventFromDb);
  } catch (error) {
    console.error("Supabase getAllEvents error, falling back:", error);
    activateFallback();
    if (typeof window === "undefined") return [];
    try {
      const stored = localStorage.getItem("signalroom_events");
      if (!stored) return [];
      const parsed: TelemetryEvent[] = JSON.parse(stored);
      parsed.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return parsed;
    } catch {
      return [];
    }
  }
};

// 9. Get sessions by room ID
export const getSessionsByRoom = async (roomId: string): Promise<Session[]> => {
  if (fallbackActive) {
    return localStore.getSessionsByRoom(roomId);
  }
  try {
    const { data, error } = await supabaseClient
      .from("sessions")
      .select("*")
      .eq("room_id", roomId.toUpperCase())
      .order("started_at", { ascending: false });

    if (error) throw error;
    return (data || []).map(mapSessionFromDb);
  } catch (error) {
    console.error("Supabase getSessionsByRoom error, falling back:", error);
    activateFallback();
    return localStore.getSessionsByRoom(roomId);
  }
};

// 10. Calculate real report metrics
export const calculateReport = async (roomId: string): Promise<ReportMetrics | null> => {
  if (fallbackActive) {
    return localStore.calculateReport(roomId);
  }
  try {
    const room = await getRoom(roomId);
    if (!room) return null;

    const sessions = await getSessionsByRoom(roomId);
    const events = await getEventsByRoom(roomId);

    if (sessions.length === 0) {
      return {
        completionRate: 0,
        avgDurationSeconds: 0,
        confusionCount: 0,
        totalEvents: events.length,
        sessions: [],
        events: events,
        feedback: [],
      };
    }

    const completedSessions = sessions.filter((s) => s.completedMission);
    const completionRate = Math.round((completedSessions.length / sessions.length) * 100);

    const avgDurationSeconds = completedSessions.length > 0
      ? Math.round(completedSessions.reduce((acc, curr) => acc + curr.durationSeconds, 0) / completedSessions.length)
      : 0;

    const confusionCount = sessions.filter((s) => s.confusionReported).length;

    const feedback = sessions
      .filter((s) => s.feedbackText.trim() !== "")
      .map((s) => ({
        alias: s.testerAlias,
        text: s.feedbackText,
        completed: s.completedMission,
      }));

    return {
      completionRate,
      avgDurationSeconds,
      confusionCount,
      totalEvents: events.length,
      sessions,
      events,
      feedback,
    };
  } catch (error) {
    console.error("Supabase calculateReport error, falling back:", error);
    activateFallback();
    return localStore.calculateReport(roomId);
  }
};
