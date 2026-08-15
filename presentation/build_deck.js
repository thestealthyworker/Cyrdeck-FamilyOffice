/**
 * Cyrdeck Exposure Graph — VC pitch deck generator.
 *
 * Palette and type are lifted from the live product (editorial/Swiss on warm paper,
 * severity-driven red) so the deck and the app read as one thing.
 *
 * Every figure here is either (a) produced by the live application, (b) cited in
 * COMPETITIVE_LANDSCAPE.md, or (c) an explicitly labelled modelling assumption.
 * Nothing is invented traction.
 */
const pptxgen = require("pptxgenjs");

const INK = "19140F";
const INK_SOFT = "58503F";
const INK_FAINT = "948A74";
const PAPER = "F5F1E7";
const PAPER_RAISED = "FFFDF8";
const RULE = "DDD2B8";
const CRITICAL = "9C2B1F";
const HIGH = "A8641A";
const SLATE = "3D5164";

const HEAD = "Georgia";
const BODY = "Calibri";

const W = 10;
const H = 5.625;
const M = 0.55;
const CW = W - M * 2;

const pptx = new pptxgen();
pptx.layout = "LAYOUT_16x9";
pptx.author = "Cyrdeck";
pptx.title = "Cyrdeck Exposure Graph";

/** Dark slide with the red spine motif. */
function darkSlide() {
  const s = pptx.addSlide();
  s.background = { color: INK };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.09, h: H, fill: { color: CRITICAL } });
  return s;
}

/** Light slide: red spine + kicker label + title. */
function lightSlide(kicker, title, titleSize = 28) {
  const s = pptx.addSlide();
  s.background = { color: PAPER };
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.09, h: H, fill: { color: CRITICAL } });
  s.addText(kicker.toUpperCase(), {
    x: M, y: 0.34, w: CW, h: 0.24, fontFace: BODY, fontSize: 10.5,
    bold: true, color: CRITICAL, charSpacing: 2.2, margin: 0,
  });
  s.addText(title, {
    x: M, y: 0.62, w: CW, h: 0.82, fontFace: HEAD, fontSize: titleSize,
    bold: true, color: INK, margin: 0, lineSpacingMultiple: 0.94,
  });
  return s;
}

function footnote(s, text) {
  s.addText(text, {
    x: M, y: H - 0.46, w: CW, h: 0.3, fontFace: BODY, fontSize: 9,
    color: INK_FAINT, italic: true, margin: 0, valign: "middle",
  });
}

/* ------------------------------------------------------------------ 1. Title */
{
  const s = darkSlide();
  s.addText("CYRDECK · EXPOSURE GRAPH", {
    x: M, y: 1.02, w: CW, h: 0.28, fontFace: BODY, fontSize: 11.5,
    bold: true, color: CRITICAL, charSpacing: 3, margin: 0,
  });
  s.addText("Your hedge is\nyour own position.", {
    x: M, y: 1.42, w: 6.6, h: 1.9, fontFace: HEAD, fontSize: 42, italic: true,
    bold: true, color: PAPER, margin: 0, lineSpacingMultiple: 0.95,
  });
  s.addText(
    "Cross-asset-class look-through for single family offices — the exposure that sits in two different asset-class buckets, which conventional reporting structurally cannot see.",
    { x: M, y: 3.42, w: 6.5, h: 0.9, fontFace: BODY, fontSize: 13.5, color: "C9BFA8", margin: 0, lineSpacingMultiple: 1.12 }
  );
  s.addShape(pptx.ShapeType.rect, { x: 7.42, y: 1.5, w: 2.05, h: 1.72, fill: { color: "241D16" }, line: { color: CRITICAL, width: 1 } });
  s.addText("LIVE TODAY", { x: 7.6, y: 1.66, w: 1.7, h: 0.24, fontFace: BODY, fontSize: 9, bold: true, color: CRITICAL, charSpacing: 1.6, margin: 0 });
  s.addText("$2,459,000", { x: 7.6, y: 1.94, w: 1.75, h: 0.42, fontFace: HEAD, fontSize: 21, bold: true, color: PAPER, margin: 0 });
  s.addText("single-counterparty exposure reported today as diversification across two asset classes", {
    x: 7.6, y: 2.36, w: 1.72, h: 0.78, fontFace: BODY, fontSize: 8.5, color: INK_FAINT, margin: 0, lineSpacingMultiple: 1.05,
  });
  s.addText("cyrdeck-familyoffice.vercel.app", {
    x: M, y: H - 0.62, w: 5, h: 0.3, fontFace: BODY, fontSize: 10.5, color: INK_FAINT, margin: 0,
  });
}

