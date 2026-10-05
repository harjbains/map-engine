const fs = require('fs');
let file = fs.readFileSync('src/uber/repository.ts', 'utf8');

// Add Shift imports and types
file = file.replace(/type SessionRow = Database\["public"\]\["Tables"\]\["uber_sessions"\]\["Row"\];/, 
`type SessionRow = Database["public"]["Tables"]["uber_sessions"]["Row"];
type ShiftRow = Database["public"]["Tables"]["uber_shifts"]["Row"];`);

file = file.replace(/type WeekPlan, type WeekPlanDay, type WorkWeight, type UberSession \} from "\.\/types\.js";/, 
`type WeekPlan, type WeekPlanDay, type WorkWeight, type UberSession, type UberShift } from "./types.js";`);

// Add shift parser
file = file.replace(/const sessionFromRow = .*?;\n/, 
`const sessionFromRow = (row: SessionRow): UberSession => ({ date: row.date as LocalDate, status: row.status, lastResumedAt: row.last_resumed_at, activeSeconds: row.active_seconds });
const shiftFromRow = (row: ShiftRow): UberShift => ({ id: row.id, date: row.date as LocalDate, status: row.status, startTimestamp: row.start_timestamp, endTimestamp: row.end_timestamp, startEarningsPence: row.start_earnings_pence, endEarningsPence: row.end_earnings_pence });\n`);

// Add methods to UberRepository class
const methods = `
  async getShiftsForWeek(weekStart: LocalDate): Promise<UberShift[]> {
    const endDate = new Date(\`\${weekStart}T00:00:00Z\`);
    endDate.setUTCDate(endDate.getUTCDate() + 6);
    const result = await this.client.from("uber_shifts").select("*").gte("date", weekStart).lte("date", endDate.toISOString().slice(0, 10)).order("start_timestamp");
    if (result.error) throw new Error(result.error.message);
    return (result.data ?? []).map(shiftFromRow);
  }

  async startShift(date: LocalDate, startEarnings: number): Promise<UberShift> {
    const result = await this.client.from("uber_shifts").insert({
      date,
      start_earnings_pence: startEarnings,
      status: 'active'
    }).select().single();
    if (result.error) throw new Error(result.error.message);
    return shiftFromRow(result.data);
  }

  async endShift(shiftId: string, endEarnings: number): Promise<UberShift> {
    const result = await this.client.from("uber_shifts").update({
      status: 'completed',
      end_timestamp: new Date().toISOString(),
      end_earnings_pence: endEarnings
    }).eq("id", shiftId).select().single();
    if (result.error) throw new Error(result.error.message);
    return shiftFromRow(result.data);
  }
`;

file = file.replace(/async startSession\(date: LocalDate\): Promise<UberSession> \{/, methods + '\n  async startSession(date: LocalDate): Promise<UberSession> {');

fs.writeFileSync('src/uber/repository.ts', file);
