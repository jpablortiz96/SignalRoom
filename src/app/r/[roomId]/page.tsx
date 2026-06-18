"use client";

import { use, useState, useEffect, useRef } from "react";
import Link from "next/link";
import LoadingState from "@/components/LoadingState";
import { trackSignalRoomEvent } from "@/lib/analytics/signalroomAnalytics";
import { useRouter } from "next/navigation";
import { 
  Play, 
  Check, 
  AlertTriangle, 
  Clock, 
  MousePointer, 
  Terminal, 
  Activity, 
  ShoppingCart, 
  ArrowRight, 
  ArrowLeft,
  XCircle,
  RefreshCw,
  Globe,
  ExternalLink,
  AlertCircle
} from "lucide-react";
import { 
  getRoom, 
  createSession, 
  updateSession, 
  addEvent, 
  isSupabaseConfigured,
  Room 
} from "@/lib/store";

interface LogEvent {
  time: string;
  type: "system" | "click" | "scroll" | "error" | "input";
  message: string;
}

export default function TesterRoom({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();

  // Mounting state to prevent Next.js hydration mismatch
  const [isMounted, setIsMounted] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<"loading" | "found" | "not_found" | "error">("loading");

  // Tester Identity
  const [testerAlias, setTesterAlias] = useState("");

  // Room states
  const [started, setStarted] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [stuck, setStuck] = useState(false);
  const [timeLeft, setTimeLeft] = useState(90);
  const [stuckReason, setStuckReason] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  
  // Session tracking
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [showConfusionText, setShowConfusionText] = useState(false);
  const [confusionText, setConfusionText] = useState("");
  
  // Interactive Mock Sandbox Product States
  const [cartCount, setCartCount] = useState(0);
  const [checkoutStep, setCheckoutStep] = useState<"catalog" | "cart" | "checkout">("catalog");
  const [couponCode, setCouponCode] = useState("");
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  
  // Telemetry variables
  const lastClickTimeRef = useRef<number>(0);
  const rageClicksRef = useRef<number>(0);

  // Telemetry logs displayed in UI
  const [uiLogs, setUiLogs] = useState<LogEvent[]>([]);
  const [supabaseActive, setSupabaseActive] = useState(true);

  // 1. Set mounted state and generate random default tester alias
  useEffect(() => {
    setIsMounted(true);
    setTesterAlias(`Tester #${Math.floor(Math.random() * 900) + 100}`);
    setSupabaseActive(isSupabaseConfigured());
  }, []);

  // 2. Fetch room data from store on mount
  useEffect(() => {
    if (!isMounted) return;
    setStatus("loading");
    getRoom(roomId)
      .then((activeRoom) => {
        if (activeRoom) {
          setRoom(activeRoom);
          setTimeLeft(activeRoom.timeLimitSeconds);
          setUiLogs([
            { time: "00:00", type: "system", message: `Joined launch room: ${activeRoom.id}` }
          ]);
          setStatus("found");

          // Track tester_room_viewed
          trackSignalRoomEvent("tester_room_viewed", {
            roomId: activeRoom.id,
            productName: activeRoom.productName,
            productUrl: activeRoom.productUrl,
          });
        } else {
          setStatus("not_found");
        }
      })
      .catch((err) => {
        console.error("Error loading room:", err);
        setStatus("error");
      });
  }, [isMounted, roomId]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getElapsedTimeStr = () => {
    if (!room) return "00:00";
    const elapsed = room.timeLimitSeconds - timeLeft;
    return formatTime(elapsed);
  };

  // Push local state log + commit event to database
  const triggerEvent = (type: LogEvent["type"], name: string, payload: Record<string, unknown> = {}, uiMessage: string) => {
    const timeStr = getElapsedTimeStr();
    setUiLogs((prev) => [
      { time: timeStr, type, message: uiMessage },
      ...prev
    ]);

    if (sessionId) {
      addEvent({
        roomId: roomId.toUpperCase(),
        sessionId,
        eventName: name,
        eventPayload: payload,
      }).catch((err) => console.error("Error logging event:", err));
    }
  };

  // Timeout handler
  const handleTimeout = () => {
    if (!sessionId || !room) return;
    triggerEvent("error", "session_timeout", { maxTime: room.timeLimitSeconds }, "Time limit reached. Session terminated.");
    updateSession(sessionId, {
      durationSeconds: room.timeLimitSeconds,
      completedMission: false,
      feedbackText: feedbackText || "Timed out",
    }).catch((err) => console.error("Error updating session timeout:", err));

    // Pendo Track Event: session_timed_out
    trackSignalRoomEvent("session_timed_out", {
      roomId: room.id,
      sessionId,
      timeLimitSeconds: room.timeLimitSeconds,
      productName: room.productName.substring(0, 64),
    });

    setStuck(true);
    setStuckReason("Time ran out before I could finish.");
  };

  // 3. Countdown timer effect
  useEffect(() => {
    if (!started || completed || stuck || timeLeft <= 0 || !room || !sessionId) return;
    
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, completed, stuck, timeLeft, room, sessionId]);

  // Start the mission session
  const handleStart = async () => {
    if (!room) return;
    
    // Create actual session in database
    const sessionName = testerAlias.trim() || "Anonymous Tester";
    try {
      const session = await createSession(room.id, sessionName);
      setSessionId(session.id);
      setStarted(true);

      // Immediate session start log
      const timeStr = "00:00";
      setUiLogs((prev) => [
        { time: timeStr, type: "system", message: `Launch trial started by ${sessionName}` },
        ...prev
      ]);

      // Commit event to DB
      await addEvent({
        roomId: room.id,
        sessionId: session.id,
        eventName: "mission_started",
        eventPayload: { 
          testerAlias: sessionName, 
          timeLimitSeconds: room.timeLimitSeconds,
          mission: room.testerMission 
        },
      });

      // Pendo Track Event: mission_started
      trackSignalRoomEvent("mission_started", {
        roomId: room.id,
        sessionId: session.id,
        testerAlias: sessionName.substring(0, 32),
        timeLimitSeconds: room.timeLimitSeconds,
        productName: room.productName.substring(0, 64),
        storageMode: supabaseActive ? "supabase" : "local",
      });
    } catch (err) {
      console.error("Failed to start session:", err);
    }
  };

  // Open external URL in a new tab
  const handleOpenTargetUrl = () => {
    if (!room) return;
    triggerEvent("system", "target_url_opened", { url: room.productUrl }, `Opened product URL in a new tab: ${room.productUrl}`);

    // Pendo Track Event: target_url_opened
    trackSignalRoomEvent("target_url_opened", {
      roomId: room.id,
      sessionId: sessionId || "",
      targetUrl: room.productUrl.substring(0, 100),
      productName: room.productName.substring(0, 64),
      elapsedTime: room.timeLimitSeconds - timeLeft,
    });

    window.open(room.productUrl, "_blank");
  };

  // Checkbox: Understands the value
  const handleToggleUnderstood = (val: boolean) => {
    setUnderstood(val);
    if (!sessionId) return;
    updateSession(sessionId, { understoodValue: val }).catch(err => console.error(err));
    triggerEvent("system", "value_understood_toggled", { understood: val }, `Toggled value understanding to: ${val ? "Yes" : "No"}`);
  };

  // Button: Tester reported confusion
  const handleReportConfusion = () => {
    setShowConfusionText((prev) => !prev);
  };

  const handleSubmitConfusionReason = () => {
    if (!sessionId || !confusionText.trim()) return;
    updateSession(sessionId, { 
      confusionReported: true, 
      confusionReason: confusionText 
    }).catch(err => console.error(err));
    triggerEvent("error", "confusion_reported", { reason: confusionText }, `Confusion reported: "${confusionText}"`);

    // Pendo Track Event: confusion_reported
    trackSignalRoomEvent("confusion_reported", {
      roomId: room?.id || roomId,
      sessionId,
      confusionReason: confusionText.substring(0, 80),
      productName: room?.productName?.substring(0, 64) || "",
      elapsedTime: room ? room.timeLimitSeconds - timeLeft : 0,
    });

    setShowConfusionText(false);
  };

  // Complete mission successfully
  const handleCompleteMission = async () => {
    if (!sessionId || !room) return;
    const duration = room.timeLimitSeconds - timeLeft;
    try {
      await updateSession(sessionId, {
        completedMission: true,
        completedAt: new Date().toISOString(),
        durationSeconds: duration,
        feedbackText: feedbackText,
      });
      
      // Commit completion event
      await addEvent({
        roomId: room.id,
        sessionId,
        eventName: "mission_completed",
        eventPayload: { durationSeconds: duration, feedback: feedbackText },
      });

      // Pendo Track Event: mission_completed
      trackSignalRoomEvent("mission_completed", {
        roomId: room.id,
        sessionId,
        durationSeconds: duration,
        timeLimitSeconds: room.timeLimitSeconds,
        feedbackText: feedbackText?.substring(0, 80) || "",
        understoodValue: understood,
        productName: room.productName.substring(0, 64),
      });

      setCompleted(true);
      router.push(`/report/${room.id}`);
    } catch (err) {
      console.error("Error completing mission:", err);
      router.push(`/report/${room.id}`);
    }
  };

  // Abort/Stuck submit handler
  const handleStuckSubmit = async () => {
    if (!sessionId || !room) return;
    const duration = room.timeLimitSeconds - timeLeft;
    try {
      await updateSession(sessionId, {
        completedMission: false,
        completedAt: new Date().toISOString(),
        durationSeconds: duration,
        confusionReported: true,
        confusionReason: stuckReason || "Got stuck and gave up.",
        feedbackText: feedbackText,
      });

      // Commit aborted event
      await addEvent({
        roomId: room.id,
        sessionId,
        eventName: "mission_aborted",
        eventPayload: { durationSeconds: duration, reason: stuckReason, feedback: feedbackText },
      });

      // Pendo Track Event: mission_aborted
      trackSignalRoomEvent("mission_aborted", {
        roomId: room.id,
        sessionId,
        durationSeconds: duration,
        timeLimitSeconds: room.timeLimitSeconds,
        stuckReason: (stuckReason || "").substring(0, 80),
        feedbackText: feedbackText?.substring(0, 80) || "",
        productName: room.productName.substring(0, 64),
      });

      router.push(`/report/${room.id}`);
    } catch (err) {
      console.error("Error submitting stuck feedback:", err);
      router.push(`/report/${room.id}`);
    }
  };

  // Local sandbox telemetry click logger
  const trackSandboxClick = (element: string, e: React.MouseEvent) => {
    if (!started || completed || stuck) return;
    
    const now = Date.now();
    const diff = now - lastClickTimeRef.current;
    lastClickTimeRef.current = now;

    if (diff < 500) {
      rageClicksRef.current += 1;
      if (rageClicksRef.current >= 3) {
        triggerEvent(
          "error", 
          "sandbox_rage_clicks", 
          { element, x: Math.round(e.clientX), y: Math.round(e.clientY) },
          `Rage clicks detected on [${element}]`
        );

        // Pendo Track Event: rage_clicks_detected
        trackSignalRoomEvent("rage_clicks_detected", {
          roomId: room?.id || roomId,
          sessionId: sessionId || "",
          element: element.substring(0, 64),
          clickX: Math.round(e.clientX),
          clickY: Math.round(e.clientY),
          productName: room?.productName?.substring(0, 64) || "",
        });

        rageClicksRef.current = 0;
      }
    } else {
      rageClicksRef.current = 0;
    }

    triggerEvent("click", "sandbox_click", { element }, `Clicked: "${element}"`);
  };

  const handleAddToCart = (item: string, e: React.MouseEvent) => {
    trackSandboxClick(`Button: Add ${item} to Cart`, e);
    setCartCount((prev) => prev + 1);
  };

  const handleCouponSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    triggerEvent("input", "sandbox_input", { couponApplied: couponCode }, `Entered coupon code: "${couponCode}"`);
    const isValid = couponCode.toUpperCase() === "WELCOME10";
    if (isValid) {
      triggerEvent("system", "sandbox_coupon_success", { code: "WELCOME10" }, "Coupon 'WELCOME10' applied successfully!");
      alert("Coupon 'WELCOME10' applied! Check your cart discount.");
    } else {
      triggerEvent("error", "sandbox_coupon_error", { invalidCode: couponCode }, `Invalid coupon code attempt: "${couponCode}"`);
      alert("Invalid coupon code.");
    }

    // Pendo Track Event: coupon_code_submitted
    trackSignalRoomEvent("coupon_code_submitted", {
      roomId: room?.id || roomId,
      sessionId: sessionId || "",
      couponCode: couponCode.substring(0, 32),
      isValid,
      productName: room?.productName?.substring(0, 64) || "",
    });
  };

  const handleCheckoutSubmit = (e: React.MouseEvent) => {
    trackSandboxClick("Button: Complete Checkout", e);
    setIsProcessingCheckout(true);
    setCheckoutError(null);
    triggerEvent("system", "sandbox_checkout_submit", {}, "Submitting purchase checkout...");

    setTimeout(() => {
      setIsProcessingCheckout(false);
      setCheckoutError("Error: API request timed out (504 Gateway Timeout). Please try again.");
      triggerEvent("error", "sandbox_checkout_timeout", { code: 504 }, "POST /api/checkout - 504 Gateway Timeout");

      // Pendo Track Event: sandbox_checkout_attempted
      trackSignalRoomEvent("sandbox_checkout_attempted", {
        roomId: room?.id || roomId,
        sessionId: sessionId || "",
        cartCount,
        cartTotal: 149 * cartCount,
        errorCode: 504,
        productName: room?.productName?.substring(0, 64) || "",
      });
    }, 1200);
  };

  // Loading state during SSR hook synchronization
  if (!isMounted || status === "loading") {
    return (
      <LoadingState 
        type="room" 
        title="Preparing launch trial..." 
        subtitle="Fetching mission details and telemetry workspace." 
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
                  .then((activeRoom) => {
                    if (activeRoom) {
                      setRoom(activeRoom);
                      setTimeLeft(activeRoom.timeLimitSeconds);
                      setUiLogs([
                        { time: "00:00", type: "system", message: `Joined launch room: ${activeRoom.id}` }
                      ]);
                      setStatus("found");
                    } else {
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
              <RefreshCw className="h-3.5 w-3.5 ml-2 animate-spin-slow" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not Found State
  if (status === "not_found" || !room) {
    return (
      <div className="flex-1 bg-background flex flex-col items-center justify-center p-6 text-center relative isolate">
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
        <div className="max-w-md space-y-6">
          <AlertCircle className="h-14 w-14 text-red-500 mx-auto" />
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

  return (
    <div className="flex-1 flex flex-col md:grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-900 bg-background">
      
      {/* LEFT PANEL: INSTRUCTIONS & EVIDENCE CAPTURE */}
      <div className="p-6 flex flex-col justify-between bg-zinc-950/40 md:col-span-1 space-y-6 overflow-y-auto">
        
        {/* Supabase Warning Banner */}
        {!supabaseActive && (
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 flex items-start space-x-2 shrink-0">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-zinc-400 leading-normal">
              <strong>Local demo mode active</strong> — evidence is stored only in this browser.
            </p>
          </div>
        )}

        {/* Mission Setup */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Launch Trial</span>
            <span className="flex items-center space-x-1.5 text-xs text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">
              <Activity className="h-3 w-3 animate-pulse" />
              <span>Telemetry Active</span>
            </span>
          </div>

          <div>
            <h2 className="text-xl font-bold text-zinc-100">{room.productName}</h2>
            <span className="inline-block text-[10px] font-mono text-zinc-500 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded uppercase mt-1">
              Room ID: {room.id}
            </span>
          </div>

          {/* Persona Card */}
          <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-4 space-y-1">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Your Tester Persona:</span>
            <p className="text-xs text-zinc-400 leading-normal italic">
              &ldquo;{room.testerPersona}&rdquo;
            </p>
          </div>

          {/* Objective details */}
          <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-4 space-y-2">
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">YOUR MISSION OBJECTIVE:</span>
            <p className="text-xs text-zinc-200 font-medium leading-relaxed">
              {room.testerMission}
            </p>
          </div>
        </div>

        {/* Start Mission Input & CTA Overlay */}
        {!started && (
          <div className="space-y-4 pt-4 border-t border-zinc-900">
            <div>
              <label htmlFor="alias" className="block text-xs font-semibold text-zinc-400 uppercase mb-1">
                Your Alias / Nickname
              </label>
              <input
                type="text"
                id="alias"
                value={testerAlias}
                onChange={(e) => setTesterAlias(e.target.value)}
                placeholder="e.g. Tester #42"
                className="w-full rounded border border-zinc-850 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-indigo-600"
              />
            </div>
            <button
              onClick={handleStart}
              className="flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-3 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors w-full"
            >
              <Play className="h-3.5 w-3.5 mr-2 fill-white" />
              Start 90s Mission
            </button>
          </div>
        )}

        {/* Live capture interactions */}
        {started && !completed && !stuck && (
          <div className="space-y-4 pt-4 border-t border-zinc-900">
            {/* Timer card */}
            <div className="flex items-center justify-between bg-zinc-900/40 border border-zinc-900 rounded-lg p-3">
              <div className="flex items-center space-x-2">
                <Clock className={`h-4 w-4 ${timeLeft <= 20 ? "text-red-400 animate-pulse" : "text-indigo-400"}`} />
                <span className="text-xs text-zinc-400">Time remaining:</span>
              </div>
              <span className={`text-base font-mono font-bold ${timeLeft <= 20 ? "text-red-400" : "text-zinc-150"}`}>
                {formatTime(timeLeft)}
              </span>
            </div>

            {/* Target URL link button */}
            <button
              onClick={handleOpenTargetUrl}
              className="flex items-center justify-center rounded-lg border border-zinc-850 bg-zinc-950 text-zinc-300 hover:bg-zinc-900 px-4 py-2.5 text-xs font-semibold transition-colors w-full"
            >
              <Globe className="h-4 w-4 mr-2 text-zinc-400" />
              Open Target Product site
              <ExternalLink className="h-3 w-3 ml-1.5 text-zinc-500" />
            </button>

            {/* Checkbox: Value Understood */}
            <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-3 flex items-start space-x-3">
              <input
                type="checkbox"
                id="understood"
                checked={understood}
                onChange={(e) => handleToggleUnderstood(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-800 bg-zinc-900 text-indigo-600 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="understood" className="text-xs text-zinc-300 select-none cursor-pointer">
                I understand what this product does
              </label>
            </div>

            {/* Button: Reported confusion */}
            <div className="space-y-2">
              <button
                onClick={handleReportConfusion}
                className="flex items-center justify-between rounded-lg border border-zinc-900 bg-zinc-950 hover:bg-zinc-900 px-4 py-2.5 text-xs text-zinc-300 transition-colors w-full"
              >
                <span className="flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2 text-amber-500" />
                  I feel confused
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">Flag Friction</span>
              </button>

              {showConfusionText && (
                <div className="p-3 border border-zinc-900 bg-zinc-950 rounded-lg space-y-2">
                  <textarea
                    rows={2}
                    value={confusionText}
                    onChange={(e) => setConfusionText(e.target.value)}
                    placeholder="Briefly state what confused you..."
                    className="w-full rounded border border-zinc-850 bg-zinc-950 p-2 text-xs text-zinc-150 focus:outline-none focus:border-indigo-600 resize-none"
                  />
                  <button
                    onClick={handleSubmitConfusionReason}
                    disabled={!confusionText.trim()}
                    className="rounded bg-indigo-600 hover:bg-indigo-500 text-[10px] font-semibold text-white px-2.5 py-1 disabled:opacity-50 transition-colors"
                  >
                    Submit Friction Event
                  </button>
                </div>
              )}
            </div>

            {/* Textarea: Feedback */}
            <div className="space-y-1.5">
              <label htmlFor="feedback" className="block text-xs font-semibold text-zinc-400 uppercase">
                General Tester Feedback
              </label>
              <textarea
                id="feedback"
                rows={2}
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                onBlur={() => {
                  if (sessionId) updateSession(sessionId, { feedbackText });
                }}
                placeholder="Any bugs, layout shifts, or general friction remarks..."
                className="w-full rounded border border-zinc-850 bg-zinc-950 p-2 text-xs text-zinc-150 focus:outline-none focus:border-indigo-600 resize-none"
              />
            </div>

            {/* CTA Final */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleCompleteMission}
                className="flex items-center justify-center rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white px-4 py-3 transition-colors"
              >
                <Check className="h-4 w-4 mr-1.5" />
                Complete Mission
              </button>
              <button
                onClick={() => setStuck(true)}
                className="flex items-center justify-center rounded-lg bg-red-600/10 border border-red-500/20 text-red-400 hover:bg-red-600/20 px-4 py-3 text-xs font-semibold transition-colors"
              >
                <AlertTriangle className="h-4 w-4 mr-1.5" />
                I Got Stuck
              </button>
            </div>
          </div>
        )}

        {/* Telemetry log stream */}
        {started && (
          <div className="flex-1 flex flex-col space-y-2.5 pt-4 border-t border-zinc-900 min-h-[160px] md:min-h-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 block">Active Telemetry Logs</span>
            <div className="flex-1 bg-zinc-950 border border-zinc-900 rounded-lg p-3 font-mono text-[10px] space-y-2 overflow-y-auto max-h-[160px] md:max-h-[200px] flex flex-col-reverse">
              {uiLogs.map((log, index) => (
                <div key={index} className="flex items-start justify-between border-b border-zinc-900/40 pb-1.5 last:border-b-0">
                  <div className="flex items-start space-x-1.5 max-w-[85%]">
                    {log.type === "system" && <Activity className="h-3 w-3 text-zinc-400 mt-0.5" />}
                    {log.type === "click" && <MousePointer className="h-3 w-3 text-indigo-400 mt-0.5" />}
                    {log.type === "error" && <XCircle className="h-3 w-3 text-red-400 mt-0.5" />}
                    {log.type === "input" && <Terminal className="h-3 w-3 text-amber-400 mt-0.5" />}
                    <span className={`leading-normal ${
                      log.type === "error" ? "text-red-400 font-medium" : 
                      log.type === "click" ? "text-indigo-300" : 
                      log.type === "input" ? "text-amber-200" : "text-zinc-400"
                    }`}>
                      {log.message}
                    </span>
                  </div>
                  <span className="text-zinc-600 shrink-0">{log.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT PANEL: INTERACTIVE SANDBOX MOCK PRODUCT */}
      <div className="md:col-span-2 flex flex-col bg-zinc-950 relative min-h-[500px]">
        
        {/* Stuck Overlay */}
        {stuck && (
          <div className="absolute inset-0 bg-background/98 z-20 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm">
            <div className="max-w-md space-y-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-red-500/10 text-red-400 border border-red-500/20">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-zinc-150">Report Friction & Close Session</h3>
                <p className="text-sm text-zinc-400">
                  Describe what went wrong or why you were blocked from finishing:
                </p>
              </div>

              <div className="space-y-3 text-left">
                <label className="block text-xs font-semibold text-zinc-400 uppercase">Friction Details:</label>
                <textarea
                  value={stuckReason}
                  onChange={(e) => setStuckReason(e.target.value)}
                  rows={3}
                  className="block w-full rounded-lg border border-zinc-850 bg-zinc-950 px-3 py-2.5 text-xs text-zinc-100 focus:border-indigo-500 focus:outline-none"
                  placeholder="e.g. The payment button timed out, or I couldn't locate the cart."
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  onClick={() => {
                    setStuck(false);
                    setTimeLeft(room.timeLimitSeconds);
                    setCheckoutStep("catalog");
                    setCartCount(0);
                    setCheckoutError(null);
                    triggerEvent("system", "session_restart", {}, "Tester reset the sandbox session.");
                  }}
                  className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-xs font-semibold text-zinc-400 hover:bg-zinc-900 transition-colors"
                >
                  Restart Timer
                </button>
                <button
                  onClick={handleStuckSubmit}
                  className="flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors"
                >
                  Submit & Redirect
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Start Trial Splash overlay */}
        {!started && (
          <div className="absolute inset-0 bg-background/98 z-10 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm">
            <div className="max-w-md space-y-6">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Globe className="h-6 w-6" />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold text-zinc-100">Launch Trial Ready</h3>
                <p className="text-sm text-zinc-400">
                  Start the mission to capture real tester behavior, timing, confusion, and feedback.
                </p>
                <p className="text-xs text-zinc-500 mt-2">
                  Please input your alias on the left control panel and click **Start 90s Mission** to begin.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Browser Topbar */}
        <div className="border-b border-zinc-900 bg-zinc-900/30 px-4 py-2.5 flex items-center space-x-3 shrink-0">
          <div className="flex space-x-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-800" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-800" />
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-800" />
          </div>
          <div className="flex-1 bg-zinc-950 border border-zinc-850 rounded px-3 py-1 flex items-center justify-between text-[11px] font-mono text-zinc-450">
            <div className="flex items-center space-x-2">
              <Globe className="h-3 w-3 text-zinc-650" />
              <span>{room.productUrl}</span>
            </div>
            <RefreshCw className="h-3 w-3 text-zinc-600 hover:text-zinc-400 cursor-pointer" />
          </div>
        </div>

        {/* Mission Evidence Panel & Sandbox Shop */}
        <div className="flex-1 bg-zinc-900/10 p-6 flex flex-col justify-start space-y-6 overflow-y-auto">
          
          {/* Main Mission Evidence Panel Card */}
          <div className="w-full max-w-2xl mx-auto rounded-xl border border-zinc-850 bg-zinc-950 p-6 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
              <div>
                <h3 className="text-base font-semibold text-zinc-100 flex items-center">
                  <Globe className="h-4 w-4 mr-2 text-indigo-400" />
                  Mission Target: {room.productName}
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  You are evaluating an external website. To complete the mission, open the target site in a new tab.
                </p>
              </div>
            </div>

            {/* Glowing CTA to open target site */}
            <div className="bg-zinc-900/40 rounded-lg border border-zinc-900 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Target Product URL</span>
                <span className="text-xs font-mono text-indigo-300 break-all">{room.productUrl}</span>
              </div>
              <button
                onClick={handleOpenTargetUrl}
                className="inline-flex items-center justify-center rounded-lg bg-indigo-600 hover:bg-indigo-500 px-5 py-2.5 text-xs font-semibold text-white transition-all shadow-md shadow-indigo-600/15 hover:shadow-indigo-600/35 border border-indigo-500/20 shrink-0"
              >
                <span>Open Target Site</span>
                <ExternalLink className="h-3.5 w-3.5 ml-2" />
              </button>
            </div>

            {/* Security Notice */}
            <div className="rounded-lg border border-zinc-900/60 bg-zinc-950 p-3.5 flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-zinc-400 leading-normal">
                <strong>Why a new tab?</strong> Modern websites block embedding inside other applications (via security headers like X-Frame-Options). Opening the site in a new tab guarantees it loads correctly. Leave this tab open to record your feedback!
              </p>
            </div>

            {/* Real-Time Tester Reactions Console */}
            <div className="border-t border-zinc-900 pt-5 space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Real-Time Tester Reactions
                </h4>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  Click these reaction buttons to log direct evidence of your experience to the builder dashboard.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* I found the main value */}
                <button
                  onClick={() => {
                    handleToggleUnderstood(true);
                    triggerEvent("system", "reaction_value_found", { understoodValue: true }, "Reaction: Found the main value proposition");
                    
                    // Track specific action
                    trackSignalRoomEvent("value_found", {
                      roomId: room.id,
                      sessionId: sessionId || "",
                      productName: room.productName,
                      productUrl: room.productUrl,
                    });
                    
                    // Refactor existing
                    trackSignalRoomEvent("tester_reaction_submitted", {
                      roomId: room.id,
                      sessionId: sessionId || "",
                      reactionType: "value_found",
                      productName: room.productName.substring(0, 64),
                      elapsedTime: room.timeLimitSeconds - timeLeft,
                    });
                  }}
                  className="flex items-center space-x-2.5 rounded-lg border border-zinc-900 bg-zinc-950 hover:bg-zinc-900/65 px-4 py-3 text-left text-xs font-medium text-zinc-200 transition-colors"
                >
                  <span className="text-base">💡</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-200">I found the main value</p>
                    <p className="text-[10px] text-zinc-500">Log value clarity</p>
                  </div>
                </button>

                {/* I found the CTA */}
                <button
                  onClick={() => {
                    if (sessionId) updateSession(sessionId, { clickedExpectedAction: true });
                    triggerEvent("click", "reaction_cta_found", { clickedExpectedAction: true }, "Reaction: Found the expected Call to Action");
                    
                    // Track specific action
                    trackSignalRoomEvent("cta_found", {
                      roomId: room.id,
                      sessionId: sessionId || "",
                      productName: room.productName,
                      productUrl: room.productUrl,
                    });

                    // Refactor existing
                    trackSignalRoomEvent("tester_reaction_submitted", {
                      roomId: room.id,
                      sessionId: sessionId || "",
                      reactionType: "cta_found",
                      productName: room.productName.substring(0, 64),
                      elapsedTime: room.timeLimitSeconds - timeLeft,
                    });
                  }}
                  className="flex items-center space-x-2.5 rounded-lg border border-zinc-900 bg-zinc-950 hover:bg-zinc-900/65 px-4 py-3 text-left text-xs font-medium text-zinc-200 transition-colors"
                >
                  <span className="text-base">🎯</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-200">I found the CTA</p>
                    <p className="text-[10px] text-zinc-500">Log action locator success</p>
                  </div>
                </button>

                {/* I could not find the CTA */}
                <button
                  onClick={() => {
                    if (sessionId) updateSession(sessionId, { couldNotFindCta: true });
                    triggerEvent("error", "reaction_cta_missing", {}, "Reaction: Could not find the Call to Action");
                    
                    // Track specific action
                    trackSignalRoomEvent("cta_not_found", {
                      roomId: room.id,
                      sessionId: sessionId || "",
                      productName: room.productName,
                      productUrl: room.productUrl,
                    });

                    // Refactor existing
                    trackSignalRoomEvent("tester_reaction_submitted", {
                      roomId: room.id,
                      sessionId: sessionId || "",
                      reactionType: "cta_missing",
                      productName: room.productName.substring(0, 64),
                      elapsedTime: room.timeLimitSeconds - timeLeft,
                    });
                  }}
                  className="flex items-center space-x-2.5 rounded-lg border border-zinc-900 bg-zinc-950 hover:bg-zinc-900/65 px-4 py-3 text-left text-xs font-medium text-zinc-200 transition-colors"
                >
                  <span className="text-base">🔍</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-200">I could not find the CTA</p>
                    <p className="text-[10px] text-zinc-500">Log CTA discoverability issue</p>
                  </div>
                </button>

                {/* The offer is unclear */}
                <button
                  onClick={() => {
                    if (sessionId) updateSession(sessionId, { offerUnclear: true });
                    triggerEvent("error", "reaction_offer_unclear", {}, "Reaction: The offer/pricing is unclear");
                    
                    // Track specific action
                    trackSignalRoomEvent("offer_unclear", {
                      roomId: room.id,
                      sessionId: sessionId || "",
                      productName: room.productName,
                      productUrl: room.productUrl,
                    });

                    // Refactor existing
                    trackSignalRoomEvent("tester_reaction_submitted", {
                      roomId: room.id,
                      sessionId: sessionId || "",
                      reactionType: "offer_unclear",
                      productName: room.productName.substring(0, 64),
                      elapsedTime: room.timeLimitSeconds - timeLeft,
                    });
                  }}
                  className="flex items-center space-x-2.5 rounded-lg border border-zinc-900 bg-zinc-950 hover:bg-zinc-900/65 px-4 py-3 text-left text-xs font-medium text-zinc-200 transition-colors"
                >
                  <span className="text-base">❓</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-200">The offer is unclear</p>
                    <p className="text-[10px] text-zinc-500">Log proposition confusion</p>
                  </div>
                </button>

                {/* The page feels trustworthy */}
                <button
                  onClick={() => {
                    if (sessionId) updateSession(sessionId, { pageTrustworthy: true });
                    triggerEvent("system", "reaction_trustworthy", { trust: "high" }, "Reaction: The page feels trustworthy");
                    
                    // Track specific action
                    trackSignalRoomEvent("trust_positive", {
                      roomId: room.id,
                      sessionId: sessionId || "",
                      productName: room.productName,
                      productUrl: room.productUrl,
                    });

                    // Refactor existing
                    trackSignalRoomEvent("tester_reaction_submitted", {
                      roomId: room.id,
                      sessionId: sessionId || "",
                      reactionType: "trustworthy",
                      productName: room.productName.substring(0, 64),
                      elapsedTime: room.timeLimitSeconds - timeLeft,
                    });
                  }}
                  className="flex items-center space-x-2.5 rounded-lg border border-zinc-900 bg-zinc-950 hover:bg-zinc-900/65 px-4 py-3 text-left text-xs font-medium text-zinc-200 transition-colors"
                >
                  <span className="text-base">🛡️</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-200">The page feels trustworthy</p>
                    <p className="text-[10px] text-zinc-500">Log high credibility perception</p>
                  </div>
                </button>

                {/* The page does not feel trustworthy */}
                <button
                  onClick={() => {
                    if (sessionId) updateSession(sessionId, { pageNotTrustworthy: true });
                    triggerEvent("error", "reaction_untrustworthy", { trust: "low" }, "Reaction: The page does not feel trustworthy");
                    
                    // Track specific action
                    trackSignalRoomEvent("trust_negative", {
                      roomId: room.id,
                      sessionId: sessionId || "",
                      productName: room.productName,
                      productUrl: room.productUrl,
                    });

                    // Refactor existing
                    trackSignalRoomEvent("tester_reaction_submitted", {
                      roomId: room.id,
                      sessionId: sessionId || "",
                      reactionType: "untrustworthy",
                      productName: room.productName.substring(0, 64),
                      elapsedTime: room.timeLimitSeconds - timeLeft,
                    });
                  }}
                  className="flex items-center space-x-2.5 rounded-lg border border-zinc-900 bg-zinc-950 hover:bg-zinc-900/65 px-4 py-3 text-left text-xs font-medium text-zinc-200 transition-colors"
                >
                  <span className="text-base">⚠️</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-zinc-200">The page does not feel trustworthy</p>
                    <p className="text-[10px] text-zinc-500">Log low credibility flag</p>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* Optional Interactive Mock Sandbox Shop in collapsed details */}
          <details className="w-full max-w-2xl mx-auto border border-zinc-900 bg-zinc-950/40 rounded-xl overflow-hidden group">
            <summary className="px-6 py-4 flex items-center justify-between text-xs font-semibold text-zinc-500 hover:text-zinc-350 cursor-pointer select-none border-b border-transparent group-open:border-zinc-900 transition-colors">
              <span className="flex items-center">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Optional Interaction Sandbox — Sample Demo Data
              </span>
              <span className="text-[10px] text-zinc-650 font-mono group-open:hidden">Click to Expand</span>
              <span className="text-[10px] text-zinc-650 font-mono hidden group-open:inline">Click to Collapse</span>
            </summary>
            
            <div className="p-6 bg-zinc-950">
              <div className="w-full rounded-xl border border-zinc-850 bg-zinc-950 shadow-lg overflow-hidden">
                {/* Header of sandbox app */}
                <div className="border-b border-zinc-900 bg-zinc-950/80 px-6 py-4 flex items-center justify-between">
                  <span className="font-bold text-sm tracking-tight text-indigo-400 font-mono">SandboxStore</span>
                  <div className="flex items-center space-x-4">
                    <button 
                      onClick={(e) => {
                        trackSandboxClick("Nav: Shop Products", e);
                        setCheckoutStep("catalog");
                      }}
                      className={`text-xs ${checkoutStep === "catalog" ? "text-indigo-400" : "text-zinc-400 hover:text-zinc-200"}`}
                    >
                      Shop
                    </button>
                    <button 
                      onClick={(e) => {
                        trackSandboxClick("Nav: View Cart", e);
                        setCheckoutStep("cart");
                      }}
                      className="relative text-zinc-400 hover:text-zinc-200"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      {cartCount > 0 && (
                        <span className="absolute -top-1.5 -right-2 bg-indigo-600 text-[9px] font-bold text-white h-3.5 w-3.5 rounded-full flex items-center justify-center">
                          {cartCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>

                {/* Catalog */}
                {checkoutStep === "catalog" && (
                  <div className="p-6 space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-200">Products Catalog</h3>
                      <p className="text-xs text-zinc-500">Interact to test this sandbox telemetry.</p>
                    </div>

                    <div className="space-y-4">
                      {/* Premium Keyboard */}
                      <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-4 flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-200">Premium Mechanical Keyboard</h4>
                          <p className="text-[10px] text-zinc-500 mt-0.5">Hot-swappable switches, wireless, RGB lighting.</p>
                          <span className="text-xs font-bold text-zinc-300 mt-2 block">$149.00</span>
                        </div>
                        <button
                          onClick={(e) => handleAddToCart("Premium Keyboard", e)}
                          className="rounded bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-500 transition-colors"
                        >
                          Add to Cart
                        </button>
                      </div>

                      {/* Mouse Sold Out */}
                      <div className="rounded-lg border border-zinc-900 bg-zinc-900/20 p-4 flex items-center justify-between opacity-40">
                        <div>
                          <h4 className="text-xs font-semibold text-zinc-400">Ergonomic Mouse V2</h4>
                          <p className="text-[10px] text-zinc-650 mt-0.5">Precision sensor, ergonomic grip.</p>
                          <span className="text-xs font-bold text-zinc-650 mt-2 block">$79.00</span>
                        </div>
                        <button
                          disabled
                          onClick={(e) => trackSandboxClick("Button: Add Ergonomic Mouse (Disabled)", e)}
                          className="rounded bg-zinc-800 px-3 py-1.5 text-[11px] font-semibold text-zinc-500 cursor-not-allowed"
                        >
                          Sold Out
                        </button>
                      </div>
                    </div>

                    {cartCount > 0 && (
                      <button
                        onClick={(e) => {
                          trackSandboxClick("Button: Proceed to Cart from Catalog", e);
                          setCheckoutStep("cart");
                        }}
                        className="flex w-full items-center justify-center rounded-lg bg-zinc-900 border border-zinc-850 px-4 py-2.5 text-xs font-semibold text-zinc-350 hover:bg-zinc-850 hover:text-white transition-colors"
                      >
                        View Cart
                        <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                      </button>
                    )}
                  </div>
                )}

                {/* Shopping Cart */}
                {checkoutStep === "cart" && (
                  <div className="p-6 space-y-6">
                    <div className="flex items-center space-x-1 text-xs text-zinc-450">
                      <button 
                        onClick={(e) => {
                          trackSandboxClick("Link: Back to Products", e);
                          setCheckoutStep("catalog");
                        }} 
                        className="hover:text-zinc-200 flex items-center"
                      >
                        <ArrowLeft className="h-3 w-3 mr-1" />
                        Back to Catalog
                      </button>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-zinc-200">Your Cart</h3>
                      <p className="text-xs text-zinc-500">Apply coupon codes to test validation logs.</p>
                    </div>

                    {cartCount === 0 ? (
                      <div className="text-center py-8">
                        <ShoppingCart className="h-8 w-8 text-zinc-800 mx-auto" />
                        <p className="text-xs text-zinc-500 mt-2">Your cart is empty.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="border-b border-zinc-900 pb-3 flex justify-between text-xs">
                          <span className="text-zinc-300 font-medium">Premium Mechanical Keyboard (x{cartCount})</span>
                          <span className="text-zinc-300 font-bold">${149.00 * cartCount}.00</span>
                        </div>

                        <form onSubmit={handleCouponSubmit} className="flex gap-2">
                          <input
                            type="text"
                            required
                            value={couponCode}
                            onChange={(e) => setCouponCode(e.target.value)}
                            placeholder="e.g. WELCOME10"
                            className="flex-1 rounded border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-150 placeholder-zinc-700 focus:outline-none focus:border-indigo-650"
                          />
                          <button
                            type="submit"
                            className="rounded border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-850 hover:text-white"
                          >
                            Apply
                          </button>
                        </form>

                        <div className="pt-2 flex justify-between text-xs font-bold text-zinc-100">
                          <span>Total:</span>
                          <span>${149.00 * cartCount}.00</span>
                        </div>

                        <button
                          onClick={(e) => {
                            trackSandboxClick("Button: Proceed to Checkout details", e);
                            setCheckoutStep("checkout");
                          }}
                          className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 transition-colors flex items-center justify-center"
                        >
                          Checkout Order
                          <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Checkout Form */}
                {checkoutStep === "checkout" && (
                  <div className="p-6 space-y-6">
                    <div className="flex items-center space-x-1 text-xs text-zinc-450">
                      <button 
                        onClick={(e) => {
                          trackSandboxClick("Link: Back to Cart", e);
                          setCheckoutStep("cart");
                        }} 
                        className="hover:text-zinc-200 flex items-center"
                      >
                        <ArrowLeft className="h-3 w-3 mr-1" />
                        Back to Cart
                      </button>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-zinc-200">Checkout</h3>
                      <p className="text-xs text-zinc-500">Complete purchase to trigger a timeout sandbox telemetry event.</p>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[9px] text-zinc-450 font-semibold mb-1">Email</label>
                          <input 
                            type="email" 
                            readOnly 
                            value="sandbox@signalroom.io" 
                            className="w-full rounded border border-zinc-900 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-550 focus:outline-none" 
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] text-zinc-450 font-semibold mb-1">Card Details</label>
                          <input 
                            type="text" 
                            readOnly 
                            value="•••• •••• •••• 4242" 
                            className="w-full rounded border border-zinc-900 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-550 focus:outline-none" 
                          />
                        </div>
                      </div>

                      {checkoutError && (
                        <div className="rounded border border-red-500/10 bg-red-500/5 p-3 flex items-start space-x-2">
                          <XCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                          <span className="text-[10px] leading-relaxed text-red-300">{checkoutError}</span>
                        </div>
                      )}

                      <button
                        onClick={handleCheckoutSubmit}
                        disabled={isProcessingCheckout}
                        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-indigo-500 disabled:opacity-75 transition-colors flex items-center justify-center"
                      >
                        {isProcessingCheckout ? (
                          <>
                            <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            Authorizing...
                          </>
                        ) : (
                          <>
                            Submit Order (${149.00 * cartCount}.00)
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
