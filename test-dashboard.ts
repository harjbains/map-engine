import { createClient } from "@supabase/supabase-js";
import { UberRepository } from "./src/uber/repository.js";
import { UberWeekService } from "./src/uber/service.js";

const client = createClient("https://doaokmhdfwdwtkwxxksx.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvYW9rbWhkZndkd3Rrd3h4a3N4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjcxNTE2NTIsImV4cCI6MjA0MjcyNzY1Mn0.xyz");
const repo = new UberRepository(client as any);
const service = new UberWeekService(repo);

async function test() {
  const d1 = await service.getDashboard("2026-10-06" as any);
  console.log("D1 Week:", d1?.days.map(d => d.date));
  
  const d2 = await service.getDashboard("2026-09-29" as any);
  console.log("D2 Week:", d2?.days.map(d => d.date));
}

test().catch(console.error);
