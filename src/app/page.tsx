"use client";

import { useEffect } from "react";
import Link from "next/link";
import { trackSignalRoomEvent } from "@/lib/analytics/signalroomAnalytics";
import { 
  ArrowRight, 
  Play, 
  Activity, 
  MousePointer, 
  Terminal, 
  AlertCircle, 
  Clock, 
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  XCircle
} from "lucide-react";

let trackedHome = false;

export default function Home() {
  useEffect(() => {
    if (trackedHome) return;
    trackedHome = true;
    trackSignalRoomEvent("page_home_viewed");
  }, []);

  return (
    <div className="relative isolate overflow-hidden bg-background">
      {/* Background Grid Accent */}
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,#1f293710_1px,transparent_1px),linear-gradient(to_bottom,#1f293710_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

      {/* Decorative Glows */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
        <div className="relative left-[calc(50%-11rem)] aspect-1155/678 w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-indigo-500 to-violet-500 opacity-20 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
      </div>

      {/* Hero Section */}
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-20 sm:pb-32 lg:px-8 lg:pt-32">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/5 px-3 py-1 text-xs font-medium text-indigo-400">
            <Sparkles className="h-3 w-3" />
            <span>Introducing SignalRoom Launch Trials</span>
          </div>

          <h1 className="mt-8 text-4xl font-extrabold tracking-tight sm:text-6xl bg-gradient-to-b from-zinc-100 via-zinc-200 to-zinc-500 bg-clip-text text-transparent leading-[1.1] sm:leading-[1.1]">
            Don’t ask AI if your product works.<br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              Watch five real users prove where it breaks.
            </span>
          </h1>

          <p className="mt-6 text-lg leading-8 text-zinc-400 max-w-2xl mx-auto">
            SignalRoom generates a 90-second launch trial for your product. Set a mission, watch real testers navigate, and get an evidence-backed telemetry report pinpointing every friction point.
          </p>

          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link
              href="/create"
              className="group inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 hover:shadow-indigo-500/20"
            >
              Create a Launch Room
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/report/demo"
              className="inline-flex items-center justify-center rounded-lg border border-zinc-800 bg-zinc-950 px-5 py-3 text-sm font-semibold text-zinc-300 hover:bg-zinc-900 transition-colors"
            >
              <Play className="mr-2 h-4 w-4 text-indigo-400 fill-indigo-400/20" />
              Watch Demo Report
            </Link>
          </div>
        </div>

        {/* Premium Telemetry UI Mockup */}
        <div className="mt-16 sm:mt-24 lg:mx-auto lg:max-w-5xl">
          <div className="relative rounded-xl border border-zinc-800/80 bg-zinc-950/60 p-2 shadow-2xl ring-1 ring-zinc-800/40 backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-zinc-900 pb-3 px-4">
              <div className="flex items-center space-x-2">
                <span className="h-3 w-3 rounded-full bg-zinc-800" />
                <span className="h-3 w-3 rounded-full bg-zinc-800" />
                <span className="h-3 w-3 rounded-full bg-zinc-800" />
                <span className="text-xs text-zinc-500 font-mono ml-4">signalroom.io/r/demo-room</span>
              </div>
              <div className="flex items-center space-x-2 text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full border border-indigo-500/20">
                <Activity className="h-3 w-3 animate-pulse mr-1" />
                Live Session Capture
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-zinc-900">
              {/* Telemetry Log */}
              <div className="p-6 md:col-span-2 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-200">Friction Telemetry Feed</h3>
                  <span className="text-xs text-zinc-500 font-mono">Session #052</span>
                </div>

                <div className="space-y-2.5 font-mono text-xs">
                  <div className="flex items-start justify-between rounded bg-zinc-900/40 p-3 border border-zinc-900">
                    <div className="flex items-start space-x-2">
                      <Clock className="mt-0.5 h-3.5 w-3.5 text-zinc-500" />
                      <div>
                        <p className="text-zinc-300">User opened launch page</p>
                        <p className="text-zinc-500 text-[10px]">url: signalroom.io/r/demo-room</p>
                      </div>
                    </div>
                    <span className="text-zinc-500">00:01s</span>
                  </div>

                  <div className="flex items-start justify-between rounded bg-indigo-500/5 p-3 border border-indigo-500/10">
                    <div className="flex items-start space-x-2">
                      <MousePointer className="mt-0.5 h-3.5 w-3.5 text-indigo-400" />
                      <div>
                        <p className="text-indigo-300">Started Mission: &quot;Add item and checkout&quot;</p>
                        <p className="text-zinc-500 text-[10px]">Mouse speed: normal</p>
                      </div>
                    </div>
                    <span className="text-indigo-400">00:05s</span>
                  </div>

                  <div className="flex items-start justify-between rounded bg-amber-500/5 p-3 border border-amber-500/15">
                    <div className="flex items-start space-x-2">
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 text-amber-400" />
                      <div>
                        <p className="text-amber-300">Rage Clicks on &apos;Add to Cart&apos; button</p>
                        <p className="text-zinc-500 text-[10px]">4 clicks in 0.8 seconds</p>
                      </div>
                    </div>
                    <span className="text-amber-400">00:32s</span>
                  </div>

                  <div className="flex items-start justify-between rounded bg-red-500/5 p-3 border border-red-500/15">
                    <div className="flex items-start space-x-2">
                      <Terminal className="mt-0.5 h-3.5 w-3.5 text-red-400" />
                      <div>
                        <p className="text-red-300">Console Error: API rate-limit exceeded</p>
                        <p className="text-zinc-500 text-[10px]">POST /api/checkout 429 Too Many Requests</p>
                      </div>
                    </div>
                    <span className="text-red-400">00:34s</span>
                  </div>

                  <div className="flex items-start justify-between rounded bg-zinc-900/40 p-3 border border-zinc-900">
                    <div className="flex items-start space-x-2">
                      <ShieldAlert className="mt-0.5 h-3.5 w-3.5 text-zinc-500" />
                      <div>
                        <p className="text-zinc-300">Session abandoned</p>
                        <p className="text-zinc-500 text-[10px]">User closed tab</p>
                      </div>
                    </div>
                    <span className="text-zinc-500">00:54s</span>
                  </div>
                </div>
              </div>

              {/* Analysis Sidebar */}
              <div className="p-6 space-y-6 bg-zinc-950/40">
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Launch Performance</h4>
                  <p className="mt-2 text-2xl font-bold text-zinc-100">40% Completion</p>
                  <p className="text-xs text-zinc-400 mt-1">2 out of 5 testers finished the mission</p>
                </div>

                <div className="border-t border-zinc-900 pt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Average Duration</h4>
                  <p className="mt-2 text-2xl font-bold text-zinc-100">72.4 seconds</p>
                  <p className="text-xs text-zinc-400 mt-1">Target limit: 90 seconds</p>
                </div>

                <div className="border-t border-zinc-900 pt-4 space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Primary Drop-off</h4>
                  <div className="rounded border border-red-500/10 bg-red-500/5 p-2.5">
                    <p className="text-xs font-medium text-red-300">Invisible Checkout Button</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5">3 users scrolled past the checkout option because of a layout shift on mobile screens.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comparison Grid */}
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-24 lg:px-8 border-t border-zinc-900 bg-zinc-950/20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-100 sm:text-4xl">
            Why Watch Real Users?
          </h2>
          <p className="mt-4 text-zinc-400">
            LLMs can check your syntax and test scripts, but they can&apos;t simulate human confusion.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="rounded-xl border border-zinc-900 bg-zinc-950 p-8 space-y-4">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10 text-red-400">
              <XCircle className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-100">The Problem with AI Guesswork</h3>
            <ul className="space-y-2.5 text-sm text-zinc-400">
              <li className="flex items-start">
                <span className="mr-2 text-red-500/50">•</span>
                AI doesn&apos;t experience layout shifts or overlapping text.
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-red-500/50">•</span>
                AI code simulation misses subtle network latency delays.
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-red-500/50">•</span>
                AI always knows the &ldquo;ideal&rdquo; path; it doesn&apos;t get confused by poor copy.
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-indigo-500/10 bg-indigo-500/5 p-8 space-y-4">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-100">The SignalRoom Advantage</h3>
            <ul className="space-y-2.5 text-sm text-zinc-300">
              <li className="flex items-start">
                <span className="mr-2 text-indigo-400">•</span>
                <strong>Friction Telemetry</strong>: Track exact mouse movement, rage clicks, and errors.
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-indigo-400">•</span>
                <strong>Video Evidence</strong>: See where eyes and cursors lag behind expectation.
              </li>
              <li className="flex items-start">
                <span className="mr-2 text-indigo-400">•</span>
                <strong>90-Second Mission</strong>: Test micro-interactions before public release.
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

