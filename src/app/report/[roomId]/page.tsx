"use client";

import { use, useState, useEffect } from "react";
import Link from "next/link";
import LoadingState from "@/components/LoadingState";
import { trackSignalRoomEvent } from "@/lib/analytics/signalroomAnalytics";
import { 
  ArrowLeft, 
  Activity, 
  Flame, 
  AlertTriangle, 
  Copy, 
  Check, 
  Users,
  ArrowRight,
  Play,
  Pause,
  RotateCcw,
  Shield,
  X,
  Sparkles,
  TrendingUp,
  Compass
} from "lucide-react";
import { 
  getRoom, 
  calculateReport, 
  isSupabaseConfigured,
  Room, 
  Session, 
  ReportMetrics 
} from "@/lib/store";

// Module-level dedup set: prevents report_generated from re-firing on remount
const trackedReportIds = new Set<string>();

// No static demo datasets

export default function ReportPage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);

  // Mounting state to prevent Next.js hydration mismatch
  const [isMounted, setIsMounted] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<"loading" | "found" | "not_found" | "error">("loading");
  const [realReport, setRealReport] = useState<ReportMetrics | null>(null);
  
  // Tab selector inside timeline
  const [activeSessionId, setActiveSessionId] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [supabaseActive, setSupabaseActive] = useState(true);

  useEffect(() => {
    setIsMounted(true);
    setSupabaseActive(isSupabaseConfigured());
  }, []);

  // Session Replay States
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

    // Pendo Track Event: replay_session_opened
    const sessionEvents = realReport?.events?.filter(e => e.sessionId === session.id) || [];
    trackSignalRoomEvent("replay_session_opened", {
      roomId,
      sessionId: session.id,
      testerAlias: session.testerAlias?.substring(0, 32) || "",
      durationSeconds: session.durationSeconds,
      completedMission: session.completedMission,
      eventsCount: sessionEvents.length,
      productName: room?.productName || "",
      productUrl: room?.productUrl || "",
    });
  };

  // Fetch data
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
          
          // Update connection status dynamically in case getRoom or calculateReport invoked fallback
          setSupabaseActive(isSupabaseConfigured());
          
          // Default to the first session in the real report logs if available
          if (report && report.sessions.length > 0) {
            setActiveSessionId(report.sessions[0].id);
          }
          setStatus("found");

          // Pendo Track Event: report_generated (once per roomId per session)
          if (report && report.sessions.length > 0 && !trackedReportIds.has(roomId)) {
            trackedReportIds.add(roomId);
            const sc = report.sessions.length;
            trackSignalRoomEvent("report_generated", {
              roomId,
              sessionsCount: sc,
              completionRate: report.completionRate,
              avgDurationSeconds: report.avgDurationSeconds,
              confusionCount: report.confusionCount,
              totalEvents: report.totalEvents,
              evidenceConfidence: sc >= 5 ? "High" : sc >= 3 ? "Medium" : "Low",
              productName: activeRoom.productName.substring(0, 64),
              storageMode: isSupabaseConfigured() ? "supabase" : "local",
            });
          }

          // Track report_viewed
          if (report) {
            const sc = report.sessions.length;
            const cr = report.completionRate;
            const cc = report.confusionCount;
            let decTitle = "Decision pending";
            if (sc > 0) {
              if (sc === 1 || sc === 2) {
                decTitle = "Caution — gathering initial signals.";
              } else if (cr >= 80 && cc === 0) {
                decTitle = "Strong Launch Signal — Go!";
              } else if (cr < 60 || cc >= 2) {
                decTitle = "Critical Friction — Fix Required!";
              } else {
                decTitle = "Mixed Signals — Proceed with caution.";
              }
            }
            trackSignalRoomEvent("report_viewed", {
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
          // If room is null, still update connection status
          setSupabaseActive(isSupabaseConfigured());
          setStatus("not_found");
        }
      } catch (err) {
        console.error("Error fetching report data:", err);
        setSupabaseActive(isSupabaseConfigured());
        setStatus("error");
      }
    };
    fetchData();
  }, [isMounted, roomId]);

  // Handle fallback selector
  useEffect(() => {
    if (realReport && realReport.sessions.length > 0) {
      setActiveSessionId(realReport.sessions[0].id);
    }
  }, [realReport]);

  const copyTesterLink = () => {
    if (typeof window === "undefined") return;
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const url = `${baseUrl}/r/${roomId}`;
    navigator.clipboard.writeText(url);

    // Pendo Track Event: tester_link_copied
    trackSignalRoomEvent("tester_link_copied", {
      roomId,
      testerUrl,
      productName: room?.productName?.substring(0, 64) || "",
    });

    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (!isMounted || status === "loading") {
    return (
      <LoadingState 
        type="report" 
        title="Reconstructing report..." 
        subtitle="Calculating metrics from shared tester evidence." 
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
                      if (report && report.sessions.length > 0) {
                        setActiveSessionId(report.sessions[0].id);
                      }
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
            <h2 className="text-2xl font-bold text-zinc-150">Room Not Found</h2>
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

  // Determine active report values
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

  const activeSession = activeReport.sessions.find((s) => s.id === activeSessionId) || activeReport.sessions[0];
  const sessionEvents = activeReport.events.filter((e) => e.sessionId === activeSessionId);

  const testerUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/r/${roomId}`
    : (typeof window !== "undefined" ? `${window.location.origin}/r/${roomId}` : `/r/${roomId}`);

  const sessionsCount = activeReport.sessions.length;
  const completionRate = activeReport.completionRate;
  const confusionCount = activeReport.confusionCount;
  
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
    decisionColor = "border-red-500/20 bg-red-500/5 text-red-400";
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
  let confidenceSubtitle = "No tester sessions captured.";

  if (sessionsCount >= 5) {
    confidenceValue = "High";
    confidenceColor = "text-emerald-400";
    confidenceSubtitle = "Strong launch signal from 5+ sessions.";
  } else if (sessionsCount >= 3) {
    confidenceValue = "Medium";
    confidenceColor = "text-indigo-400";
    confidenceSubtitle = "Useful signal. More sessions improve confidence.";
  } else if (sessionsCount >= 1) {
    confidenceValue = "Low";
    confidenceColor = "text-amber-500";
    confidenceSubtitle = "Directional only. Collect at least 3 sessions.";
  }

  // Autopsy logic
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
  
  const isStrongLaunch = sessionsCount >= 3 && completionRate >= 80 && confusionCount === 0;

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
    });
  }

  if (isStrongLaunch) {
    autopsyCards.push({
      title: "Strong Launch Signal",
      severity: "Low",
      severityColor: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
      evidence: `Excellent performance across ${sessionsCount} sessions: ${completionRate}% completion rate and 0 confusion triggers.`,
      action: "Ship, but keep monitoring early sessions.",
    });
  }

  // Active Session Replay Events calculation
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

  return (
    <div className="flex-1 bg-background relative isolate px-6 py-12 lg:px-8">
      {/* Grid background */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      {/* Fallback Mode Warning Banner */}
      {!supabaseActive && (
        <div className="mx-auto max-w-7xl mb-8">
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-400">Local database active — evidence is stored only in this browser</h4>
              <p className="text-xs text-zinc-400 mt-1 leading-normal">
                To enable cross-device synchronization and share results, please configure Supabase.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-7xl">
        {/* Back Link */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center text-xs font-semibold text-zinc-500 hover:text-zinc-300">
            <ArrowLeft className="h-3 w-3 mr-1.5" />
            Back to Dashboard
          </Link>
        </div>

        {/* Title Section */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between border-b border-zinc-900 pb-8 mb-10 gap-6">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-2.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-indigo-400">
              <Activity className="h-3 w-3" />
              <span>Telemetry Verified</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-100 mt-2">
              {room.productName} Report
            </h1>
            <p className="text-xs text-zinc-400 mt-2">
              {supabaseActive
                ? "Launch report computed from shared Supabase evidence captured across tester sessions."
                : "Local database active — report computed from this browser only."}
            </p>
          </div>

          {/* Copyable link widget */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-xl p-4 max-w-md w-full">
            <span className="block text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">Share Tester Link:</span>
            <div className="flex rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden">
              <span className="flex-1 px-3 py-2 text-xs text-zinc-400 font-mono truncate self-center">
                {testerUrl}
              </span>
              <button
                onClick={copyTesterLink}
                className="px-3 border-l border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850 transition-colors flex items-center shrink-0"
              >
                {copiedLink ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Signal Story CTA Banner */}
        <div className="mb-8 rounded-xl border border-indigo-500/25 bg-gradient-to-r from-indigo-500/10 via-violet-500/5 to-zinc-950 p-6 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-[0_0_20px_rgba(99,102,241,0.05)]">
          <div className="space-y-1 text-center sm:text-left">
            <h4 className="text-sm font-extrabold text-zinc-100 flex items-center justify-center sm:justify-start gap-1.5">
              <Sparkles className="h-4 w-4 text-indigo-400 animate-pulse" />
              Open Signal Story
            </h4>
            <p className="text-xs text-zinc-400">
              Turn this launch trial into a 60-second evidence narrative.
            </p>
          </div>
          <Link
            href={`/story/${roomId}`}
            onClick={() => {
              trackSignalRoomEvent("signal_story_cta_clicked", {
                roomId,
                productName: room?.productName || "",
                productUrl: room?.productUrl || "",
              });
            }}
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:shadow-indigo-500/20 transition-all"
          >
            Launch Story View
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Empty State when no real sessions exist */}
        {!hasRealData ? (
          <div className="rounded-xl border border-zinc-900 bg-zinc-950/20 py-16 px-6 text-center space-y-6">
            <Users className="h-12 w-12 text-zinc-700 mx-auto" />
            <div className="max-w-md mx-auto space-y-2">
              <h3 className="text-lg font-bold text-zinc-350">No Real Tester Sessions Captured Yet</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Send the tester URL to testers to generate real click events, console warnings, and telemetry metrics.
              </p>
            </div>
            
            <div className="flex items-center justify-center gap-4 max-w-xs mx-auto pt-2">
              <button
                onClick={copyTesterLink}
                className="w-full flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
              >
                Copy Tester Link
              </button>
            </div>
          </div>
        ) : (
          /* Report UI content */
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-10">
              {/* Card 1: Completion */}
              <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Completion Rate</span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-bold text-zinc-100">{activeReport.completionRate}%</span>
                  <span className="text-xs text-zinc-500 font-medium">
                    {activeReport.sessions.filter(s => s.completedMission).length} / {activeReport.sessions.length} finished
                  </span>
                </div>
                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500" style={{ width: `${activeReport.completionRate}%` }} />
                </div>
              </div>

              {/* Card 2: Average Duration */}
              <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Avg. Completion Time</span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-bold text-zinc-100">{activeReport.avgDurationSeconds}s</span>
                  <span className="text-xs text-zinc-500">Limit: {room.timeLimitSeconds}s</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500" 
                    style={{ width: `${Math.min((activeReport.avgDurationSeconds / room.timeLimitSeconds) * 100, 100)}%` }} 
                  />
                </div>
              </div>

              {/* Card 3: Confusion Flagged */}
              <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Confusion Flagged</span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-bold text-amber-500">{activeReport.confusionCount}</span>
                  <span className="text-xs text-zinc-500">Friction triggers</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-amber-500" 
                    style={{ width: `${(activeReport.confusionCount / activeReport.sessions.length) * 100}%` }} 
                  />
                </div>
              </div>

              {/* Card 4: Total Events */}
              <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Telemetry Elements</span>
                <div className="flex items-baseline space-x-2">
                  <span className="text-3xl font-bold text-indigo-400">{activeReport.totalEvents}</span>
                  <span className="text-xs text-zinc-500">Click & error steps</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500" style={{ width: "100%" }} />
                </div>
              </div>

              {/* Card 5: Evidence Confidence */}
              <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Evidence Confidence</span>
                <div className="flex items-baseline space-x-2">
                  <span className={`text-3xl font-bold ${confidenceColor}`}>{confidenceValue}</span>
                </div>
                <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${
                      confidenceValue === "High" ? "bg-emerald-500" :
                      confidenceValue === "Medium" ? "bg-indigo-500" :
                      confidenceValue === "Low" ? "bg-amber-500" : "bg-zinc-800"
                    }`}
                    style={{ 
                      width: 
                        confidenceValue === "High" ? "100%" :
                        confidenceValue === "Medium" ? "65%" :
                        confidenceValue === "Low" ? "35%" : "0%"
                    }} 
                  />
                </div>
                <p className="text-[11px] text-zinc-500 leading-normal">
                  {confidenceSubtitle}
                </p>
              </div>
            </div>

            {/* Release Decision Card */}
            <div className={`rounded-xl border p-6 space-y-3 mb-10 ${decisionColor}`}>
              <div className="flex items-center space-x-2.5">
                {sessionsCount === 0 ? (
                  <div className="h-6 w-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400">
                    <Activity className="h-3 w-3 animate-pulse" />
                  </div>
                ) : decisionTitle.includes("Ship with confidence") ? (
                  <div className="h-6 w-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <Check className="h-3.5 w-3.5" />
                  </div>
                ) : decisionTitle.includes("Do not ship yet") ? (
                  <div className="h-6 w-6 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </div>
                ) : (
                  <div className="h-6 w-6 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </div>
                )}
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-100">
                  {decisionTitle}
                </h3>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed max-w-4xl">
                {decisionExplanation}
              </p>
            </div>

            {/* Friction Autopsy Cards Section */}
            <div className="mb-10 space-y-4">
              <div className="flex items-center space-x-2 text-zinc-400">
                <TrendingUp className="h-4 w-4 text-indigo-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Friction Autopsy Analysis</h3>
              </div>

              {autopsyCards.length === 0 ? (
                <div className="rounded-xl border border-zinc-900 bg-zinc-950/40 p-6 text-center text-xs text-zinc-500">
                  No critical friction patterns detected yet. Collect more tester sessions before making a final release decision.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {autopsyCards.map((card, idx) => (
                    <div key={idx} className={`rounded-xl border p-6 space-y-4 transition-all duration-300 ${card.severityColor}`}>
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-extrabold tracking-tight text-zinc-100">
                          {card.title}
                        </h4>
                        <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                          card.severity === "High" 
                            ? "bg-red-500/10 text-red-400 border-red-500/20" 
                            : card.severity === "Medium"
                            ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                        }`}>
                          {card.severity} Severity
                        </span>
                      </div>
                      <div className="space-y-3">
                        <p className="text-xs text-zinc-350 leading-relaxed">
                          <strong className="text-zinc-200">Evidence:</strong> {card.evidence}
                        </p>
                        <div className="text-xs text-zinc-300 leading-relaxed bg-black/25 p-3 rounded-lg border border-zinc-900">
                          <strong className="text-zinc-200 text-[10px] uppercase font-bold tracking-wider block mb-1 text-indigo-400">Action Plan:</strong>
                          {card.action}
                        </div>
                      </div>
                      {card.quote && (
                        <div className="border-t border-zinc-900/50 pt-3 italic text-zinc-400 text-xs leading-normal">
                          &ldquo;{card.quote}&rdquo;
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Friction hotspots summary */}
            <div className="mb-10 rounded-xl border border-zinc-900 bg-zinc-950/40 p-6 space-y-4">
              <div className="flex items-center space-x-2 text-indigo-400">
                <Flame className="h-5 w-5" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Telemetry Friction Hotspots</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeReport.sessions.filter(s => s.confusionReported).length === 0 ? (
                  <div className="md:col-span-2 rounded-lg border border-zinc-900 bg-zinc-950/50 p-4 text-center text-xs text-zinc-500">
                    No friction/confusion reasons flagged by testers yet.
                  </div>
                ) : (
                  activeReport.sessions.filter(s => s.confusionReported).map((session, idx) => (
                    <div key={idx} className="rounded-lg border border-red-500/10 bg-red-500/5 p-4 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-red-400">Friction Event: {session.testerAlias}</span>
                        <span className="text-[9px] font-mono text-zinc-500 uppercase">{session.id}</span>
                      </div>
                      <p className="text-xs text-zinc-350 leading-normal italic">
                        &ldquo;{session.confusionReason}&rdquo;
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Next actions from this evidence */}
            <div className="mb-10 rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-6 space-y-4">
              <div className="flex items-center space-x-2 text-indigo-400">
                <Compass className="h-5 w-5" />
                <h3 className="text-xs font-bold uppercase tracking-wider">Next actions from this evidence</h3>
              </div>
              <p className="text-xs text-zinc-400 max-w-2xl leading-relaxed">
                Use these dynamic diagnostic workflows to inspect specific behavior patterns, share telemetry data, or reconstruct the user session timeline.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
                {/* Action 1: Open Signal Story */}
                <Link
                  href={`/story/${roomId}`}
                  onClick={() => trackSignalRoomEvent("signal_story_cta_clicked", { roomId })}
                  className="flex flex-col justify-between p-4 rounded-lg border border-zinc-900 bg-zinc-950 hover:border-indigo-500/30 transition-all text-left group"
                >
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200 group-hover:text-indigo-400 transition-colors">Open Signal Story</h4>
                    <p className="text-[10px] text-zinc-500 mt-1 leading-normal">
                      Analyze a narrative behavioral reconstruction of the user sessions.
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold text-indigo-400 flex items-center gap-1 mt-3 font-sans">
                    Launch Story <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>

                {/* Action 2: Replay a session */}
                <button
                  onClick={() => {
                    if (activeSession) {
                      openReplay(activeSession);
                    } else if (activeReport.sessions.length > 0) {
                      openReplay(activeReport.sessions[0]);
                    }
                  }}
                  className="flex flex-col justify-between p-4 rounded-lg border border-zinc-900 bg-zinc-950 hover:border-indigo-500/30 transition-all text-left group cursor-pointer"
                >
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200 group-hover:text-indigo-400 transition-colors">Replay a Session</h4>
                    <p className="text-[10px] text-zinc-500 mt-1 leading-normal">
                      Review a step-by-step interactive playback of telemetry actions.
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold text-indigo-400 flex items-center gap-1 mt-3 font-sans">
                    Open Replay <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </button>

                {/* Action 3: Copy Tester Link */}
                <button
                  onClick={copyTesterLink}
                  className="flex flex-col justify-between p-4 rounded-lg border border-zinc-900 bg-zinc-950 hover:border-indigo-500/30 transition-all text-left group cursor-pointer font-sans"
                >
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200 group-hover:text-indigo-400 transition-colors">Copy Tester Link</h4>
                    <p className="text-[10px] text-zinc-500 mt-1 leading-normal">
                      Share the tester portal to gather more active user telemetry.
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold text-indigo-400 flex items-center gap-1 mt-3">
                    {copiedLink ? "Copied!" : "Copy Link"} <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </button>

                {/* Action 4: Open Evidence Feed */}
                <Link
                  href="/evidence"
                  className="flex flex-col justify-between p-4 rounded-lg border border-zinc-900 bg-zinc-950 hover:border-indigo-500/30 transition-all text-left group"
                >
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200 group-hover:text-indigo-400 transition-colors">Open Evidence Feed</h4>
                    <p className="text-[10px] text-zinc-500 mt-1 leading-normal">
                      Inspect all events and warnings logged from the testing viewport.
                    </p>
                  </div>
                  <span className="text-[10px] font-semibold text-indigo-400 flex items-center gap-1 mt-3 font-sans">
                    View Feed <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </Link>
              </div>
            </div>

            {/* Telemetry log explorer grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Sessions List (Left) */}
              <div className="lg:col-span-1 space-y-4">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block">Tester Sessions</span>
                <div className="space-y-2.5">
                  {activeReport.sessions.map((session) => (
                    <button
                      key={session.id}
                      onClick={() => setActiveSessionId(session.id)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        activeSessionId === session.id 
                          ? "bg-indigo-600/10 border-indigo-500/50" 
                          : "bg-zinc-950 border-zinc-900 hover:border-zinc-800"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-200">{session.testerAlias}</span>
                        <span className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded-full border ${
                          session.completedMission 
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/25" 
                            : "bg-red-500/10 text-red-400 border-red-500/25"
                        }`}>
                          {session.completedMission ? "completed" : "incomplete"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-2.5 text-[10px] text-zinc-500 font-mono">
                        <span>ID: {session.id}</span>
                        <span>Time: {session.durationSeconds}s</span>
                      </div>
                      {session.feedbackText && (
                        <p className="text-xs text-zinc-400 mt-2 line-clamp-2 italic leading-relaxed">
                          &ldquo;{session.feedbackText}&rdquo;
                        </p>
                      )}
                      
                      {/* Replay action */}
                      <div className="mt-3 pt-3 border-t border-zinc-900/50 flex justify-end">
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveSessionId(session.id);
                            openReplay(session);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-bold text-indigo-400 hover:bg-indigo-500/20 transition-colors cursor-pointer"
                        >
                          <Play className="h-2.5 w-2.5 fill-indigo-400" />
                          Replay Session
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Log Timeline Explorer (Right) */}
              <div className="lg:col-span-2 space-y-4">
                {activeSession ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                        Session Steps: {activeSession.testerAlias} ({activeSession.id})
                      </span>
                    </div>

                    <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-6 space-y-4">
                      {sessionEvents.length === 0 ? (
                        <div className="text-center py-10 font-mono text-xs text-zinc-650">
                          No telemetry events logged for this session.
                        </div>
                      ) : (
                        <div className="space-y-4 max-h-[360px] overflow-y-auto pr-2">
                          {sessionEvents.map((log, index) => (
                            <div key={index} className="relative pl-6 pb-4 last:pb-0 border-l border-zinc-900 last:border-l-0">
                              {/* Event Type Dot */}
                              <div className={`absolute -left-1.5 top-0.5 h-3 w-3 rounded-full border ${
                                log.eventName.includes("error") || log.eventName.includes("timeout") || log.eventName.includes("aborted")
                                  ? "bg-red-500 border-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]" 
                                  : log.eventName.includes("completed") || log.eventName.includes("success")
                                  ? "bg-emerald-500 border-emerald-400"
                                  : log.eventName.includes("click")
                                  ? "bg-indigo-500 border-indigo-400"
                                  : "bg-zinc-550 border-zinc-450"
                              }`} />
                              
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="text-xs font-bold text-zinc-200">
                                    {log.eventName.replace(/_/g, " ").toUpperCase()}
                                  </span>
                                  {log.eventPayload && Object.keys(log.eventPayload).length > 0 && (
                                    <pre className="text-[10px] text-zinc-550 font-mono mt-1 bg-zinc-900/50 p-2 rounded border border-zinc-900 overflow-x-auto">
                                      {JSON.stringify(log.eventPayload, null, 2)}
                                    </pre>
                                  )}
                                </div>
                                <span className="text-[10px] font-mono text-zinc-500 shrink-0">
                                  {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Feedback block */}
                    {activeSession.feedbackText && (
                      <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-4 space-y-1">
                        <span className="block text-[10px] font-bold text-zinc-555 uppercase tracking-wider">Tester Feedback Notes:</span>
                        <p className="text-xs text-zinc-300 leading-relaxed italic">
                          &ldquo;{activeSession.feedbackText}&rdquo;
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded-xl border border-zinc-900 bg-zinc-950/20 py-20 text-center text-xs text-zinc-500">
                    Select a tester session to explore logged clicks and timeline.
                  </div>
                )}
              </div>
            </div>
          </>
        )}

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
                  <div className="text-center py-12 text-xs text-zinc-605 font-mono">
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
                              <span className="text-[9px] font-mono text-zinc-600">
                                {isUnlocked ? "committed" : "locked"}
                              </span>
                            </div>
                            {evt.eventPayload && Object.keys(evt.eventPayload).length > 0 && isUnlocked && (
                              <pre className="text-[9px] text-zinc-555 font-mono bg-zinc-900/40 p-2 rounded border border-zinc-900/50 overflow-x-auto max-w-full">
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
                      <span className="text-[10px] font-bold text-zinc-555 uppercase tracking-wider">Tester Feedback Details</span>
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
      </div>
    </div>
  );
}
