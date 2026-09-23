import type { MilesTenths, Pence } from "./types.js";

function parseFixed(value: string | number, scale: number, label: string): number {
  const source = String(value).trim();
  if (!new RegExp(`^\\d+(?:\\.\\d{1,${scale}})?$`).test(source)) {
    throw new Error(`${label} must be a non-negative value with at most ${scale} decimal place(s)`);
  }
  const [whole, fraction = ""] = source.split(".");
  return Number(whole) * 10 ** scale + Number(fraction.padEnd(scale, "0"));
}

export const penceFromGbp = (value: string | number): Pence => parseFixed(value, 2, "GBP");
export const tenthsFromMiles = (value: string | number): MilesTenths => parseFixed(value, 1, "Business miles");
export const gbpFromPence = (value: Pence): string => (value / 100).toFixed(2);
export const milesFromTenths = (value: MilesTenths): string => (value / 10).toFixed(1);
