"use client";

import { useEffect, useRef } from "react";

type Point = { date: string; unitNav: number; index: number; note?: string };

const PURCHASE_DATE = "2026-04-09";
const PURCHASE_NAV = 1.0015;
const INDEX_BASE = 7921.45;
const INITIAL_AMOUNT = 1_000_000;
const INITIAL_SHARES = 998_502.25;
const REINVESTED_SHARES = 77_559.35;
const CURRENT_SHARES = 1_076_061.6;
const DIVIDEND_DATE = "2026-06-30";

const points: Point[] = [
  { date: PURCHASE_DATE, unitNav: PURCHASE_NAV, index: INDEX_BASE, note: "申购确认" },
  { date: "2026-04-10", unitNav: 1.0108, index: 7998.23 },
  { date: "2026-04-17", unitNav: 1.0449, index: 8307.44 },
  { date: "2026-04-24", unitNav: 1.043, index: 8304.14 },
  { date: "2026-04-30", unitNav: 1.0654, index: 8381.95 },
  { date: "2026-05-08", unitNav: 1.1128, index: 8741.15 },
  { date: "2026-05-15", unitNav: 1.1028, index: 8682.65 },
  { date: "2026-05-22", unitNav: 1.106, index: 8692.67 },
  { date: "2026-05-29", unitNav: 1.0593, index: 8408.74 },
  { date: "2026-06-05", unitNav: 1.0577, index: 8340.96 },
  { date: "2026-06-12", unitNav: 1.0503, index: 8202.8 },
  { date: "2026-06-18", unitNav: 1.1176, index: 8771.02 },
  { date: "2026-06-26", unitNav: 1.0972, index: 8601.41 },
  { date: DIVIDEND_DATE, unitNav: 1.02, index: 8809.79, note: "分红再投资" },
  { date: "2026-07-03", unitNav: 0.9996, index: 8620.79 },
  { date: "2026-07-10", unitNav: 0.9532, index: 8198.31 },
  { date: "2026-07-17", unitNav: 0.8174, index: 7168 },
  { date: "2026-07-24", unitNav: 0.8009, index: 6995.69 },
  { date: "2026-07-31", unitNav: 0.8208, index: 7075.51 },
  { date: "2026-08-07", unitNav: 0.8979, index: 7679.53, note: "最新净值" },
];