/* ---------------------------------------------------------------- 2. Problem */
{
  const s = lightSlide("The problem", "The risk isn't unknown. It's unaggregated.");
  s.addText(
    "Everything needed to see it is already written down — across twenty documents, in a dozen formats, from nine counterparties that nobody reads together.",
    { x: M, y: 1.52, w: 8.5, h: 0.72, fontFace: BODY, fontSize: 13, color: INK_SOFT, margin: 0, lineSpacingMultiple: 1.1 }
  );

  const stats = [
    ["73%", "cite private-market data as their single biggest technology challenge"],
    ["75%", "report internal expertise gaps in private-market analytics"],
    ["45–75", "days that PE NAVs lag after quarter-end — every number on file is stale"],
    ["20+", "funds still administered on spreadsheets at a typical family office"],
  ];
  const bw = 2.13, gap = 0.16;
  stats.forEach(([n, label], i) => {
    const x = M + i * (bw + gap);
    s.addShape(pptx.ShapeType.rect, { x, y: 2.28, w: bw, h: 1.72, fill: { color: PAPER_RAISED }, line: { color: RULE, width: 1 } });
    s.addShape(pptx.ShapeType.rect, { x, y: 2.28, w: bw, h: 0.05, fill: { color: i < 2 ? CRITICAL : HIGH } });
    s.addText(n, { x: x + 0.14, y: 2.44, w: bw - 0.28, h: 0.52, fontFace: HEAD, fontSize: 27, bold: true, color: INK, margin: 0 });
    s.addText(label, { x: x + 0.14, y: 3.0, w: bw - 0.28, h: 0.9, fontFace: BODY, fontSize: 10, color: INK_SOFT, margin: 0, lineSpacingMultiple: 1.06 });
  });
  footnote(s, "Sources: Masttro, private-market portfolio monitoring research (2026). Alternatives now ~45% of the average family office portfolio.");
}

