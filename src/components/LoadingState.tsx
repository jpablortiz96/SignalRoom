import React from "react";
import { Activity, Database, Sparkles } from "lucide-react";

interface LoadingStateProps {
  title?: string;
  subtitle?: string;
  type?: "room" | "report" | "story" | "evidence" | "generic";
}

export default function LoadingState({
  title = "Fetching Supabase telemetry...",
  subtitle = "Preparing workspace data...",
  type = "generic"
}: LoadingStateProps) {
  return (
    <div className="flex-1 bg-background flex flex-col items-center justify-center p-6 text-center relative overflow-hidden min-h-[500px] w-full">
      {/* Premium Background Glow effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Decorative Grid Overlay */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] pointer-events-none" />

      <div className="max-w-md w-full space-y-8 relative z-10">
        
        {/* Animated Loading Header Icon */}
        <div className="relative mx-auto w-16 h-16 flex items-center justify-center rounded-xl bg-zinc-950 border border-zinc-900 shadow-xl overflow-hidden">
          {/* Inner pulsing gradient boundary */}
          <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-emerald-500/10 animate-pulse" />
          
          {/* Pulse border element */}
          <div className="absolute inset-0 border border-indigo-500/20 rounded-xl animate-ping opacity-75" />

          {type === "room" && <Activity className="h-7 w-7 text-emerald-400 animate-pulse" />}
          {type === "report" && <Database className="h-7 w-7 text-indigo-400 animate-spin-slow" />}
          {type === "story" && <Sparkles className="h-7 w-7 text-indigo-400 animate-pulse" />}
          {type === "evidence" && <Database className="h-7 w-7 text-emerald-400 animate-pulse" />}
          {type === "generic" && <Activity className="h-7 w-7 text-zinc-400 animate-pulse" />}
        </div>

        {/* Text descriptions with dynamic values */}
        <div className="space-y-3">
          <h2 className="text-xl font-extrabold text-zinc-100 tracking-tight">{title}</h2>
          <p className="text-zinc-400 text-sm max-w-sm mx-auto leading-relaxed">{subtitle}</p>
        </div>

        {/* Premium Skeleton Elements mimicking specific layouts */}
        <div className="mt-8 p-5 rounded-xl border border-zinc-900 bg-zinc-950/40 backdrop-blur-sm space-y-4">
          
          {/* Skeleton Layout Header */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900/60 animate-pulse shrink-0" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 w-1/3 bg-zinc-900 animate-pulse rounded" />
              <div className="h-2.5 w-1/2 bg-zinc-900/60 animate-pulse rounded" />
            </div>
            <div className="w-12 h-5 rounded-full bg-zinc-900/40 animate-pulse shrink-0" />
          </div>

          {/* Skeleton Lines / Telemetry animation */}
          <div className="space-y-2 pt-2 border-t border-zinc-900/50">
            <div className="h-2 w-full bg-zinc-900 animate-pulse rounded" />
            <div className="h-2 w-5/6 bg-zinc-900/80 animate-pulse rounded" />
            <div className="h-2 w-4/6 bg-zinc-900/60 animate-pulse rounded" />
          </div>

          {/* Simulated telemetry flow nodes */}
          <div className="flex justify-between items-center pt-2">
            <div className="flex space-x-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500/30 animate-ping" />
              <div className="w-12 h-2.5 bg-zinc-900/70 rounded animate-pulse" />
            </div>
            <div className="h-2 w-16 bg-zinc-900/70 rounded animate-pulse" />
          </div>

        </div>

        {/* Subtle loading path telemetry bar */}
        <div className="w-48 h-1 bg-zinc-900 rounded-full mx-auto overflow-hidden relative">
          <div className="absolute top-0 bottom-0 left-0 w-1/2 bg-gradient-to-r from-indigo-500 to-emerald-500 rounded-full animate-loading-bar" />
        </div>
      </div>
    </div>
  );
}
