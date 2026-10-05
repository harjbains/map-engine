const fs = require('fs');
let file = fs.readFileSync('src/uber/service.ts', 'utf8');

file = file.replace(/type UberSession/, `type UberSession, type UberShift`);

file = file.replace(
  /"endSession">\) \{\}/,
  `"endSession" | "getShiftsForWeek" | "startShift" | "endShift">) {}`
);

file = file.replace(
  /const sessions = await this\.repository\.getSessionsForWeek\(weekStart\);/,
  `const sessions = await this.repository.getSessionsForWeek(weekStart);\n      const shifts = await this.repository.getShiftsForWeek(weekStart);`
);

file = file.replace(
  /session: sessions\.find\(s => s\.date === today\) \?\? null,/,
  `shifts: shifts.filter(s => s.date === today),`
);

const shiftMethods = `
  async startShift(today = londonToday(), startEarnings = 0): Promise<UberDashboard | null> {
    await this.repository.startShift(today, startEarnings);
    return this.getDashboard(today);
  }

  async endShift(shiftId: string, today = londonToday(), endEarnings = 0): Promise<UberDashboard | null> {
    await this.repository.endShift(shiftId, endEarnings);
    return this.getDashboard(today);
  }
`;

file = file.replace(/async startSession/, shiftMethods + '\n  async startSession');

fs.writeFileSync('src/uber/service.ts', file);
