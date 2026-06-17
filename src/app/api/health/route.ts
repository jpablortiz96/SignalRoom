import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const hasUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const hasKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const hasRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  let databaseWorking = false;
  if (hasUrl && hasRoleKey) {
    try {
      const { error } = await supabaseServer.from("rooms").select("id").limit(1);
      if (!error) {
        databaseWorking = true;
      } else {
        console.error("Health Check: DB query error:", error);
      }
    } catch (err) {
      console.error("Health Check: DB connection exception:", err);
    }
  }

  return NextResponse.json({
    app: "SignalRoom",
    status: databaseWorking ? "ok" : "degraded",
    supabaseConfigured: hasUrl && hasKey && hasRoleKey && databaseWorking,
    timestamp: new Date().toISOString(),
  });
}
