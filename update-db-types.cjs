const fs = require('fs');
let file = fs.readFileSync('src/supabase/database.types.ts', 'utf8');

const shiftsTable = `        uber_shifts: {
          Row: { id: string; owner_id: string; date: string; status: "active" | "completed"; start_timestamp: string; end_timestamp: string | null; start_earnings_pence: number; end_earnings_pence: number | null; created_at: string; updated_at: string };
          Insert: { id?: string; owner_id?: string; date: string; status?: "active" | "completed"; start_timestamp?: string; end_timestamp?: string | null; start_earnings_pence?: number; end_earnings_pence?: number | null; created_at?: string; updated_at?: string };
          Update: { id?: string; owner_id?: string; date?: string; status?: "active" | "completed"; start_timestamp?: string; end_timestamp?: string | null; start_earnings_pence?: number; end_earnings_pence?: number | null; created_at?: string; updated_at?: string };
          Relationships: [];
        };
`;
file = file.replace(/uber_sessions: \{/, shiftsTable + '        uber_sessions: {');

fs.writeFileSync('src/supabase/database.types.ts', file);
