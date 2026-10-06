import { weekStartForDate, datesInWeek } from "./src/uber/calendar.js";

console.log("2026-10-06 =>", datesInWeek(weekStartForDate("2026-10-06" as any)));
console.log("2026-09-29 =>", datesInWeek(weekStartForDate("2026-09-29" as any)));
console.log("2026-09-22 =>", datesInWeek(weekStartForDate("2026-09-22" as any)));
