"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import LoadingState from "@/components/LoadingState";
import { trackSignalRoomEvent } from "@/lib/analytics/signalroomAnalytics";
import { 
  ArrowLeft, 
  Flame, 
  AlertTriangle, 
  Check, 
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  Shield,
  X,
  Sparkles,
  FileJson,
  Compass,
  FileText
} from "lucide-react";
import { 
  getRoom, 
  calculateReport, 
  isSupabaseConfigured,
  Room, 
  Session, 
  TelemetryEvent,
  ReportMetrics 
} from "@/lib/store";

// Module-level dedup set: prevents story_generated from re-firing on remount
const trackedStoryIds = new Set<string>();

// No static demo datasets

export default function SignalStoryPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);

  // States
  const [isMounted, setIsMounted] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<"loading" | "found" | "not_found" | "error">("loading");
  const [realReport, setRealReport] = useState<ReportMetrics | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [supabaseActive, setSupabaseActive] = useState(true);

  // Replay Modal State
  const [selectedReplaySession, setSelectedReplaySession] = useState<Session | null>(null);
  const [isReplayOpen, setIsReplayOpen] = useState(false);
  const [replayTime, setReplayTime] = useState(0);
  const [replayIsPlaying, setReplayIsPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState<1 | 2 | 5>(1);

  // Playback timer effect
  useEffect(() => {
    if (!replayIsPlaying || !selectedReplaySession) return;
    const maxSeconds = selectedReplaySession.durationSeconds || room?.timeLimitSeconds || 90;
    
    const interval = setInterval(() => {
      setReplayTime((prev) => {
        if (prev >= maxSeconds) {
          setReplayIsPlaying(false);
          return maxSeconds;
        }
        return prev + 1;
      });
    }, 1000 / replaySpeed);
    
    return () => clearInterval(interval);
  }, [replayIsPlaying, selectedReplaySession, replaySpeed, room]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const openReplay = (session: Session) => {
    setSelectedReplaySession(session);
    setReplayTime(0);
    setReplayIsPlaying(true);
    setIsReplayOpen(true);

    // Pendo Track Event: story_replay_started
    trackSignalRoomEvent("story_replay_started", {
      roomId,
      sessionId: session.id,
      testerAlias: session.testerAlias || "",
      durationSeconds: session.durationSeconds || 0,
      productName: room?.productName || "",
      productUrl: room?.productUrl || "",
    });
  };

  useEffect(() => {
    setIsMounted(true);
    setSupabaseActive(isSupabaseConfigured());
  }, []);

  // Fetch Room & Reports Data
  useEffect(() => {
    if (!isMounted) return;
    const fetchData = async () => {
      setStatus("loading");
      try {
        const activeRoom = await getRoom(roomId);
        if (activeRoom) {
          setRoom(activeRoom);
          const report = await calculateReport(roomId);
          setRealReport(report);
          setSupabaseActive(isSupabaseConfigured());
          setStatus("found");

          // Pendo Track Event: story_generated (once per roomId per session)
          if (report && report.sessions.length > 0 && !trackedStoryIds.has(roomId)) {
            trackedStoryIds.add(roomId);
            const sc = report.sessions.length;
            trackSignalRoomEvent("story_generated", {
              roomId,
              sessionsCount: sc,
              completionRate: report.completionRate,
              confusionCount: report.confusionCount,
              totalEvents: report.totalEvents,
              evidenceConfidence: sc >= 5 ? "High" : sc >= 3 ? "Medium" : "Low",
              productName: activeRoom.productName.substring(0, 64),
              storageMode: isSupabaseConfigured() ? "supabase" : "local",
            });
          }

          // Track signal_story_viewed
          if (report) {
            const sc = report.sessions.length;
            const cr = report.completionRate;
            const cc = report.confusionCount;
            let decTitle = "Decision pending";
            if (sc > 0) {
              if (sc === 1 || sc === 2) {
                decTitle = "Early signal — collect more evidence before shipping.";
              } else if (cr < 60 || cc >= 2) {
                decTitle = "Decision: Do not ship yet.";
              } else if (cr >= 80 && cc === 0) {
                decTitle = "Decision: Ship with confidence.";
              } else {
                decTitle = "Decision: Iterate and retest.";
              }
            }
            trackSignalRoomEvent("signal_story_viewed", {
              roomId,
              productName: activeRoom.productName,
              productUrl: activeRoom.productUrl,
              completionRate: cr,
              confusionCount: cc,
              evidenceConfidence: sc >= 5 ? "High" : sc >= 3 ? "Medium" : "Low",
              decisionTitle: decTitle,
            });
          }
        } else {
          setSupabaseActive(isSupabaseConfigured());
          setStatus("not_found");
        }
      } catch (err) {
        console.error("Error fetching story data:", err);
        setSupabaseActive(isSupabaseConfigured());
        setStatus("error");
      }
    };
    fetchData();
  }, [isMounted, roomId]);

  const copyStoryLink = () => {
    if (typeof window === "undefined") return;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const url = `${baseUrl}/story/${roomId}`;
    navigator.clipboard.writeText(url);

    // Pendo Track Event: story_share_link_copied
    trackSignalRoomEvent("story_share_link_copied", {
      roomId,
      storyUrl: url.substring(0, 100),
      productName: room?.productName?.substring(0, 64) || "",
    });

    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (!isMounted || status === "loading") {
    return (
      <LoadingState 
        type="story" 
        title="Building Signal Story..." 
        subtitle="Turning tester behavior into an evidence narrative." 
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
                getRoom(roomId)
                  .then(async (activeRoom) => {
                    if (activeRoom) {
                      setRoom(activeRoom);
                      const report = await calculateReport(roomId);
                      setRealReport(report);
                      setSupabaseActive(isSupabaseConfigured());
                      setStatus("found");
                    } else {
                      setSupabaseActive(isSupabaseConfigured());
                      setStatus("not_found");
                    }
                  })
                  .catch((err) => {
                    console.error("Error loading room:", err);
                    setStatus("error");
                  });
              }}
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors w-full cursor-pointer"
            >
              Retry Connection
              <ArrowLeft className="h-3.5 w-3.5 mr-2" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Room not found state
  if (status === "not_found" || !room) {
    return (
      <div className="flex-1 bg-background flex flex-col items-center justify-center p-6 text-center relative isolate">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="max-w-md space-y-6">
          <AlertTriangle className="h-14 w-14 text-red-500 mx-auto" />
          <div>
            <h2 className="text-2xl font-bold text-zinc-150">Story Room Not Found</h2>
            <p className="text-zinc-400 mt-2 text-sm">
              The launch room with ID <strong className="text-zinc-200 uppercase">&quot;{roomId}&quot;</strong> could not be found in shared evidence storage.
            </p>
          </div>
          <div className="pt-2">
            <Link
              href="/create"
              className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-6 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors w-full"
            >
              Create New Launch Room
              <ArrowRight className="h-3.5 w-3.5 ml-2" />
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const hasRealData = realReport && realReport.sessions.length > 0;
  const activeReport: ReportMetrics = hasRealData
    ? realReport!
    : {
        completionRate: 0,
        avgDurationSeconds: 0,
        confusionCount: 0,
        totalEvents: 0,
        sessions: [],
        events: [],
        feedback: [],
      };

  const sessionsCount = activeReport.sessions.length;
  const completionRate = activeReport.completionRate;
  const confusionCount = activeReport.confusionCount;

  // Release Decision Logic
  let decisionTitle = "";
  let decisionColor = "";
  let decisionExplanation = "";

  if (sessionsCount === 0) {
    decisionTitle = "Decision pending — no tester evidence yet.";
    decisionColor = "border-zinc-800 bg-zinc-950/40 text-zinc-400";
    decisionExplanation = "Send the room link to testers to generate real behavioral evidence.";
  } else if (sessionsCount === 1 || sessionsCount === 2) {
    decisionTitle = "Early signal — collect more evidence before shipping.";
    decisionColor = "border-indigo-500/20 bg-indigo-500/5 text-indigo-400";
    decisionExplanation = "This report is based on fewer than 3 tester sessions, so it should be treated as directional evidence, not a final release decision.";
  } else if (completionRate < 50) {
    decisionTitle = "Decision: Do not ship yet.";
    decisionColor = "border-red-500/20 bg-red-500/5 text-red-450";
    decisionExplanation = "Most testers did not complete the mission successfully.";
  } else if (completionRate >= 80 && confusionCount === 0) {
    decisionTitle = "Decision: Ship with confidence.";
    decisionColor = "border-emerald-500/20 bg-emerald-500/5 text-emerald-400";
    decisionExplanation = "At least 3 tester sessions completed successfully with high completion and no reported confusion.";
  } else {
    decisionTitle = "Decision: Iterate and retest.";
    decisionColor = "border-amber-500/20 bg-amber-500/5 text-amber-400";
    decisionExplanation = `Some testers completed the mission (completion rate: ${completionRate}%), but confusion or CTA friction was detected (${confusionCount} confusion flag(s)).`;
  }

  // Evidence Confidence Logic
  let confidenceValue = "None";
  let confidenceColor = "text-zinc-500";

  if (sessionsCount >= 5) {
    confidenceValue = "High";
    confidenceColor = "text-emerald-400";
  } else if (sessionsCount >= 3) {
    confidenceValue = "Medium";
    confidenceColor = "text-indigo-400";
  } else if (sessionsCount >= 1) {
    confidenceValue = "Low";
    confidenceColor = "text-amber-500";
  }

  // Autopsy calculations
  const ctaFrictionSessions = activeReport.sessions.filter(s => 
    s.couldNotFindCta || 
    activeReport.events.some(e => e.sessionId === s.id && e.eventName === "reaction_cta_missing")
  );
  
  const offerClaritySessions = activeReport.sessions.filter(s => 
    s.offerUnclear || 
    s.confusionReported ||
    activeReport.events.some(e => e.sessionId === s.id && (e.eventName === "reaction_offer_unclear" || e.eventName === "confusion_reported"))
  );
  
  const trustSignalSessions = activeReport.sessions.filter(s => 
    s.pageNotTrustworthy || 
    activeReport.events.some(e => e.sessionId === s.id && e.eventName === "reaction_untrustworthy")
  );

  const ctaQuote = ctaFrictionSessions.find(s => s.feedbackText && s.feedbackText.trim() !== "")?.feedbackText
    || ctaFrictionSessions.find(s => s.confusionReason && s.confusionReason.trim() !== "")?.confusionReason;

  const offerQuote = offerClaritySessions.find(s => s.feedbackText && s.feedbackText.trim() !== "")?.feedbackText
    || offerClaritySessions.find(s => s.confusionReason && s.confusionReason.trim() !== "")?.confusionReason;

  const trustQuote = trustSignalSessions.find(s => s.feedbackText && s.feedbackText.trim() !== "")?.feedbackText
    || trustSignalSessions.find(s => s.confusionReason && s.confusionReason.trim() !== "")?.confusionReason;

  interface AutopsyCard {
    title: string;
    severity: "Low" | "Medium" | "High";
    severityColor: string;
    evidence: string;
    action: string;
    quote?: string;
    sessions: Session[];
  }

  const autopsyCards: AutopsyCard[] = [];

  if (ctaFrictionSessions.length > 0) {
    autopsyCards.push({
      title: "CTA Friction Detected",
      severity: "High",
      severityColor: "border-red-500/20 bg-red-500/5 text-red-400",
      evidence: `${ctaFrictionSessions.length} session(s) flagged that they could not find the primary CTA.`,
      action: "Move the primary CTA above the fold and repeat it after the core benefit.",
      quote: ctaQuote,
      sessions: ctaFrictionSessions
    });
  }

  if (offerClaritySessions.length > 0) {
    autopsyCards.push({
      title: "Offer Clarity Risk",
      severity: "Medium",
      severityColor: "border-amber-500/20 bg-amber-500/5 text-amber-400",
      evidence: `${offerClaritySessions.length} session(s) flagged the offer as unclear or reported confusion.`,
      action: "Rewrite the headline around the user outcome, not the feature.",
      quote: offerQuote,
      sessions: offerClaritySessions
    });
  }

  if (trustSignalSessions.length > 0) {
    autopsyCards.push({
      title: "Trust Signal Risk",
      severity: "Medium",
      severityColor: "border-amber-500/20 bg-amber-500/5 text-amber-400",
      evidence: `${trustSignalSessions.length} session(s) flagged that the page did not feel trustworthy.`,
      action: "Add social proof, guarantee, recognizable credentials, or clearer pricing context.",
      quote: trustQuote,
      sessions: trustSignalSessions
    });
  }

  // Identify strongest break moment pattern
  const strongestFriction = [...autopsyCards].sort((a, b) => b.sessions.length - a.sessions.length).find(f => f.sessions.length > 0);
  let breakMomentSession: Session | null = null;
  let breakMomentEvents: (TelemetryEvent & { elapsedSec: number })[] = [];
  let breakMomentTitle = "";
  let breakMomentDescription = "";
  let breakMomentQuote = "";

  if (strongestFriction && strongestFriction.sessions.length > 0) {
    breakMomentSession = strongestFriction.sessions[0];
    breakMomentTitle = strongestFriction.title;
    breakMomentDescription = strongestFriction.evidence;
    breakMomentQuote = strongestFriction.quote || "";
    breakMomentEvents = activeReport.events
      .filter(e => e.sessionId === breakMomentSession!.id)
      .map(e => {
        const startMs = new Date(breakMomentSession!.startedAt).getTime();
        const eventMs = new Date(e.createdAt).getTime();
        const elapsedSec = Math.max(0, Math.round((eventMs - startMs) / 1000));
        return { ...e, elapsedSec };
      })
      .sort((a, b) => a.elapsedSec - b.elapsedSec)
      .slice(-5); // Last 5 telemetry interactions
  }

  // Strongest Session definition (for replay)
  const completedSessions = activeReport.sessions.filter(s => s.completedMission);
  const strongestSession = completedSessions.length > 0
    ? [...completedSessions].sort((a, b) => a.durationSeconds - b.durationSeconds)[0]
    : activeReport.sessions.length > 0 ? activeReport.sessions[0] : null;

  // Active replay event stream mapping
  const replayEvents = selectedReplaySession 
    ? activeReport.events
        .filter(e => e.sessionId === selectedReplaySession.id)
        .map(e => {
          const startMs = new Date(selectedReplaySession.startedAt).getTime();
          const eventMs = new Date(e.createdAt).getTime();
          const elapsedSec = Math.max(0, Math.round((eventMs - startMs) / 1000));
          return {
            ...e,
            elapsedSec
          };
        })
        .sort((a, b) => a.elapsedSec - b.elapsedSec)
    : [];

  const exportStoryJson = () => {
    const payload = {
      room,
      sessions: activeReport.sessions,
      events: activeReport.events,
      metrics: {
        sessionsCount,
        completionRate,
        confusionCount,
        totalEvents: activeReport.totalEvents,
        evidenceConfidence: confidenceValue,
      },
      decision: {
        title: decisionTitle,
        explanation: decisionExplanation
      },
      frictionAutopsyCards: autopsyCards.map(c => ({
        title: c.title,
        severity: c.severity,
        evidence: c.evidence,
        action: c.action,
        quote: c.quote
      })),
      generatedAt: new Date().toISOString()
    };
    
    const fileName = `signal_story_${roomId}.json`;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    // Pendo Track Event: story_json_exported
    trackSignalRoomEvent("story_json_exported", {
      roomId,
      sessionsCount,
      completionRate,
      totalEvents: activeReport.totalEvents,
      evidenceConfidence: confidenceValue,
      decisionTitle: decisionTitle.substring(0, 64),
      productName: room?.productName?.substring(0, 64) || "",
      fileName,
    });
  };

  return (
    <div className="flex-1 bg-background relative isolate px-6 py-12 lg:px-8">
      {/* Cinematic dark grid overlay */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#1f293708_1px,transparent_1px),linear-gradient(to_bottom,#1f293708_1px,transparent_1px)] bg-[size:5rem_5rem] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_10%,#000_80%,transparent_100%)]" />
      
      {/* Decorative background glow */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
        <div className="relative left-[calc(50%-10rem)] aspect-1155/678 w-[36rem] -translate-x-1/2 rotate-[20deg] bg-gradient-to-tr from-indigo-500/10 to-violet-500/10 opacity-20 sm:left-[calc(50%-20rem)] sm:w-[60rem]" />
      </div>

      <div className="mx-auto max-w-5xl space-y-10">
        
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between border-b border-zinc-900 pb-5">
          <Link href={`/report/${roomId}`} className="inline-flex items-center text-xs font-semibold text-zinc-500 hover:text-zinc-350 transition-colors">
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            Back to Report
          </Link>
          
          <div className="flex items-center space-x-2">
            <span className={`h-2 w-2 rounded-full ${supabaseActive ? 'bg-indigo-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="text-[10px] font-mono uppercase text-zinc-500 font-bold tracking-wider">
              {supabaseActive ? "Live Supabase Connection" : "Local Fallback Session"}
            </span>
          </div>
        </div>

        {!hasRealData ? (
          <div className="rounded-xl border border-zinc-900 bg-zinc-950/20 py-16 px-6 text-center space-y-6 max-w-lg mx-auto">
            <AlertTriangle className="h-12 w-12 text-zinc-700 mx-auto animate-pulse" />
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-lg font-bold text-zinc-350">No Signal Story Available</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                A Signal Story can only be generated after real tester sessions have been recorded.
              </p>
            </div>
            
            <div className="flex items-center justify-center gap-4 max-w-xs mx-auto pt-2">
              <Link
                href={`/report/${roomId}`}
                className="w-full flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                Go to Report
              </Link>
            </div>
          </div>
        ) : (
          <>

        {/* Header Hero Section */}
        <div className="text-center space-y-3 py-4">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/5 px-3 py-1 text-[10px] font-mono uppercase tracking-wider text-indigo-400 shadow-sm shadow-indigo-500/10">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
            <span>Signal Story</span>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-zinc-100 sm:text-5xl bg-gradient-to-r from-zinc-100 via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            Signal Story
          </h1>
          <p className="text-sm text-zinc-450 max-w-lg mx-auto">
            A product story reconstructed from real tester behavior.
          </p>
        </div>

        {/* Product Context Panel */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Target Product</span>
              <h4 className="text-base font-extrabold text-zinc-200">{room.productName}</h4>
              <a 
                href={room.productUrl} 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-indigo-400 hover:text-indigo-300 font-mono inline-flex items-center gap-1 hover:underline"
              >
                {room.productUrl}
                <span>🔗</span>
              </a>
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">Target Tester Persona</span>
              <p className="text-xs text-zinc-400 leading-normal">
                {room.testerPersona || "General landing page launch testing."}
              </p>
            </div>
          </div>
        </div>

        {/* Narrative Flow */}
        <div className="space-y-16 py-6 border-l border-zinc-900/50 pl-4 sm:pl-8 ml-2 sm:ml-4">

          {/* Section 1: What was tested */}
          <div className="relative space-y-4">
            <div className="absolute -left-[29px] sm:-left-[45px] top-1.5 h-6 w-6 rounded-full bg-zinc-950 border border-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-400 font-mono shadow-sm">
              1
            </div>
            <h3 className="text-lg font-extrabold text-zinc-200">What was tested</h3>
            <div className="bg-zinc-950/40 rounded-xl border border-zinc-900 p-5 leading-relaxed text-xs text-zinc-300 space-y-2">
              <p>
                We deployed a 90-second launch trial for <strong className="text-zinc-200">{room.productName}</strong>. 
                Testers were assigned a specific product mission:
              </p>
              <blockquote className="border-l-2 border-indigo-500/40 bg-zinc-950 px-4 py-3 rounded-r-lg font-mono text-zinc-300 leading-normal">
                &ldquo;{room.testerMission}&rdquo;
              </blockquote>
            </div>
          </div>

          {/* Section 2: What happened */}
          <div className="relative space-y-4">
            <div className="absolute -left-[29px] sm:-left-[45px] top-1.5 h-6 w-6 rounded-full bg-zinc-950 border border-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-400 font-mono shadow-sm">
              2
            </div>
            <h3 className="text-lg font-extrabold text-zinc-200">What happened</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">Sessions</span>
                <span className="text-2xl font-black text-zinc-100">{sessionsCount}</span>
              </div>
              <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">Completion</span>
                <span className="text-2xl font-black text-zinc-150">{completionRate}%</span>
              </div>
              <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">Confusion Flags</span>
                <span className="text-2xl font-black text-amber-500">{confusionCount}</span>
              </div>
              <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 text-center">
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">Total Events</span>
                <span className="text-2xl font-black text-indigo-400">{activeReport.totalEvents}</span>
              </div>
              <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 text-center col-span-2 md:col-span-1">
                <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block mb-1">Confidence</span>
                <span className={`text-2xl font-black ${confidenceColor}`}>{confidenceValue}</span>
              </div>
            </div>
          </div>

          {/* Section 3: The break moment */}
          <div className="relative space-y-4">
            <div className="absolute -left-[29px] sm:-left-[45px] top-1.5 h-6 w-6 rounded-full bg-zinc-950 border border-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-400 font-mono shadow-sm">
              3
            </div>
            <h3 className="text-lg font-extrabold text-zinc-200">The break moment</h3>
            
            {strongestFriction ? (
              <div className="space-y-4">
                <div className={`rounded-xl border p-5 space-y-3 bg-zinc-950/40 border-zinc-900`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-red-400 flex items-center gap-1.5">
                      <Flame className="h-4 w-4" />
                      Critical UX Pattern: {breakMomentTitle}
                    </span>
                    <span className="text-[9px] uppercase font-mono text-zinc-500">
                      affected {strongestFriction.sessions.length} session(s)
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    {breakMomentDescription}
                  </p>
                  {breakMomentQuote && (
                    <blockquote className="border-l border-zinc-800 bg-black/15 px-3 py-2 text-xs italic text-zinc-400">
                      &ldquo;{breakMomentQuote}&rdquo;
                    </blockquote>
                  )}
                </div>

                {/* Micro Break-moment Timeline */}
                {breakMomentEvents.length > 0 && (
                  <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-5 space-y-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-550 block">
                      Sequence of Friction (Session {breakMomentSession?.id}):
                    </span>
                    <div className="space-y-2">
                      {breakMomentEvents.map((evt, idx) => (
                        <div key={idx} className="flex items-center gap-3 text-xs leading-normal">
                          <span className="font-mono text-zinc-500 text-[10px] w-10 shrink-0">{formatTime(evt.elapsedSec)}</span>
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            evt.eventName.includes("error") || evt.eventName.includes("missing") || evt.eventName.includes("untrustworthy")
                              ? "bg-red-500"
                              : evt.eventName.includes("completed")
                              ? "bg-emerald-500"
                              : "bg-indigo-400"
                          }`} />
                          <span className="font-mono text-[9px] uppercase text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-850">
                            {evt.eventName.replace(/_/g, " ")}
                          </span>
                          {evt.eventPayload && Object.keys(evt.eventPayload).length > 0 && (
                            <span className="text-[10px] text-zinc-500 truncate max-w-sm">
                              {JSON.stringify(evt.eventPayload)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-6 space-y-2 text-center">
                <p className="text-xs text-zinc-400 font-medium">No critical break moment detected yet.</p>
                <p className="text-[11px] text-zinc-500">Collect more sessions before treating this as a release decision.</p>
              </div>
            )}
          </div>

          {/* Section 4: Release signal */}
          <div className="relative space-y-4">
            <div className="absolute -left-[29px] sm:-left-[45px] top-1.5 h-6 w-6 rounded-full bg-zinc-950 border border-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-400 font-mono shadow-sm">
              4
            </div>
            <h3 className="text-lg font-extrabold text-zinc-200">Release signal</h3>
            
            <div className={`rounded-xl border p-5 space-y-2 ${decisionColor}`}>
              <div className="flex items-center space-x-2.5">
                <span className={`h-2.5 w-2.5 rounded-full ${
                  decisionTitle.includes("Ship with confidence") ? "bg-emerald-500" :
                  decisionTitle.includes("Do not ship yet") ? "bg-red-500" :
                  decisionTitle.includes("pending") ? "bg-zinc-700 animate-pulse" : "bg-amber-500"
                }`} />
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-100">
                  {decisionTitle}
                </h4>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {decisionExplanation}
              </p>
            </div>
          </div>

          {/* Section 5: What SignalRoom can verify */}
          <div className="relative space-y-4">
            <div className="absolute -left-[29px] sm:-left-[45px] top-1.5 h-6 w-6 rounded-full bg-zinc-950 border border-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-400 font-mono shadow-sm">
              5
            </div>
            <h3 className="text-lg font-extrabold text-zinc-200">What SignalRoom can verify</h3>
            
            <div className="bg-zinc-950/40 rounded-xl border border-zinc-900 p-5 text-xs text-zinc-400 space-y-2">
              <ul className="list-disc pl-5 space-y-1.5">
                <li>We verified <strong className="text-zinc-300">{sessionsCount}</strong> tester session(s) launched in real-time.</li>
                <li>We captured <strong className="text-zinc-300">{activeReport.sessions.filter(s => s.completedMission).length}</strong> session completion(s).</li>
                <li>We mapped value proposition clarity: <strong className="text-zinc-300">{activeReport.sessions.filter(s => s.understoodValue).length}</strong> tester(s) understood the main value.</li>
                <li>We tracked CTA clicks: <strong className="text-zinc-300">{activeReport.sessions.filter(s => s.clickedExpectedAction).length}</strong> tester(s) clicked the Call to Action.</li>
                <li>We caught <strong className="text-zinc-300">{activeReport.sessions.filter(s => s.confusionReported).length}</strong> confusion flags with timestamp logs.</li>
                <li>We recorded <strong className="text-zinc-300">{activeReport.totalEvents}</strong> individual interaction telemetry points.</li>
              </ul>
            </div>
          </div>

          {/* Section 6: What SignalRoom cannot claim */}
          <div className="relative space-y-4">
            <div className="absolute -left-[29px] sm:-left-[45px] top-1.5 h-6 w-6 rounded-full bg-zinc-950 border border-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-400 font-mono shadow-sm">
              6
            </div>
            <h3 className="text-lg font-extrabold text-zinc-200">What SignalRoom cannot claim</h3>
            
            <div className="bg-zinc-950/20 rounded-xl border border-zinc-900/50 p-5 text-xs text-zinc-500 space-y-2">
              <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
                <li>This does not prove market demand for this offering.</li>
                <li>This does not replace comprehensive qualitative user research or deep customer interviews.</li>
                <li>This is directional evidence from early tester behavior focused on flow friction, not product-market fit.</li>
              </ul>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="pt-8 border-t border-zinc-900 flex flex-wrap gap-4 justify-center md:justify-between items-center">
          <div className="flex flex-wrap gap-3">
            {strongestSession && (
              <button
                onClick={() => openReplay(strongestSession)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white transition-colors shadow-sm hover:shadow-indigo-500/10"
              >
                <Play className="h-3.5 w-3.5 fill-white" />
                Replay Strongest Session
              </button>
            )}
            
            <button
              onClick={exportStoryJson}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950 hover:bg-zinc-900 px-4 py-2.5 text-xs font-bold text-zinc-400 transition-colors"
            >
              <FileJson className="h-3.5 w-3.5" />
              Export Story JSON
            </button>
          </div>

          <div className="flex gap-3">
            <Link
              href={`/report/${roomId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-900 bg-zinc-950/40 hover:bg-zinc-900 text-xs font-semibold text-zinc-400 px-4 py-2.5 transition-colors"
            >
              <FileText className="h-3.5 w-3.5" />
              Full Report
            </Link>
            <Link
              href="/evidence"
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-900 bg-zinc-950/40 hover:bg-zinc-900 text-xs font-semibold text-zinc-400 px-4 py-2.5 transition-colors"
            >
              <Compass className="h-3.5 w-3.5" />
              Evidence Feed
            </Link>
            <button
              onClick={copyStoryLink}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-900 bg-zinc-950/40 hover:bg-zinc-900 text-xs font-semibold text-zinc-400 px-4 py-2.5 transition-colors"
            >
              {copiedLink ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                  Copied!
                </>
              ) : (
                <>
                  <span>🔗</span>
                  Copy Share Link
                </>
              )}
            </button>
          </div>
        </div>

        {/* Replay Modal Dialog */}
        {isReplayOpen && selectedReplaySession && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-sm animate-fade-in">
            <div className="bg-zinc-955 border border-zinc-850 rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
              {/* Modal Header */}
              <div className="p-6 border-b border-zinc-900 flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <Shield className="h-4 w-4 text-indigo-400" />
                    <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-200">
                      Privacy-Safe Session Replay
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-450 mt-1">
                    Tester: <span className="text-zinc-250 font-semibold">{selectedReplaySession.testerAlias}</span> • Session ID: <span className="font-mono">{selectedReplaySession.id}</span>
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1 font-medium bg-zinc-900/50 px-2 py-0.5 rounded border border-zinc-850 w-fit">
                    <span>🛡️</span> Reconstructed from telemetry event stream. No video/screen was recorded.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setReplayIsPlaying(false);
                    setIsReplayOpen(false);
                  }}
                  className="rounded-lg p-1.5 text-zinc-500 hover:text-zinc-350 hover:bg-zinc-900 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Replay Visualizer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Event timeline */}
                {replayEvents.length === 0 ? (
                  <div className="text-center py-12 text-xs text-zinc-600 font-mono">
                    No telemetry events logged to replay for this session.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {replayEvents.map((evt, idx) => {
                      const isUnlocked = evt.elapsedSec <= replayTime;
                      
                      // Identify error/warning events
                      const isError = evt.eventName.includes("error") || 
                                      evt.eventName.includes("timeout") || 
                                      evt.eventName.includes("aborted") || 
                                      evt.eventName.includes("missing") || 
                                      evt.eventName.includes("untrustworthy");
                      
                      const isCompletion = evt.eventName.includes("completed") || 
                                           evt.eventName.includes("success");
                      
                      const isUnderstanding = evt.eventName.includes("value") || 
                                             evt.eventName.includes("trustworthy") && !isError;

                      return (
                        <div 
                          key={evt.id || idx} 
                          className={`flex items-start gap-4 transition-all duration-300 ${
                            isUnlocked 
                              ? "opacity-100 scale-100" 
                              : "opacity-20 scale-98 pointer-events-none"
                          }`}
                        >
                          <span className="text-[10px] font-mono text-zinc-500 w-10 shrink-0 mt-0.5 text-right">
                            {formatTime(evt.elapsedSec)}
                          </span>
                          <div className="flex flex-col items-center">
                            <div className={`h-3 w-3 rounded-full border-2 ${
                              isUnlocked 
                                ? isError
                                  ? "bg-red-500 border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.4)]" 
                                  : isCompletion
                                  ? "bg-emerald-500 border-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                                  : isUnderstanding
                                  ? "bg-indigo-500 border-indigo-400"
                                  : "bg-indigo-400 border-indigo-300"
                                : "bg-zinc-800 border-zinc-700"
                            }`} />
                            {idx < replayEvents.length - 1 && (
                              <div className="w-0.5 h-10 bg-zinc-900 mt-1" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 bg-zinc-950 border border-zinc-900 rounded-xl p-3 text-xs space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-zinc-200 uppercase tracking-wider text-[9px] font-mono">
                                {evt.eventName.replace(/_/g, " ")}
                              </span>
                              <span className="text-[9px] font-mono text-zinc-650">
                                {isUnlocked ? "committed" : "locked"}
                              </span>
                            </div>
                            {evt.eventPayload && Object.keys(evt.eventPayload).length > 0 && isUnlocked && (
                              <pre className="text-[9px] text-zinc-500 font-mono bg-zinc-900/40 p-2 rounded border border-zinc-900/50 overflow-x-auto max-w-full">
                                {JSON.stringify(evt.eventPayload)}
                              </pre>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Outcome notes at completion */}
                {replayTime >= (selectedReplaySession.durationSeconds || 90) && (
                  <div className="rounded-xl border border-zinc-850 bg-indigo-500/5 p-4 space-y-2.5 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-zinc-550 uppercase tracking-wider">Tester Feedback Details</span>
                      <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded border ${
                        selectedReplaySession.completedMission 
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" 
                          : "bg-red-500/10 text-red-400 border-red-500/25"
                      }`}>
                        {selectedReplaySession.completedMission ? "Completed successfully" : "Timed Out / Aborted"}
                      </span>
                    </div>
                    {selectedReplaySession.feedbackText ? (
                      <p className="text-xs text-zinc-350 leading-relaxed italic">
                        &ldquo;{selectedReplaySession.feedbackText}&rdquo;
                      </p>
                    ) : (
                      <p className="text-xs text-zinc-600 leading-relaxed italic">No comments written by tester.</p>
                    )}
                  </div>
                )}
              </div>

              {/* Controls bar */}
              <div className="p-6 border-t border-zinc-900 bg-zinc-950 space-y-4">
                {/* Progress bar and time indicators */}
                <div className="flex items-center space-x-3">
                  <span className="text-[10px] font-mono text-zinc-400">{formatTime(replayTime)}</span>
                  <input
                    type="range"
                    min={0}
                    max={selectedReplaySession.durationSeconds || room?.timeLimitSeconds || 90}
                    value={replayTime}
                    onChange={(e) => setReplayTime(parseInt(e.target.value, 10))}
                    className="flex-1 accent-indigo-500 bg-zinc-850 h-1 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] font-mono text-zinc-400">
                    {formatTime(selectedReplaySession.durationSeconds || room?.timeLimitSeconds || 90)}
                  </span>
                </div>

                {/* Playback action items */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setReplayIsPlaying(!replayIsPlaying)}
                      className="rounded-lg bg-indigo-600 hover:bg-indigo-500 p-2 text-white transition-colors"
                    >
                      {replayIsPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 fill-white" />}
                    </button>
                    <button
                      onClick={() => {
                        setReplayTime(0);
                        setReplayIsPlaying(true);
                      }}
                      className="rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-850 p-2 text-zinc-400 transition-colors"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Playback speed selector */}
                  <div className="flex items-center space-x-1 border border-zinc-900 rounded-lg p-1 bg-zinc-950">
                    {([1, 2, 5] as const).map((spd) => (
                      <button
                        key={spd}
                        onClick={() => setReplaySpeed(spd)}
                        className={`text-[10px] font-bold px-2 py-1 rounded transition-colors ${
                          replaySpeed === spd 
                            ? "bg-indigo-500/10 text-indigo-400" 
                            : "text-zinc-500 hover:text-zinc-350"
                        }`}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    )}

      </div>
    </div>
  );
}
