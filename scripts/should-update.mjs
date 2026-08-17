import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_PATH = path.join(ROOT, "data", "tracker.json");

export function shanghaiDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function mondayOfWeek(dateText) {
  const date = new Date(`${dateText}T12:00:00Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
}

export function shouldUpdate(lastSuccessfulCheckDate, today = shanghaiDate()) {
  if (!lastSuccessfulCheckDate) return true;
  return mondayOfWeek(lastSuccessfulCheckDate) !== mondayOfWeek(today);
}

function main() {
  const tracker = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  if (shouldUpdate(tracker.lastSuccessfulCheckDate)) {
    console.log("No successful update has been recorded for this week.");
    return;
  }
  console.log(`This week's update was completed on ${tracker.lastSuccessfulCheckDate}; skipping mailbox access.`);
  process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