/* ----------------------------------------------------------- 3. Failure mode */
{
  const s = lightSlide("Why it bites", "Obligations rise as funding dries up");
  s.addShape(pptx.ShapeType.rect, { x: M, y: 1.58, w: 5.15, h: 1.5, fill: { color: PAPER_RAISED }, line: { color: RULE, width: 1 } });
  s.addText(
    "“In a weakening market the ratio of distributions to contributions will likely decline.” Families are then forced to sell growth assets during a drawdown — “undoing hard-earned portfolio outperformance.”",
    { x: M + 0.2, y: 1.74, w: 4.75, h: 1.2, fontFace: HEAD, fontSize: 12.5, italic: true, color: INK, margin: 0, lineSpacingMultiple: 1.1 }
  );
  s.addText("— Cambridge Associates", { x: M + 0.2, y: 3.12, w: 4.7, h: 0.24, fontFace: BODY, fontSize: 10, color: INK_FAINT, margin: 0 });

  s.addText("THE INSTITUTIONAL STANDARD, AND THIS PORTFOLIO", {
    x: 6.0, y: 1.6, w: 3.45, h: 0.24, fontFace: BODY, fontSize: 9, bold: true, color: INK_FAINT, charSpacing: 1.2, margin: 0,
  });
  const bars = [["3.00×", "Cambridge post-stress standard", 3.3, SLATE], ["0.92×", "This portfolio, stressed", 1.0, CRITICAL]];
  bars.forEach(([v, l, wid, col], i) => {
    const y = 2.02 + i * 0.92;
    s.addShape(pptx.ShapeType.rect, { x: 6.0, y, w: 3.45, h: 0.3, fill: { color: "E6DDC8" } });
    s.addShape(pptx.ShapeType.rect, { x: 6.0, y, w: wid, h: 0.3, fill: { color: col } });
    s.addText(v, { x: 6.0, y: y + 0.34, w: 1.0, h: 0.3, fontFace: HEAD, fontSize: 15, bold: true, color: col, margin: 0 });
    s.addText(l, { x: 7.1, y: y + 0.36, w: 2.35, h: 0.3, fontFace: BODY, fontSize: 9.5, color: INK_SOFT, margin: 0, align: "right" });
  });
  s.addShape(pptx.ShapeType.rect, { x: M, y: 3.62, w: 5.15, h: 0.72, fill: { color: "F6DED6" } });
  s.addText("A $307,500 stressed shortfall puts $12,480,000 of NAV at risk of forced sale — 41× its size.", {
    x: M + 0.18, y: 3.72, w: 4.8, h: 0.54, fontFace: BODY, fontSize: 11, bold: true, color: "5C1710", margin: 0, lineSpacingMultiple: 1.05,
  });
  footnote(s, "Figures computed live by the product from the fixture portfolio. LP forfeiture is a real contractual tail risk but documented as rare — forced selling is the primary cost.");
}

/* --------------------------------------------------------------- 4. Insight */
{
  const s = darkSlide();
  s.addText("THE FINDING CONVENTIONAL REPORTING CANNOT PRODUCE", {
    x: M, y: 0.46, w: CW, h: 0.26, fontFace: BODY, fontSize: 10.5, bold: true, color: CRITICAL, charSpacing: 2, margin: 0,
  });
  s.addText("One company. Three roles.\nThree asset classes.", {
    x: M, y: 0.84, w: 5.4, h: 1.1, fontFace: HEAD, fontSize: 26, bold: true, color: PAPER, margin: 0, lineSpacingMultiple: 0.98,
  });
  s.addText(
    "Aurex Data Centers is held as equity inside a fund, lent to directly on an unsecured basis, and the guarantee behind that loan is written by the very same fund. One credit event impairs the equity, leaves the loan unsecured, and weakens the guarantee simultaneously.",
    { x: M, y: 2.06, w: 5.2, h: 1.36, fontFace: BODY, fontSize: 12, color: "C9BFA8", margin: 0, lineSpacingMultiple: 1.14 }
  );
  s.addText("The credit protection is the family office's own position wearing a different hat.", {
    x: M, y: 3.48, w: 5.2, h: 0.54, fontFace: HEAD, fontSize: 12.5, italic: true, color: PAPER, margin: 0, lineSpacingMultiple: 1.06,
  });

  const roles = [["EQUITY", "held inside Kestrel III", "$459,000", SLATE], ["DEBT — UNSECURED", "held directly", "$2,000,000", HIGH], ["GUARANTEE", "written by Kestrel III", "same fund", CRITICAL]];
  roles.forEach(([r, sub, amt, col], i) => {
    const y = 0.92 + i * 0.78;
    s.addShape(pptx.ShapeType.rect, { x: 6.15, y, w: 3.3, h: 0.64, fill: { color: "241D16" }, line: { color: col, width: 1 } });
    s.addText(r, { x: 6.3, y: y + 0.07, w: 1.9, h: 0.2, fontFace: BODY, fontSize: 8, bold: true, color: col, charSpacing: 1, margin: 0 });
    s.addText(sub, { x: 6.3, y: y + 0.28, w: 1.95, h: 0.28, fontFace: BODY, fontSize: 9, color: "C9BFA8", margin: 0 });
    s.addText(amt, { x: 8.3, y: y + 0.18, w: 1.03, h: 0.32, fontFace: HEAD, fontSize: 11, bold: true, color: PAPER, margin: 0, align: "right" });
  });
  s.addShape(pptx.ShapeType.rect, { x: 6.15, y: 3.32, w: 3.3, h: 0.72, fill: { color: CRITICAL } });
  s.addText("$2,459,000", { x: 6.3, y: 3.4, w: 3.0, h: 0.36, fontFace: HEAD, fontSize: 19, bold: true, color: PAPER, margin: 0 });
  s.addText("total single-counterparty exposure", { x: 6.3, y: 3.74, w: 3.0, h: 0.22, fontFace: BODY, fontSize: 8.5, color: "F0D9D2", margin: 0 });
  s.addText("Split across two counterparties' documents — one disclosure buried on a second worksheet.", {
    x: M, y: H - 0.5, w: CW, h: 0.3, fontFace: BODY, fontSize: 9, italic: true, color: INK_FAINT, margin: 0,
  });
}