const pct = (value: number, digits = 2) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(digits)}%`;
const money = (value: number) => new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY", maximumFractionDigits: 2 }).format(value);
const shortDate = (value: string) => value.slice(5).replace("-", "/");
const sharesAt = (point: Point) => point.date >= DIVIDEND_DATE ? CURRENT_SHARES : INITIAL_SHARES;
const holdingValueAt = (point: Point) => sharesAt(point) * point.unitNav;
const holdingReturnAt = (point: Point) => point.date === PURCHASE_DATE ? 0 : holdingValueAt(point) / INITIAL_AMOUNT - 1;
const indexReturnAt = (point: Point) => point.index / INDEX_BASE - 1;

function TrendChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      const width = rect.width;
      const height = rect.height;
      const pad = { left: 52, right: 22, top: 42, bottom: 38 };
      const holding = points.map(holdingReturnAt);
      const benchmark = points.map(indexReturnAt);
      const all = holding.concat(benchmark, [0]);
      const min = Math.min(...all) - 0.018;
      const max = Math.max(...all) + 0.024;
      const x = (i: number) => pad.left + (i * (width - pad.left - pad.right)) / (points.length - 1);
      const y = (v: number) => pad.top + ((max - v) * (height - pad.top - pad.bottom)) / (max - min);

      ctx.clearRect(0, 0, width, height);
      ctx.font = '11px Arial, "PingFang SC", sans-serif';
      ctx.textAlign = "right";
      for (let i = 0; i < 6; i += 1) {
        const value = min + ((max - min) * i) / 5;
        const yy = y(value);
        ctx.strokeStyle = "#244158";
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(pad.left, yy);
        ctx.lineTo(width - pad.right, yy);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = "#8096a6";
        ctx.fillText(`${(value * 100).toFixed(0)}%`, pad.left - 9, yy + 4);
      }

      ctx.strokeStyle = "#ead2a3";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pad.left, y(0));
      ctx.lineTo(width - pad.right, y(0));
      ctx.stroke();
      ctx.fillStyle = "#ead2a3";
      ctx.textAlign = "left";
      ctx.fillText("0% · 04/09买入", pad.left + 7, y(0) - 8);

      const drawLine = (series: number[], color: string, showLabels = false) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.7;
        ctx.beginPath();
        series.forEach((value, index) => index ? ctx.lineTo(x(index), y(value)) : ctx.moveTo(x(index), y(value)));
        ctx.stroke();
        series.forEach((value, index) => {
          ctx.fillStyle = "#071525";
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(x(index), y(value), points[index].note ? 4.8 : 3.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          if (showLabels) {
            const labelAbove = value >= benchmark[index];
            const labelY = labelAbove
              ? Math.max(12, y(value) - 11)
              : Math.min(height - pad.bottom - 4, y(value) + 18);
            ctx.fillStyle = "#b9f5eb";
            ctx.font = '9px Arial, "PingFang SC", sans-serif';
            ctx.textAlign = "center";
            ctx.fillText(points[index].unitNav.toFixed(4), x(index), labelY);
          }
        });
      };
      drawLine(benchmark, "#e6ae67");
      drawLine(holding, "#55d0c5", true);

      ctx.textAlign = "center";
      ctx.font = '10px Arial, "PingFang SC", sans-serif';
      const stride = width < 620 ? 4 : 2;
      points.forEach((point, index) => {
        if (index % stride !== 0 && index !== points.length - 1) return;
        ctx.fillStyle = "#8096a6";
        ctx.fillText(shortDate(point.date), x(index), height - 12);
      });
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  return <canvas ref={canvasRef} className="trend" aria-label="买入以来个人持仓收益与中证1000同期收益曲线" />;
}

export default function Home() {
  const latest = points.at(-1)!;
  const previous = points.at(-2)!;
  const holdingValue = holdingValueAt(latest);
  const holdingReturn = holdingReturnAt(latest);
  const indexReturn = indexReturnAt(latest);
  const excessReturn = holdingReturn - indexReturn;
  const weeklyHolding = holdingValueAt(latest) / holdingValueAt(previous) - 1;
  const weeklyIndex = latest.index / previous.index - 1;

  const weeklyPoints = points.filter(point => point.date !== DIVIDEND_DATE);
  const rows = weeklyPoints.slice(1).map((point, index) => {
    const previousPoint = weeklyPoints[index];
    const holdingPeriod = holdingValueAt(point) / holdingValueAt(previousPoint) - 1;
    const indexPeriod = point.index / previousPoint.index - 1;
    const holdingCum = holdingReturnAt(point);
    const indexCum = indexReturnAt(point);
    return { point, previousPoint, holdingPeriod, indexPeriod, holdingCum, indexCum };
  });

  return (
    <main>
      <header className="page-header">
        <div>
          <p className="eyebrow">PERSONAL PERFORMANCE NOTE · 2026.08.07</p>
          <h1>Divis AI每周跟踪</h1>
          <p className="sub">从2026年4月9日申购确认日起，观察持仓收益与中证1000超额</p>
          <div className="method-strip">
            <b>买入基准</b><span>单位净值 1.0015</span><i />
            <span>000852收盘 7921.45</span><i />
            <span>分红再投资按实际份额复权</span>
          </div>
        </div>
        <div className="header-actions">
          <div className="badge"><span>净值更新至</span><strong>08 · 07</strong></div>
          <div className="badge quiet"><span>邮件核验</span><strong>08/10</strong></div>
        </div>
      </header>

      <section className="metrics" aria-label="买入以来核心指标">
        <article><span>我的持仓收益</span><strong className="negative">{pct(holdingReturn)}</strong><small>{money(holdingValue)} ÷ 100万元</small></article>
        <article><span>中证1000同期收益</span><strong className="orange">{pct(indexReturn)}</strong><small>000852 · 4/9收盘至8/7</small></article>
        <article className="primary-metric"><span>买入以来累计超额</span><strong className={excessReturn >= 0 ? "positive" : "negative"}>{pct(excessReturn)}</strong><small>持仓收益 − 指数收益</small></article>
        <article><span>最新一周超额</span><strong className="positive">{pct(weeklyHolding - weeklyIndex)}</strong><small>持仓 {pct(weeklyHolding)} · 指数 {pct(weeklyIndex)}</small></article>
      </section>

      <section className="hero-grid">
        <div className="panel chart-panel">
          <div className="panel-head">
            <div>
              <p className="eyebrow">ECONOMIC VIEW · PURCHASE DATE = 0%</p>
              <h2>我的持仓收益与中证1000</h2>
              <p className="chart-note">两条曲线从4月9日同一0%起点延伸；青绿色净值点按你的实际份额变化复权。</p>
            </div>
            <div className="legend"><i className="fund" />我的持仓<i className="index" />000852</div>
          </div>
          <TrendChart />
        </div>

        <aside className="panel holding-card">
          <div className="panel-head compact">
            <div><p className="eyebrow">CURRENT POSITION</p><h2>最新持仓</h2></div>
            <span className="status">实际份额口径</span>
          </div>
          <p className="muted-copy">不采用产品成立以来累计净值；直接以你的100万元投入和托管邮件中的最新实际份额计算。</p>
          <div className="holding-value"><span>最新持仓市值</span><strong>{money(holdingValue)}</strong><em className="negative">浮动损益 {money(holdingValue - INITIAL_AMOUNT)}</em></div>
          <dl className="detail-list">
            <div><dt>申购确认日</dt><dd>2026-04-09</dd></div>
            <div><dt>申购单位净值</dt><dd>{PURCHASE_NAV.toFixed(4)}</dd></div>
            <div><dt>初始确认份额</dt><dd>{INITIAL_SHARES.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</dd></div>
            <div><dt>分红再投资新增</dt><dd>+{REINVESTED_SHARES.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</dd></div>
            <div><dt>最新持有份额</dt><dd>{CURRENT_SHARES.toLocaleString("zh-CN", { minimumFractionDigits: 2 })}</dd></div>
            <div><dt>最新单位净值</dt><dd>{latest.unitNav.toFixed(4)}</dd></div>
          </dl>
        </aside>
      </section>

      <section className="split">
        <div className="panel event-panel">
          <p className="eyebrow">POSITION ROLL-FORWARD</p>
          <h2>持仓份额如何复权</h2>
          <div className="timeline">
            <div><time>04/09</time><span><b>申购确认</b><small>100万元 · 998,502.25份 · 净值1.0015</small></span></div>
            <div><time>06/30</time><span><b>分红再投资</b><small>分红后净值1.0200 · 新增77,559.35份</small></span></div>
            <div><time>07/03</time><span><b>除权后首个周度净值</b><small>1,076,061.60份 × 单位净值0.9996</small></span></div>
            <div><time>08/07</time><span><b>最新估值</b><small>1,076,061.60份 × 单位净值0.8979</small></span></div>
          </div>
        </div>
        <div className="panel method-panel">
          <p className="eyebrow">CALCULATION</p>
          <h2>本页采用的个人持仓口径</h2>
          <p><b>买入前全部忽略。</b>4月9日你的申购确认金额与中证1000当日收盘同时设为0%。</p>
          <p><b>分红不直接当亏损。</b>6月30日前按998,502.25份计算；分红再投资后改用1,076,061.60份，净值下降和份额增加一起进入持仓市值。</p>
          <p><b>累计超额。</b>你的持仓市值相对100万元的收益，减去中证1000相对4月9日收盘的收益。</p>
        </div>
      </section>

      <section className="panel table-panel">
        <div className="panel-head"><div><p className="eyebrow">WEEKLY DETAIL</p><h2>每周净值与相对表现</h2></div></div>
        <p className="table-context">000852中证1000指数 · 周度超额收益 = 持仓周收益 − 指数周收益</p>
        <div className="table-wrap">
          <table>
            <colgroup><col /><col /><col /><col /><col className="excess-column" /><col /><col /><col className="excess-column" /></colgroup>
            <thead><tr><th>日期</th><th>基金净值</th><th>持仓周收益</th><th>指数周收益</th><th>周度超额收益</th><th>持仓累计</th><th>指数收益</th><th>超额收益</th></tr></thead>
            <tbody>
              <tr className="baseline-row"><td>04/09 买入</td><td>1.0015</td><td>—</td><td>—</td><td>—</td><td>0.00%</td><td>0.00%</td><td>0.00%</td></tr>
              {rows.map(row => <tr key={row.point.date} className={row.point.note ? "event-row" : ""}>
                <td>{shortDate(row.point.date)}{row.point.date === "2026-04-10" ? <small>首个观察日</small> : row.point.date === "2026-07-03" ? <small>跨分红周 · 已复权</small> : null}</td>
                <td>{row.point.unitNav.toFixed(4)}</td>
                <td>{pct(row.holdingPeriod)}</td><td>{pct(row.indexPeriod)}</td><td className={row.holdingPeriod - row.indexPeriod >= 0 ? "positive" : "negative"}>{pct(row.holdingPeriod - row.indexPeriod)}</td>
                <td className={row.holdingCum >= 0 ? "positive" : "negative"}>{pct(row.holdingCum)}</td><td>{pct(row.indexCum)}</td><td className={row.holdingCum - row.indexCum >= 0 ? "positive" : "negative"}>{pct(row.holdingCum - row.indexCum)}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <p className="table-note">* 相邻两行构成一个估值区间。04/10为买入后的首个1日观察；其余按托管邮件的周度估值日期排列。06/26至07/03跨越分红除权，持仓收益已用实际份额从998,502.25份调整到1,076,061.60份。数据仅作持仓记录与相对表现核对，不构成投资建议。</p>
      </section>
      <footer>DIVIS AI WEEKLY TRACKING · 每周一核验更新</footer>
    </main>
  );
}
