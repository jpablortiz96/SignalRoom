"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import LoadingState from "@/components/LoadingState";
import { 
  MousePointer, 
  Search, 
  XCircle, 
  Clock, 
  Filter, 
  ArrowRight, 
  Activity, 
  Database, 
  Play,
  Check,
  AlertTriangle,
  Sparkles
} from "lucide-react";
import { TelemetryEvent, getAllEvents, isSupabaseConfigured } from "@/lib/store";

export default function EvidencePage() {
  const [isMounted, setIsMounted] = useState(false);
  const [events, setEvents] = useState<TelemetryEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<"All" | "Session" | "Click" | "Friction" | "Understanding" | "Completion">("All");
  const [supabaseActive, setSupabaseActive] = useState(true);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");

  useEffect(() => {
    setIsMounted(true);
    setSupabaseActive(isSupabaseConfigured());
  }, []);

  useEffect(() => {
    if (!isMounted) return;
    setStatus("loading");
    getAllEvents().then((data) => {
      setEvents(data);
      setSupabaseActive(isSupabaseConfigured());
      setStatus("loaded");
    }).catch((err) => {
      console.error("Failed to load events from store:", err);
      setSupabaseActive(isSupabaseConfigured());
      setStatus("error");
    });
  }, [isMounted]);

  // Check event type classifications
  const getEventCategory = (eventName: string): "Session" | "Click" | "Friction" | "Understanding" | "Completion" => {
    const name = eventName.toLowerCase();
    
    // Completion
    if (name.includes("completed") || name.includes("checkout_submit") || name.includes("success")) return "Completion";
    
    // Understanding
    if (name.includes("understood") || name.includes("value_found") || name.includes("reaction_value") || name.includes("trustworthy") || name.includes("credibility")) return "Understanding";
    
    // Friction
    if (name.includes("error") || name.includes("timeout") || name.includes("friction") || name.includes("confusion") || name.includes("rage") || name.includes("aborted") || name.includes("missing") || name.includes("unclear") || name.includes("untrustworthy")) return "Friction";
    
    // Click
    if (name.includes("click") || name.includes("add_to_cart") || name.includes("target_url_opened") || name.includes("reaction_cta")) return "Click";
    
    // Default/Session
    return "Session"; 
  };

  const filteredEvents = events.filter((e) => {
    // 1. Tab classification filter
    if (activeFilter !== "All") {
      const category = getEventCategory(e.eventName);
      if (category !== activeFilter) return false;
    }

    // 2. Search query filter
    const query = searchQuery.toLowerCase();
    if (!query) return true;

    const payloadString = e.eventPayload ? JSON.stringify(e.eventPayload).toLowerCase() : "";
    return (
      e.roomId.toLowerCase().includes(query) ||
      e.sessionId.toLowerCase().includes(query) ||
      e.eventName.toLowerCase().includes(query) ||
      payloadString.includes(query)
    );
  });

  if (!isMounted || status === "loading") {
    return (
      <LoadingState 
        type="evidence" 
        title="Loading evidence feed..." 
        subtitle="Fetching shared Supabase telemetry events." 
      />
    );
  }

  // Error State
  if (status === "error") {
    return (
      <div className="flex-1 bg-background flex flex-col items-center justify-center p-6 text-center relative isolate">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="max-w-md space-y-6">
          <AlertTriangle className="h-14 w-14 text-red-500 mx-auto" />
          <div>
            <h2 className="text-2xl font-bold text-zinc-150">Connection Error</h2>
            <p className="text-zinc-400 mt-2 text-sm">
              Failed to connect to shared evidence storage. Please check your internet connection or try again.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={() => {
                setStatus("loading");
                getAllEvents().then((data) => {
                  setEvents(data);
                  setSupabaseActive(isSupabaseConfigured());
                  setStatus("loaded");
                }).catch((err) => {
                  console.error("Failed to load events from store:", err);
                  setSupabaseActive(isSupabaseConfigured());
                  setStatus("error");
                });
              }}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors w-full cursor-pointer"
            >
              Retry Connection
              <ArrowRight className="h-3.5 w-3.5 ml-2" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 bg-background relative isolate px-6 py-12 lg:px-8">
      {/* Grid Overlay */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      <div className="mx-auto max-w-7xl">
        <div className="text-center md:text-left border-b border-zinc-900 pb-8 mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2.5 justify-center md:justify-start">
              <Database className="h-6 w-6 text-indigo-500" />
              <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100">
                Telemetry Evidence Vault
              </h1>
            </div>
            <p className="text-sm text-zinc-400 mt-2">
              {supabaseActive
                ? "Real-time feed of tester actions captured as shared Supabase evidence."
                : "Local demo mode active — evidence is stored only in this browser."}
            </p>
          </div>
          <div className="shrink-0 flex items-center justify-center md:justify-end">
            {supabaseActive ? (
              <span className="inline-flex items-center space-x-1.5 text-xs text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20 font-medium">
                <Database className="h-3 w-3" />
                <span>Real shared evidence from Supabase</span>
              </span>
            ) : (
              <span className="inline-flex items-center space-x-1.5 text-xs text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20 font-medium">
                <AlertTriangle className="h-3 w-3 animate-pulse" />
                <span>Local demo mode active — not shared across devices.</span>
              </span>
            )}
          </div>
        </div>

        {events.length === 0 ? (
          /* Empty State when zero total events exist in localStorage */
          <div className="text-center py-20 rounded-xl border border-zinc-900 bg-zinc-950/20 max-w-md mx-auto space-y-6">
            <Activity className="h-12 w-12 text-zinc-800 mx-auto" />
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-zinc-350">Telemetry Stream Empty</h3>
              <p className="text-xs text-zinc-550 leading-relaxed">
                No events have been captured yet. Create a room and start a tester session to generate real user telemetry.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/create"
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors w-full shadow-sm hover:shadow-indigo-500/10"
              >
                Create a Launch Room
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </Link>
            </div>
          </div>
        ) : (
          /* Functional Evidence List and Toolbar */
          <>
            {/* Toolbar: Search and Category Filter Tabs */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-8">
              {/* Search input */}
              <div className="relative max-w-md w-full">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-4 w-4 text-zinc-655" />
                </div>
                <input
                  type="text"
                  placeholder="Search by Room, Session, Event or Payload..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full rounded-lg border border-zinc-800 bg-zinc-950 pl-10 pr-4 py-2 text-sm text-zinc-100 placeholder-zinc-650 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Filter Tabs */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveFilter("All")}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold border transition-all ${
                    activeFilter === "All" 
                      ? "bg-zinc-900 border-zinc-850 text-indigo-400 font-bold" 
                      : "bg-zinc-950 border-zinc-900 text-zinc-400 hover:border-zinc-800"
                  }`}
                >
                  All Events ({events.length})
                </button>
                <button
                  onClick={() => setActiveFilter("Session")}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold border transition-all ${
                    activeFilter === "Session" 
                      ? "bg-zinc-900 border-zinc-850 text-indigo-400 font-bold" 
                      : "bg-zinc-950 border-zinc-900 text-zinc-400 hover:border-zinc-800"
                  }`}
                >
                  Session ({events.filter(e => getEventCategory(e.eventName) === "Session").length})
                </button>
                <button
                  onClick={() => setActiveFilter("Click")}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold border transition-all ${
                    activeFilter === "Click" 
                      ? "bg-zinc-900 border-zinc-850 text-indigo-400 font-bold" 
                      : "bg-zinc-950 border-zinc-900 text-zinc-400 hover:border-zinc-800"
                  }`}
                >
                  Clicks ({events.filter(e => getEventCategory(e.eventName) === "Click").length})
                </button>
                <button
                  onClick={() => setActiveFilter("Friction")}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold border transition-all ${
                    activeFilter === "Friction" 
                      ? "bg-zinc-900 border-zinc-850 text-indigo-400 font-bold" 
                      : "bg-zinc-950 border-zinc-900 text-zinc-400 hover:border-zinc-800"
                  }`}
                >
                  Friction ({events.filter(e => getEventCategory(e.eventName) === "Friction").length})
                </button>
                <button
                  onClick={() => setActiveFilter("Understanding")}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold border transition-all ${
                    activeFilter === "Understanding" 
                      ? "bg-zinc-900 border-zinc-850 text-indigo-400 font-bold" 
                      : "bg-zinc-950 border-zinc-900 text-zinc-400 hover:border-zinc-800"
                  }`}
                >
                  Understanding ({events.filter(e => getEventCategory(e.eventName) === "Understanding").length})
                </button>
                <button
                  onClick={() => setActiveFilter("Completion")}
                  className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold border transition-all ${
                    activeFilter === "Completion" 
                      ? "bg-zinc-900 border-zinc-850 text-indigo-400 font-bold" 
                      : "bg-zinc-950 border-zinc-900 text-zinc-400 hover:border-zinc-800"
                  }`}
                >
                  Completion ({events.filter(e => getEventCategory(e.eventName) === "Completion").length})
                </button>
              </div>
            </div>

            {/* List Grid */}
            {filteredEvents.length === 0 ? (
              <div className="text-center py-16 rounded-xl border border-zinc-900 bg-zinc-950/10">
                <Filter className="h-10 w-10 text-zinc-800 mx-auto" />
                <h3 className="mt-4 text-sm font-semibold text-zinc-350">No matching events</h3>
                <p className="text-xs text-zinc-550 mt-1">Refine your search parameters or select a different filter.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredEvents.map((item) => {
                  const category = getEventCategory(item.eventName);
                  return (
                    <div 
                      key={item.id} 
                      className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 flex flex-col justify-between hover:border-zinc-850 hover:shadow-lg transition-all max-w-full overflow-hidden"
                    >
                      <div className="space-y-4">
                        {/* Header metadata */}
                        <div className="flex items-center justify-between">
                          <div className="space-y-0.5">
                            <span className="block text-[9px] font-mono text-zinc-500 uppercase">Room: {item.roomId}</span>
                            <span className="text-[10px] font-mono text-zinc-400">Sess: {item.sessionId}</span>
                          </div>

                          {/* Event type badge */}
                          <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${
                            category === "Friction" ? "bg-red-500/10 text-red-400 border-red-500/20 shadow-[0_0_8px_rgba(239,68,68,0.1)]" :
                            category === "Click" ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
                            category === "Understanding" ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" :
                            category === "Completion" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                            "bg-amber-500/10 text-amber-400 border-amber-500/20"
                          }`}>
                            {category}
                          </span>
                        </div>

                        {/* Title & Payload */}
                        <div className="space-y-2">
                          <h3 className="text-xs font-bold text-zinc-100 flex items-start">
                            {category === "Friction" && <XCircle className="h-4 w-4 text-red-400 mr-1.5 shrink-0 mt-0.5" />}
                            {category === "Click" && <MousePointer className="h-4 w-4 text-indigo-400 mr-1.5 shrink-0 mt-0.5" />}
                            {category === "Understanding" && <Activity className="h-4 w-4 text-cyan-400 mr-1.5 shrink-0 mt-0.5" />}
                            {category === "Completion" && <Check className="h-4 w-4 text-emerald-400 mr-1.5 shrink-0 mt-0.5" />}
                            {category === "Session" && <Play className="h-4 w-4 text-amber-400 mr-1.5 shrink-0 mt-0.5 fill-amber-400/10" />}
                            <span className="truncate">{item.eventName.replace(/_/g, " ").toUpperCase()}</span>
                          </h3>
                          
                          {item.eventPayload && Object.keys(item.eventPayload).length > 0 && (
                            <pre className="text-[10px] text-zinc-550 font-mono bg-zinc-900/50 p-3 rounded border border-zinc-900 overflow-x-auto whitespace-pre-wrap break-all max-w-full max-h-[140px]">
                              {JSON.stringify(item.eventPayload, null, 2)}
                            </pre>
                          )}
                        </div>
                      </div>

                      {/* Footer relative time and report redirect */}
                      <div className="pt-4 mt-6 border-t border-zinc-900/60 flex items-center justify-between">
                        <div className="flex items-center text-[10px] font-mono text-zinc-500">
                          <Clock className="h-3 w-3 mr-1" />
                          <span>{new Date(item.createdAt).toLocaleString()}</span>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Link
                            href={`/story/${item.roomId}`}
                            className="inline-flex items-center justify-center rounded border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-450 hover:text-indigo-350 transition-colors"
                          >
                            Story
                            <Sparkles className="h-3 w-3 ml-1" />
                          </Link>

                          <Link
                            href={`/report/${item.roomId}`}
                            className="inline-flex items-center justify-center rounded border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors"
                          >
                            Report
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