/* --------------------------------------------------------------- 5. Product */
{
  const s = lightSlide("The product", "Forward the statements you already receive");
  s.addText(
    "No migration, no onboarding project, no data-mapping engagement. Documents arrive in whatever format the counterparty sent them; the graph re-derives itself and every finding updates.",
    { x: M, y: 1.5, w: 8.6, h: 0.72, fontFace: BODY, fontSize: 12.5, color: INK_SOFT, margin: 0, lineSpacingMultiple: 1.1 }
  );
  const steps = ["Upload\nor email", "Extract\n(LLM)", "Resolve\nentities", "Typed\ngraph", "Traverse\npaths", "Findings\n+ alerts"];
  const sw = 1.35, sg = 0.16;
  steps.forEach((t, i) => {
    const x = M + i * (sw + sg);
    const isKey = i === 2;
    s.addShape(pptx.ShapeType.rect, { x, y: 2.3, w: sw, h: 0.96, fill: { color: isKey ? CRITICAL : PAPER_RAISED }, line: { color: isKey ? CRITICAL : RULE, width: 1 } });
    s.addText(t, { x: x + 0.06, y: 2.42, w: sw - 0.12, h: 0.72, fontFace: BODY, fontSize: 10.5, bold: true, color: isKey ? PAPER : INK, align: "center", margin: 0, lineSpacingMultiple: 1.02 });
    if (i < steps.length - 1) {
      s.addText("→", { x: x + sw, y: 2.62, w: sg, h: 0.3, fontFace: BODY, fontSize: 12, color: INK_FAINT, align: "center", margin: 0 });
    }
  });
  s.addText("Entity resolution is the critical path — if two spellings of one company don't merge, every finding evaporates.", {
    x: M, y: 3.36, w: 8.6, h: 0.3, fontFace: BODY, fontSize: 10, italic: true, color: CRITICAL, margin: 0,
  });

  const proof = [["Live", "deployed and ingesting"], ["14s", "document to updated finding"], ["3", "findings derived, none hardcoded"]];
  proof.forEach(([n, l], i) => {
    const x = M + i * 2.95;
    s.addShape(pptx.ShapeType.rect, { x, y: 3.86, w: 2.75, h: 0.7, fill: { color: PAPER_RAISED }, line: { color: RULE, width: 1 } });
    s.addText(n, { x: x + 0.14, y: 3.94, w: 1.0, h: 0.32, fontFace: HEAD, fontSize: 16, bold: true, color: CRITICAL, margin: 0 });
    s.addText(l, { x: x + 0.14, y: 4.24, w: 2.5, h: 0.26, fontFace: BODY, fontSize: 9.5, color: INK_SOFT, margin: 0 });
  });
  footnote(s, "Measured on the live deployment: a previously unseen loan schedule ingested, entity-resolved, and surfaced as a new finding in 14 seconds.");
}

