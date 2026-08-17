import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DATA_PATH = path.join(ROOT, "data", "tracker.json");
const FUND_MATCH = /BPW63A|璞理九里一号私募证券投资基金A?|九里一号/u;

const round = (value, digits = 8) => Number(value.toFixed(digits));
const parseNumber = value => Number(String(value).replaceAll(",", ""));
const compactDate = date => date.replaceAll("-", "");

function normalizeDate(year, month, day) {
  const value = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() + 1 !== Number(month) ||
    parsed.getUTCDate() !== Number(day)
  ) return null;
  return value;
}

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

export function htmlToText(html) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");
}

export function findValuationDate(text) {
  const patterns = [
    /(?:估值日期|净值日期|产品净值日期|业务日期|数据日期|净值日)\s*[：:=]?\s*(20\d{2})\D{0,3}(\d{1,2})\D{0,3}(\d{1,2})/iu,
    /(?:估值日期|净值日期|产品净值日期|业务日期|数据日期|净值日)\s*[：:=]?\s*(20\d{2})(\d{2})(\d{2})/iu,
    /\b(20\d{2})(\d{2})(\d{2})\b/u,
    /\b(20\d{2})[年./-](\d{1,2})[月./-](\d{1,2})日?\b/u
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return normalizeDate(match[1], match[2], match[3]);
  }
  return null;
}

export function findUnitNav(text) {
  const patterns = [
    /(?:基金单位净值|产品单位净值|份额单位净值|单位净值|单位\s*NAV)\s*(?:为|是|[：:=])?\s*([0-9]+\.[0-9]{3,8})/giu,
    /(?:基金净值|产品净值)\s*(?:为|是|[：:=])\s*([0-9]+\.[0-9]{3,8})/giu
  ];
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const value = Number(match[1]);
      if (value > 0.1 && value < 10) return value;
    }
  }
  return null;
}

function findLabeledNumber(text, labels) {
  const labelGroup = labels.join("|");
  const pattern = new RegExp(`(?:${labelGroup})\\s*(?:为|是|[：:=])?\\s*([0-9][0-9,]*(?:\\.[0-9]+)?)`, "iu");
  const match = text.match(pattern);
  return match ? parseNumber(match[1]) : null;
}

export function parseValuationText(text) {
  const normalized = String(text || "").replace(/\s+/g, " ");
  if (!FUND_MATCH.test(normalized)) return null;
  const valuationDate = findValuationDate(normalized);
  const unitNav = findUnitNav(normalized);
  if (!valuationDate || unitNav === null) return null;
  return {
    valuationDate,
    unitNav,
    totalShares: findLabeledNumber(normalized, ["最新持有份额", "持有份额", "基金份额", "总份额", "最新份额"]),
    holdingValue: findLabeledNumber(normalized, ["最新持仓市值", "持仓市值", "持有市值", "基金市值", "资产市值"])
  };
}

