const fs = require('fs');
let file = fs.readFileSync('src/uber/types.ts', 'utf8');

// Insert UberShift type
const shiftType = `
export type ShiftStatus = "active" | "completed";

export interface UberShift {
  id: string;
  date: LocalDate;
  status: ShiftStatus;
  startTimestamp: string;
  endTimestamp: string | null;
  startEarningsPence: Pence;
  endEarningsPence: Pence | null;
}
`;

file = file.replace(/export type SessionStatus = "active" \| "paused" \| "completed";/, shiftType + '\nexport type SessionStatus = "active" | "paused" | "completed";');

file = file.replace(/session: UberSession \| null;/, 'shifts: UberShift[];');

fs.writeFileSync('src/uber/types.ts', file);