/* ------------------------------------------------------------------- 6. Moat */
{
  const s = lightSlide("The architectural bet", "One typed edge table is the whole moat");
  s.addShape(pptx.ShapeType.rect, { x: M, y: 1.56, w: 4.28, h: 2.56, fill: { color: PAPER_RAISED }, line: { color: RULE, width: 1 } });
  s.addText("CONVENTIONAL MODEL", { x: M + 0.18, y: 1.7, w: 3.9, h: 0.24, fontFace: BODY, fontSize: 9, bold: true, color: INK_FAINT, charSpacing: 1.2, margin: 0 });
  s.addText("Asset class is a fixed axis of the schema. PE holdings in one table, credit in another, real estate in a third.", {
    x: M + 0.18, y: 1.98, w: 3.9, h: 0.78, fontFace: BODY, fontSize: 11, color: INK_SOFT, margin: 0, lineSpacingMultiple: 1.08,
  });
  s.addText("A borrower ID and a portfolio-company row are different objects in different systems — even when they are the same company.", {
    x: M + 0.18, y: 2.82, w: 3.9, h: 0.84, fontFace: BODY, fontSize: 11, color: INK_SOFT, margin: 0, lineSpacingMultiple: 1.08,
  });
  s.addText("Cannot be retrofitted cheaply.", { x: M + 0.18, y: 3.76, w: 3.9, h: 0.28, fontFace: BODY, fontSize: 10.5, bold: true, color: INK_FAINT, margin: 0 });

  s.addShape(pptx.ShapeType.rect, { x: 5.17, y: 1.56, w: 4.28, h: 2.56, fill: { color: PAPER_RAISED }, line: { color: CRITICAL, width: 1.5 } });
  s.addText("OURS", { x: 5.35, y: 1.7, w: 3.9, h: 0.24, fontFace: BODY, fontSize: 9, bold: true, color: CRITICAL, charSpacing: 1.2, margin: 0 });
  const rules = [
    "One typed edges table — equity, debt and guarantees are edges between the same nodes.",
    "Guarantees are a first-class edge type, never a note on a loan record.",
    "Every value carries an as-of date and a confidence score. Not null, no exceptions.",
  ];
  rules.forEach((r, i) => {
    const y = 1.98 + i * 0.6;
    s.addText(`${i + 1}`, { x: 5.35, y, w: 0.26, h: 0.26, fontFace: HEAD, fontSize: 13, bold: true, color: CRITICAL, margin: 0 });
    s.addText(r, { x: 5.66, y, w: 3.6, h: 0.56, fontFace: BODY, fontSize: 10.5, color: INK, margin: 0, lineSpacingMultiple: 1.06 });
  });
  s.addText("Enforced in the schema, not by convention.", { x: 5.35, y: 3.82, w: 3.9, h: 0.28, fontFace: BODY, fontSize: 10.5, bold: true, color: CRITICAL, margin: 0 });
  footnote(s, "This single modelling choice is what makes the headline finding computable — and what an asset-class-siloed incumbent cannot adopt without a rewrite.");
}