function attachmentText(attachments = []) {
  return attachments
    .filter(item => item.content && (/^text\//i.test(item.contentType || "") || /\.(?:txt|csv|html?)$/i.test(item.filename || "")))
    .map(item => item.content.toString("utf8"))
    .join("\n");
}

async function fetchNewValuations(tracker) {
  const user = process.env.QQ_EMAIL;
  const pass = process.env.QQ_AUTH_CODE;
  if (!user || !pass) throw new Error("GitHub Secrets QQ_EMAIL / QQ_AUTH_CODE 尚未配置");

  const latestDate = tracker.points.at(-1).date;
  const since = new Date(`${latestDate}T00:00:00+08:00`);
  since.setUTCDate(since.getUTCDate() - 2);
  const client = new ImapFlow({
    host: "imap.qq.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
    tls: { servername: "imap.qq.com" }
  });
  const parsedByDate = new Map();
  await client.connect();
  try {
    const lock = await client.getMailboxLock("INBOX");
    try {
      const uids = await client.search({ since }, { uid: true });
      for await (const message of client.fetch(uids, { source: true, internalDate: true }, { uid: true })) {
        const mail = await simpleParser(message.source);
        const searchable = [
          mail.subject || "",
          mail.text || "",
          htmlToText(mail.html),
          attachmentText(mail.attachments)
        ].join("\n");
        const parsed = parseValuationText(searchable);
        if (!parsed || parsed.valuationDate <= latestDate) continue;
        const receivedAt = message.internalDate?.getTime() || 0;
        const existing = parsedByDate.get(parsed.valuationDate);
        if (!existing || receivedAt >= existing.receivedAt) parsedByDate.set(parsed.valuationDate, { ...parsed, receivedAt });
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => undefined);
  }
  return [...parsedByDate.values()].sort((a, b) => a.valuationDate.localeCompare(b.valuationDate));
}

export async function fetchIndexClose(indexCode, date) {
  const url = new URL("https://www.csindex.com.cn/csindex-home/perf/index-perf");
  url.searchParams.set("indexCode", indexCode);
  url.searchParams.set("startDate", compactDate(date));
  url.searchParams.set("endDate", compactDate(date));
  const response = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "DivisAIJiuliWeekly/1.0" },
    signal: AbortSignal.timeout(30000)
  });
  if (!response.ok) throw new Error(`中证指数请求失败：HTTP ${response.status}`);
  const payload = await response.json();
  const row = Array.isArray(payload.data)
    ? payload.data.find(item => item.tradeDate === compactDate(date) && Number.isFinite(Number(item.close)))
    : null;
  if (!row) throw new Error(`${date} 未取得中证1000收盘数据`);
  return Number(row.close);
}

export function applyValuations(tracker, valuations, indexByDate, verifiedAt) {
  if (!valuations.length) return false;
  for (const point of tracker.points) {
    if (point.note === "最新净值") delete point.note;
  }
  for (const valuation of valuations) {
    if (valuation.totalShares !== null) {
      const difference = Math.abs(valuation.totalShares - tracker.dividend.totalShares);
      if (difference > 0.02) throw new Error(`邮件份额发生变化（${valuation.totalShares}），需要人工核对新的份额事件`);
    }
    const index = indexByDate[valuation.valuationDate];
    if (!Number.isFinite(index)) throw new Error(`${valuation.valuationDate} 缺少中证1000收盘数据`);
    tracker.points.push({ date: valuation.valuationDate, unitNav: valuation.unitNav, index: round(index) });
  }
  tracker.points.sort((a, b) => a.date.localeCompare(b.date));
  tracker.points.at(-1).note = "最新净值";
  const latest = valuations.at(-1);
  const shares = latest.totalShares ?? tracker.dividend.totalShares;
  tracker.latestEmail = {
    valuationDate: latest.valuationDate,
    unitNav: latest.unitNav,
    totalShares: shares,
    holdingValue: latest.holdingValue ?? round(shares * latest.unitNav, 2)
  };
  tracker.mailVerifiedAt = verifiedAt;
  tracker.lastSuccessfulCheckDate = verifiedAt;
  return true;
}

async function appendSummary(message) {
  if (process.env.GITHUB_STEP_SUMMARY) await fs.appendFile(process.env.GITHUB_STEP_SUMMARY, `${message}\n`, "utf8");
}

async function main() {
  const tracker = JSON.parse(await fs.readFile(DATA_PATH, "utf8"));
  const valuations = await fetchNewValuations(tracker);
  if (!valuations.length) {
    await appendSummary(`未发现晚于 ${tracker.points.at(-1).date} 的九里一号净值邮件。`);
    console.log("No new valuation mail.");
    return;
  }
  const indexByDate = {};
  for (const valuation of valuations) {
    indexByDate[valuation.valuationDate] = await fetchIndexClose("000852", valuation.valuationDate);
  }
  applyValuations(tracker, valuations, indexByDate, shanghaiDate());
  await fs.writeFile(DATA_PATH, `${JSON.stringify(tracker, null, 2)}\n`, "utf8");
  const latest = valuations.at(-1);
  await appendSummary(`已更新至 ${latest.valuationDate}，单位净值 ${latest.unitNav.toFixed(4)}。`);
  console.log(`Updated through ${latest.valuationDate}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(async error => {
    await appendSummary(`更新失败：${error.message}`).catch(() => undefined);
    console.error(error.message);
    process.exitCode = 1;
  });
}
