"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Globe, 
  Clock, 
  ArrowRight, 
  Activity,
  AlertTriangle
} from "lucide-react";
import { createRoom, isSupabaseConfigured } from "@/lib/store";
import { trackSignalRoomEvent } from "@/lib/analytics/signalroomAnalytics";

let trackedCreateView = false;

export default function CreateRoom() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    projectName: "",
    targetUrl: "",
    mission: "",
    timeLimit: "90",
    instructions: ""
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [supabaseActive, setSupabaseActive] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setSupabaseActive(isSupabaseConfigured());
    if (!trackedCreateView) {
      trackedCreateView = true;
      trackSignalRoomEvent("create_room_viewed");
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.projectName || !formData.targetUrl || !formData.mission) return;

    setIsSubmitting(true);
    setErrorMessage(null);
    
    // Simulate minor network delay for premium experience
    await new Promise((resolve) => setTimeout(resolve, 800));

    try {
      const room = await createRoom({
        productName: formData.projectName,
        productUrl: formData.targetUrl,
        testerMission: formData.mission,
        timeLimitSeconds: parseInt(formData.timeLimit, 10) || 90,
        testerPersona: formData.instructions || "General builder launch testing."
      });

      // Pendo Track Event: room_created
      trackSignalRoomEvent("room_created", {
        roomId: room.id,
        productName: formData.projectName.substring(0, 64),
        productUrl: formData.targetUrl.substring(0, 100),
        testerMission: formData.mission.substring(0, 80),
        timeLimitSeconds: parseInt(formData.timeLimit, 10) || 90,
        storageMode: supabaseActive ? "supabase" : "local",
      });

      // Redirect builder directly to the tester room to check it out
      router.push(`/r/${room.id}`);
    } catch (error) {
      console.error("Error creating room:", error);
      const message = error instanceof Error ? error.message : "Failed to deploy launch room. Please verify connection and try again.";
      setErrorMessage(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 bg-background relative isolate px-6 py-12 lg:px-8">
      {/* Glow Effects */}
      <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" aria-hidden="true">
        <div className="relative left-[calc(50%-15rem)] aspect-1155/678 w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-indigo-500 to-violet-500 opacity-10 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" />
      </div>

      <div className="mx-auto max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl bg-gradient-to-r from-zinc-100 to-zinc-400 bg-clip-text text-transparent">
            Create a Launch Trial
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Define a 90-second mission for your testers. We&apos;ll capture every click, pause, and console error.
          </p>
        </div>

        {/* Supabase offline warning alert */}
        {!supabaseActive && (
          <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-amber-450 uppercase tracking-wider">Local demo mode active</h4>
              <p className="text-xs text-zinc-400 mt-1 leading-normal">
                Evidence is stored only in this browser. Configure Supabase environment variables to share evidence across real devices.
              </p>
            </div>
          </div>
        )}

        {/* Room creation error details */}
        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider">Deployment Error</h4>
              <p className="text-xs text-zinc-450 mt-1 leading-normal">{errorMessage}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-zinc-900 bg-zinc-950/40 p-8 shadow-xl backdrop-blur-xl ring-1 ring-zinc-800/10">
          {/* Project Name */}
          <div>
            <label htmlFor="projectName" className="block text-sm font-semibold text-zinc-200">
              Product or Feature Name
            </label>
            <div className="mt-2">
              <input
                type="text"
                name="projectName"
                id="projectName"
                required
                value={formData.projectName}
                onChange={handleChange}
                placeholder="e.g. SignalRoom Checkout V2"
                className="block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-650 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Target URL */}
          <div>
            <label htmlFor="targetUrl" className="block text-sm font-semibold text-zinc-200">
              Launch Target URL
            </label>
            <p className="mt-1 text-xs text-zinc-500">The page we will instruct the tester to open in a new tab.</p>
            <div className="mt-2 relative rounded-lg shadow-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Globe className="h-4 w-4 text-zinc-600" aria-hidden="true" />
              </div>
              <input
                type="url"
                name="targetUrl"
                id="targetUrl"
                required
                value={formData.targetUrl}
                onChange={handleChange}
                placeholder="https://yourproduct.com/launch"
                className="block w-full rounded-lg border border-zinc-800 bg-zinc-950 pl-10 pr-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-650 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Tester Mission */}
          <div>
            <label htmlFor="mission" className="block text-sm font-semibold text-zinc-200">
              The 90-Second Tester Mission
            </label>
            <p className="mt-1 text-xs text-zinc-500">What specific objective should the user try to accomplish?</p>
            <div className="mt-2">
              <textarea
                name="mission"
                id="mission"
                required
                rows={3}
                value={formData.mission}
                onChange={handleChange}
                placeholder="e.g. Find the price list, select the Pro Plan, and reach the billing checkout form."
                className="block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-650 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              />
            </div>
          </div>

          {/* Time Limit & Optional Settings */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="timeLimit" className="block text-sm font-semibold text-zinc-200">
                Time Limit (Seconds)
              </label>
              <div className="mt-2 relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Clock className="h-4 w-4 text-zinc-600" />
                </div>
                <select
                  name="timeLimit"
                  id="timeLimit"
                  value={formData.timeLimit}
                  onChange={handleChange}
                  className="block w-full rounded-lg border border-zinc-800 bg-zinc-950 pl-10 pr-8 py-2.5 text-sm text-zinc-100 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="60">60 seconds (Quick Check)</option>
                  <option value="90">90 seconds (Default)</option>
                  <option value="120">120 seconds (Complex)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Tester Context Instructions */}
          <div>
            <label htmlFor="instructions" className="block text-sm font-semibold text-zinc-200">
              Context / Tester Persona (Optional)
            </label>
            <div className="mt-2">
              <textarea
                name="instructions"
                id="instructions"
                rows={2}
                value={formData.instructions}
                onChange={handleChange}
                placeholder="e.g. Imagine you are a designer looking for your first freelance client..."
                className="block w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-650 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="group flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-500 disabled:opacity-50 hover:shadow-indigo-500/20"
            >
              {isSubmitting ? (
                <>
                  <Activity className="h-4 w-4 animate-spin mr-2" />
                  Generating Launch Room...
                </>
              ) : (
                <>
                  Deploy Launch Room
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