/* ------------------------------------------------------------ 7. Competition */
{
  const s = lightSlide("Competitive landscape", "We do not claim a green field");
  const rows = [
    ["Aleta", "Capital-call and distribution forecasting, J-curve, stress testing", "Company-level look-through", HIGH],
    ["Masttro", "Fund-layer look-through, concentration flags by GP and vintage", "Forward liquidity modelling", HIGH],
    ["Canoe", "Best-in-class alternative-asset document extraction", "A pipe, not a risk engine", INK_FAINT],
    ["Addepar", "Multi-asset reporting and aggregation at scale", "Backward-looking, fund-level", INK_FAINT],
  ];
  s.addText("VENDOR", { x: M + 0.14, y: 1.52, w: 1.12, h: 0.22, fontFace: BODY, fontSize: 8.5, bold: true, color: INK_FAINT, charSpacing: 1, margin: 0 });
  s.addText("SHIPS TODAY", { x: 1.95, y: 1.52, w: 4.2, h: 0.22, fontFace: BODY, fontSize: 8.5, bold: true, color: INK_FAINT, charSpacing: 1, margin: 0 });
  s.addText("DOESN'T", { x: 6.3, y: 1.52, w: 3.1, h: 0.22, fontFace: BODY, fontSize: 8.5, bold: true, color: INK_FAINT, charSpacing: 1, margin: 0 });
  rows.forEach(([v, does, doesnt, col], i) => {
    const y = 1.8 + i * 0.52;
    s.addShape(pptx.ShapeType.rect, { x: M, y, w: CW, h: 0.46, fill: { color: i % 2 ? PAPER : PAPER_RAISED }, line: { color: RULE, width: 0.5 } });
    s.addText(v, { x: M + 0.14, y: y + 0.11, w: 1.15, h: 0.26, fontFace: HEAD, fontSize: 12, bold: true, color: col, margin: 0 });
    s.addText(does, { x: 1.95, y: y + 0.12, w: 4.25, h: 0.26, fontFace: BODY, fontSize: 9.5, color: INK, margin: 0 });
    s.addText(doesnt, { x: 6.3, y: y + 0.12, w: 3.1, h: 0.26, fontFace: BODY, fontSize: 9.5, color: INK_SOFT, margin: 0 });
  });
  s.addShape(pptx.ShapeType.rect, { x: M, y: 4.02, w: CW, h: 0.82, fill: { color: "F6DED6" } });
  s.addText("The seam: nobody connects the two, and nobody crosses asset classes. Aleta forecasts your cash. Masttro sees through your funds. Both require you to migrate onto a platform first.", {
    x: M + 0.18, y: 4.12, w: 8.5, h: 0.62, fontFace: BODY, fontSize: 11, bold: true, color: "5C1710", margin: 0, lineSpacingMultiple: 1.08,
  });
  footnote(s, "Aleta launched May 2026 — evidence the problem is urgent and funded, not evidence we are late.");
}

