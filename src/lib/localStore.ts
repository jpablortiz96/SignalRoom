"use client";

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

// Key definitions for LocalStorage
const KEYS = {
  ROOMS: "signalroom_rooms",
  SESSIONS: "signalroom_sessions",
  EVENTS: "signalroom_events",
};

// Safe access helper
const getStorageItem = <T>(key: string, defaultValue: T): T => {
  if (typeof window === "undefined") return defaultValue;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error(`Error reading key ${key} from localStorage`, error);
    return defaultValue;
  }
};

const setStorageItem = <T>(key: string, value: T): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error writing key ${key} to localStorage`, error);
  }
};

// Generate a random 6-character room code (e.g., XR83JA)
const generateRoomId = (): string => {
  const chars = "ABCDEFGHJKLMNOPQRSTUVWXYZ23456789"; // Removed confusing chars like I, 1, O, 0
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// 1. Create a launch room
export const createRoom = (input: Omit<Room, "id" | "createdAt">): Room => {
  const rooms = getStorageItem<Room[]>(KEYS.ROOMS, []);
  
  // Ensure uniqueness
  let roomId = generateRoomId();
  while (rooms.some((r) => r.id === roomId)) {
    roomId = generateRoomId();
  }

  const newRoom: Room = {
    ...input,
    id: roomId,
    createdAt: new Date().toISOString(),
  };

  rooms.push(newRoom);
  setStorageItem(KEYS.ROOMS, rooms);
  return newRoom;
};

// 2. Get a single room
export const getRoom = (roomId: string): Room | null => {
  const rooms = getStorageItem<Room[]>(KEYS.ROOMS, []);
  return rooms.find((r) => r.id.toUpperCase() === roomId.toUpperCase()) || null;
};

// 3. List all rooms
export const listRooms = (): Room[] => {
  return getStorageItem<Room[]>(KEYS.ROOMS, []);
};

// 4. Create a tester session
export const createSession = (roomId: string, testerAlias: string = "Anonymous Tester"): Session => {
  const sessions = getStorageItem<Session[]>(KEYS.SESSIONS, []);
  const sessionId = "sess_" + Math.random().toString(36).substring(2, 11);

  const newSession: Session = {
    id: sessionId,
    roomId: roomId.toUpperCase(),
    testerAlias: testerAlias || "Anonymous Tester",
    startedAt: new Date().toISOString(),
    completedAt: null,
    durationSeconds: 0,
    completedMission: false,
    understoodValue: false,
    clickedExpectedAction: false,
    confusionReported: false,
    confusionReason: "",
    feedbackText: "",
  };

  sessions.push(newSession);
  setStorageItem(KEYS.SESSIONS, sessions);
  return newSession;
};

// 5. Update an existing session
export const updateSession = (sessionId: string, updates: Partial<Omit<Session, "id" | "roomId" | "startedAt">>): Session | null => {
  const sessions = getStorageItem<Session[]>(KEYS.SESSIONS, []);
  const index = sessions.findIndex((s) => s.id === sessionId);
  if (index === -1) return null;

  const updatedSession = {
    ...sessions[index],
    ...updates,
  };

  sessions[index] = updatedSession;
  setStorageItem(KEYS.SESSIONS, sessions);
  return updatedSession;
};

// 6. Add a telemetry event
export const addEvent = (event: Omit<TelemetryEvent, "id" | "createdAt">): TelemetryEvent => {
  const events = getStorageItem<TelemetryEvent[]>(KEYS.EVENTS, []);
  const eventId = "evt_" + Math.random().toString(36).substring(2, 11);

  const newEvent: TelemetryEvent = {
    ...event,
    id: eventId,
    createdAt: new Date().toISOString(),
  };

  events.push(newEvent);
  setStorageItem(KEYS.EVENTS, events);
  return newEvent;
};

// 7. Get events by room ID
export const getEventsByRoom = (roomId: string): TelemetryEvent[] => {
  const events = getStorageItem<TelemetryEvent[]>(KEYS.EVENTS, []);
  return events
    .filter((e) => e.roomId.toUpperCase() === roomId.toUpperCase())
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
};

// 8. Get sessions by room ID
export const getSessionsByRoom = (roomId: string): Session[] => {
  const sessions = getStorageItem<Session[]>(KEYS.SESSIONS, []);
  return sessions.filter((s) => s.roomId.toUpperCase() === roomId.toUpperCase());
};

// 9. Calculate real report metrics
export const calculateReport = (roomId: string): ReportMetrics | null => {
  const room = getRoom(roomId);
  if (!room) return null;

  const sessions = getSessionsByRoom(roomId);
  const events = getEventsByRoom(roomId);

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

  // Completion calculation
  const completedSessions = sessions.filter((s) => s.completedMission);
  const completionRate = Math.round((completedSessions.length / sessions.length) * 100);

  // Avg duration calculation (based on completed sessions)
  const avgDurationSeconds = completedSessions.length > 0
    ? Math.round(completedSessions.reduce((acc, curr) => acc + curr.durationSeconds, 0) / completedSessions.length)
    : 0;

  // Confusion count
  const confusionCount = sessions.filter((s) => s.confusionReported).length;

  // Feedback list
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
};