/* -------------------------------------------------- 8. Market & value (KEY) */
{
  const s = lightSlide("Value analysis", "What it's worth to them — and to us");

  s.addText("VALUE TO THE CUSTOMER", { x: M, y: 1.5, w: 4.2, h: 0.22, fontFace: BODY, fontSize: 9, bold: true, color: CRITICAL, charSpacing: 1.2, margin: 0 });
  const roi = [
    ["$307,500", "stressed liquidity gap detected"],
    ["$12,480,000", "NAV exposed to forced sale — 41×"],
    ["~$2.5M", "preserved by avoiding one 20% forced drawdown"],
  ];
  roi.forEach(([n, l], i) => {
    const y = 1.8 + i * 0.62;
    s.addShape(pptx.ShapeType.rect, { x: M, y, w: 4.2, h: 0.54, fill: { color: PAPER_RAISED }, line: { color: RULE, width: 1 } });
    s.addShape(pptx.ShapeType.rect, { x: M, y, w: 0.045, h: 0.54, fill: { color: CRITICAL } });
    s.addText(n, { x: M + 0.16, y: y + 0.06, w: 1.6, h: 0.28, fontFace: HEAD, fontSize: 14, bold: true, color: INK, margin: 0 });
    s.addText(l, { x: M + 1.8, y: y + 0.1, w: 2.3, h: 0.36, fontFace: BODY, fontSize: 9.5, color: INK_SOFT, margin: 0, lineSpacingMultiple: 1.02 });
  });
  s.addShape(pptx.ShapeType.rect, { x: M, y: 3.68, w: 4.2, h: 0.6, fill: { color: "F6DED6" } });
  s.addText("At a $24k subscription, one avoided event returns ~100×.", {
    x: M + 0.16, y: 3.78, w: 3.9, h: 0.42, fontFace: BODY, fontSize: 11, bold: true, color: "5C1710", margin: 0, lineSpacingMultiple: 1.04,
  });

  s.addText("MARKET SIZE — MODELLED, ASSUMPTIONS STATED", { x: 5.15, y: 1.5, w: 4.3, h: 0.22, fontFace: BODY, fontSize: 9, bold: true, color: CRITICAL, charSpacing: 1.2, margin: 0 });
  const mkt = [
    ["Beachhead — single family offices", "~8,000 globally × $24k", "$0.19B", 1.15, CRITICAL],
    ["Expansion — MFOs and RIAs with alts", "~30,000 firms × $18k", "$0.54B", 2.35, HIGH],
    ["Platform — allocators in private markets", "endowments, foundations, insurers", "$1.00B", 4.3, SLATE],
  ];
  mkt.forEach(([label, assum, val, wid, col], i) => {
    const y = 1.82 + i * 0.78;
    s.addText(label, { x: 5.15, y, w: 3.2, h: 0.22, fontFace: BODY, fontSize: 10, bold: true, color: INK, margin: 0 });
    s.addText(val, { x: 8.4, y, w: 1.05, h: 0.22, fontFace: HEAD, fontSize: 12, bold: true, color: col, margin: 0, align: "right" });
    s.addShape(pptx.ShapeType.rect, { x: 5.15, y: y + 0.26, w: 4.3, h: 0.17, fill: { color: "E6DDC8" } });
    s.addShape(pptx.ShapeType.rect, { x: 5.15, y: y + 0.26, w: wid, h: 0.17, fill: { color: col } });
    s.addText(assum, { x: 5.15, y: y + 0.45, w: 4.3, h: 0.2, fontFace: BODY, fontSize: 8.5, color: INK_FAINT, italic: true, margin: 0 });
  });
  s.addShape(pptx.ShapeType.rect, { x: 5.15, y: 4.16, w: 4.3, h: 0.44, fill: { color: PAPER_RAISED }, line: { color: RULE, width: 1 } });
  s.addText("Total addressable ≈ $1.7B  ·  3-yr SOM target $8–12M ARR", {
    x: 5.28, y: 4.23, w: 4.12, h: 0.3, fontFace: BODY, fontSize: 9.5, bold: true, color: INK, margin: 0,
  });
  footnote(s, "Firm counts are industry estimates requiring verification in diligence. ACV assumptions are ours. Customer-value figures are computed by the live product, not modelled.");
}

/* ------------------------------------------------------- 9. Model and motion */
{
  const s = lightSlide("Business model", "Sold by inbox, not by migration");
  s.addText(
    "Every incumbent is a platform you migrate onto: enterprise pricing, onboarding, data-mapping. They sell to family offices that already have staff and budget — which is not the 73% with the data problem.",
    { x: M, y: 1.5, w: 8.6, h: 0.74, fontFace: BODY, fontSize: 12.5, color: INK_SOFT, margin: 0, lineSpacingMultiple: 1.1 }
  );
  const tiers = [
    ["Single office", "$18–30k", "One family office, unlimited documents, all findings", CRITICAL],
    ["Multi-family", "$60–120k", "Per-client segregation, adviser seats, exports", HIGH],
    ["Allocator", "Custom", "API access, scheduled ingestion, audit exports", SLATE],
  ];
  tiers.forEach(([name, price, desc, col], i) => {
    const x = M + i * 3.02;
    s.addShape(pptx.ShapeType.rect, { x, y: 2.24, w: 2.85, h: 1.42, fill: { color: PAPER_RAISED }, line: { color: RULE, width: 1 } });
    s.addShape(pptx.ShapeType.rect, { x, y: 2.24, w: 2.85, h: 0.05, fill: { color: col } });
    s.addText(name.toUpperCase(), { x: x + 0.16, y: 2.4, w: 2.5, h: 0.22, fontFace: BODY, fontSize: 9, bold: true, color: col, charSpacing: 1, margin: 0 });
    s.addText(price, { x: x + 0.16, y: 2.64, w: 2.5, h: 0.36, fontFace: HEAD, fontSize: 18, bold: true, color: INK, margin: 0 });
    s.addText(desc, { x: x + 0.16, y: 3.04, w: 2.5, h: 0.56, fontFace: BODY, fontSize: 9.5, color: INK_SOFT, margin: 0, lineSpacingMultiple: 1.06 });
  });
  s.addText("Land: forward one statement, get an answer in 60 seconds — no procurement.    Expand: every new document deepens the graph and raises switching cost.", {
    x: M, y: 3.82, w: 8.6, h: 0.5, fontFace: BODY, fontSize: 11, color: INK, margin: 0, lineSpacingMultiple: 1.08,
  });
  footnote(s, "Pricing is an assumption benchmarked below enterprise incumbents, deliberately positioned for the cohort that cannot buy them.");
}

/* --------------------------------------------------------- 10. Status & ask */
{
  const s = darkSlide();
  s.addText("STATUS AND ASK", { x: M, y: 0.5, w: CW, h: 0.26, fontFace: BODY, fontSize: 10.5, bold: true, color: CRITICAL, charSpacing: 2, margin: 0 });
  s.addText("Built, deployed, ingesting.", { x: M, y: 0.86, w: 6.5, h: 0.6, fontFace: HEAD, fontSize: 30, bold: true, color: PAPER, margin: 0 });

  const built = [
    "Live application ingesting PDFs and spreadsheets end to end",
    "Typed exposure graph with LLM entity resolution across spellings",
    "Findings derived from rules, not hardcoded — new documents produce new findings",
    "Liquidity stress model benchmarked to the Cambridge 3× standard",
  ];
  s.addText("SHIPPED", { x: M, y: 1.66, w: 4.3, h: 0.22, fontFace: BODY, fontSize: 9, bold: true, color: INK_FAINT, charSpacing: 1.2, margin: 0 });
  built.forEach((b, i) => {
    const y = 1.94 + i * 0.46;
    s.addText("—", { x: M, y, w: 0.22, h: 0.24, fontFace: BODY, fontSize: 11, color: CRITICAL, margin: 0 });
    s.addText(b, { x: M + 0.26, y, w: 4.1, h: 0.44, fontFace: BODY, fontSize: 10, color: "C9BFA8", margin: 0, lineSpacingMultiple: 1.04 });
  });

  s.addText("NEXT", { x: 5.35, y: 1.66, w: 4.1, h: 0.22, fontFace: BODY, fontSize: 9, bold: true, color: INK_FAINT, charSpacing: 1.2, margin: 0 });
  const next = [
    "Inbound email ingestion — the zero-friction acquisition motion",
    "Design-partner cohort of single family offices",
    "Alerting on graph deltas, not just on-demand review",
    "Audit-grade exports for advisers and auditors",
  ];
  next.forEach((b, i) => {
    const y = 1.94 + i * 0.46;
    s.addText("—", { x: 5.35, y, w: 0.22, h: 0.24, fontFace: BODY, fontSize: 11, color: HIGH, margin: 0 });
    s.addText(b, { x: 5.61, y, w: 3.85, h: 0.44, fontFace: BODY, fontSize: 10, color: "C9BFA8", margin: 0, lineSpacingMultiple: 1.04 });
  });

  s.addShape(pptx.ShapeType.rect, { x: M, y: 4.12, w: CW, h: 0.72, fill: { color: CRITICAL } });
  s.addText("Seeking design partners and pre-seed capital to convert a working engine into a funded product.", {
    x: M + 0.2, y: 4.24, w: 8.5, h: 0.5, fontFace: HEAD, fontSize: 13, bold: true, color: PAPER, margin: 0,
  });
  s.addText("cyrdeck-familyoffice.vercel.app", { x: M, y: H - 0.36, w: 5, h: 0.24, fontFace: BODY, fontSize: 9.5, color: INK_FAINT, margin: 0 });
}

pptx.writeFile({ fileName: "presentation/Cyrdeck_Exposure_Graph_VC_Deck.pptx" })
  .then((f) => console.log("written:", f));
