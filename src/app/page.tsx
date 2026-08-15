"use client";

import { useMemo } from "react";
import { Hero } from "@/components/dashboard/Hero";
import { FindingCard } from "@/components/dashboard/FindingCard";
import { ExposureTable } from "@/components/dashboard/ExposureTable";
import { LiquidityPanel } from "@/components/dashboard/LiquidityPanel";
import { UploadPanel } from "@/components/dashboard/UploadPanel";
import { DocumentsPanel } from "@/components/dashboard/DocumentsPanel";
import { rankFindings } from "@/components/dashboard/findings";
import { useExposure, useLiquidity } from "@/components/dashboard/useDashboardData";
import { useDocuments } from "@/components/dashboard/useDocuments";
import { formatDate, formatMoney } from "@/components/dashboard/format";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { EmptyState } from "@/components/ui/EmptyState";

export default function Home() {
  const exposure = useExposure();
  const liquidity = useLiquidity();
  const documents = useDocuments();

  const refreshAll = () => {
    exposure.reload();
    liquidity.reload();
    documents.reload();
  };
  const isRefreshing = exposure.state.status === "loading" || liquidity.state.status === "loading";

  const rankedFindings = useMemo(() => {
    if (exposure.state.status !== "ready") return [];
    return rankFindings(exposure.state.data.findings);
  }, [exposure.state]);

  const topFinding = rankedFindings[0];
  const restFindings = rankedFindings.slice(1);

  // Naively summing every figure in the document set — funds AND the companies
  // reached through them — double-counts by construction. Computed live from
  // whatever entities exist, never a fixed demo number, precisely so it stays wrong
  // in a way that is honest about being wrong.
  const naiveSum = useMemo(() => {
    if (exposure.state.status !== "ready") return undefined;
    // Guarantee notional is deliberately excluded. A guarantee is a contingent
    // liability, not a balance — even a naive spreadsheet would not add it to a
    // portfolio total, so including it would overstate the strawman rather than
    // represent it fairly. The double-counting of look-through IS the point and stays.
    return exposure.state.data.entities.reduce((sum, e) => sum + e.directTotal, 0);
  }, [exposure.state]);

  const asOfChips = useMemo(() => {
    const dates = new Set<string>();
    if (exposure.state.status === "ready") {
      for (const e of exposure.state.data.entities) {
        if (e.asOfEarliest) dates.add(e.asOfEarliest);
        if (e.asOfLatest) dates.add(e.asOfLatest);
      }
    }
    if (liquidity.state.status === "ready") {
      for (const d of liquidity.state.data.asOfDates) dates.add(d);
    }
    return Array.from(dates).sort();
  }, [exposure.state, liquidity.state]);

  const generatedAt =
    exposure.state.status === "ready" ? exposure.state.data.generatedAt : undefined;
  const rootName = exposure.state.status === "ready" ? exposure.state.data.root : undefined;
  const peBookValue = exposure.state.status === "ready" ? exposure.state.data.peBookValue : 0;
  const totalFindingsCount = rankedFindings.length + (liquidity.state.status === "ready" ? 1 : 0);
  const isFirstRun = exposure.state.status === "ready" && exposure.state.data.entities.length === 0;

  return (
    <main className="page">
      <header className="masthead">
        <div className="masthead__title-group">
          <span className="masthead__kicker">Exposure graph · single family office</span>
          <h1 className="masthead__title">{rootName ?? "—"}</h1>
          <p className="masthead__subtitle">
            One live answer to &ldquo;what am I actually exposed to?&rdquo; — look-through
            that crosses asset classes, not just fund layers.
          </p>
        </div>
        <div className="masthead__meta">
          {asOfChips.length ? (
            <div>
              <strong>Source dates span</strong> {formatDate(asOfChips[0])} →{" "}
              {formatDate(asOfChips[asOfChips.length - 1])}
            </div>
          ) : null}
          {generatedAt ? <div>Computed {formatDate(generatedAt)}</div> : null}
          <button
            type="button"
            className="masthead__refresh"
            onClick={refreshAll}
            disabled={isRefreshing}
          >
            <svg className="masthead__refresh-icon" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d="M13.5 8a5.5 5.5 0 1 1-1.7-3.98M13.5 2v3.2h-3.2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </header>

      <section aria-labelledby="upload-heading">
        <div className="section-head">
          <span className="section-head__index">00</span>
          <h3 id="upload-heading" className="section-head__title">
            Add a document
          </h3>
          <span className="section-head__note">the engine re-derives everything below on ingest</span>
        </div>
        <UploadPanel onUploaded={refreshAll} />
      </section>

      {isFirstRun ? (
        <EmptyState
          title="No documents ingested yet"
          detail="This view will populate the moment a statement, capital call, or credit schedule is uploaded above — entities get resolved, edges get typed, and findings get derived automatically. There is nothing to fabricate here."
        />
      ) : (
        <>
          <section aria-labelledby="headline-claim">
            {exposure.state.status === "loading" ? (
              <StatusPanel kind="loading" label="the highest-severity finding" />
            ) : exposure.state.status === "error" ? (
              <StatusPanel
                kind="error"
                label="the exposure graph"
                message={exposure.state.message}
                onRetry={exposure.reload}
              />
            ) : (
              <Hero
                finding={topFinding}
                entities={exposure.state.data.entities}
                peBookValue={peBookValue}
                documentIdByFilename={documents.documentIdByFilename}
              />
            )}
          </section>

          <section aria-labelledby="findings-heading">
            <div className="section-head">
              <span className="section-head__index">02</span>
              <h3 id="findings-heading" className="section-head__title">
                {totalFindingsCount > 0 ? `${totalFindingsCount} findings` : "Findings"}
              </h3>
              <span className="section-head__note">
                {topFinding ? "1 featured above" : "ranked by severity, then amount"}
              </span>
            </div>
            {exposure.state.status === "loading" ? (
              <StatusPanel kind="loading" label="findings" />
            ) : exposure.state.status === "error" ? (
              <StatusPanel kind="error" label="findings" message={exposure.state.message} onRetry={exposure.reload} />
            ) : restFindings.length === 0 && liquidity.state.status !== "ready" ? (
              <EmptyState
                title="No other findings"
                detail="Every finding this ingest run produced is already featured above."
              />
            ) : (
              <div className="findings-grid">
                {restFindings.map((finding, i) => (
                  <FindingCard
                    key={finding.id}
                    finding={finding}
                    index={i + 2}
                    documentIdByFilename={documents.documentIdByFilename}
                  />
                ))}
                <LiquidityFindingCard index={restFindings.length + 2} />
              </div>
            )}
          </section>

          <section aria-labelledby="exposure-heading">
            <div className="section-head">
              <span className="section-head__index">03</span>
              <h3 id="exposure-heading" className="section-head__title">
                Exposure by entity
              </h3>
              {exposure.state.status === "ready" ? (
                <span className="section-head__note">
                  PE book value {formatMoney(exposure.state.data.peBookValue)}
                </span>
              ) : null}
            </div>
            {exposure.state.status === "loading" ? (
              <StatusPanel kind="loading" label="entity exposure" />
            ) : exposure.state.status === "error" ? (
              <StatusPanel
                kind="error"
                label="entity exposure"
                message={exposure.state.message}
                onRetry={exposure.reload}
              />
            ) : (
              <ExposureTable
                entities={exposure.state.data.entities}
                documentIdByFilename={documents.documentIdByFilename}
              />
            )}
          </section>

          <section aria-labelledby="liquidity-heading">
            <div className="section-head">
              <span className="section-head__index">04</span>
              <h3 id="liquidity-heading" className="section-head__title">
                Liquidity collision
              </h3>
              <span className="section-head__note">vs. Cambridge Associates 3× standard</span>
            </div>
            {liquidity.state.status === "loading" ? (
              <StatusPanel kind="loading" label="liquidity coverage" />
            ) : liquidity.state.status === "error" ? (
              <StatusPanel
                kind="error"
                label="liquidity coverage"
                message={liquidity.state.message}
                onRetry={liquidity.reload}
              />
            ) : (
              <LiquidityPanel data={liquidity.state.data} />
            )}
          </section>

          <section aria-labelledby="documents-heading">
            <div className="section-head">
              <span className="section-head__index">05</span>
              <h3 id="documents-heading" className="section-head__title">
                Documents
              </h3>
              <span className="section-head__note">
                what the system has actually ingested — click any row to open the source
              </span>
            </div>
            {documents.state.status === "loading" ? (
              <StatusPanel kind="loading" label="ingested documents" />
            ) : documents.state.status === "error" ? (
              <StatusPanel
                kind="error"
                label="ingested documents"
                message={documents.state.message}
                onRetry={documents.reload}
              />
            ) : (
              <DocumentsPanel documents={documents.state.data} />
            )}
          </section>

          <footer className="honesty-footer">
            <div className="honesty-footer__block">
              <h5>A number that never existed</h5>
              <p className="honesty-footer__naive">{formatMoney(naiveSum)}</p>
              <p>
                Naively summing every position in the document set — funds and the companies
                reached through them alike — produces this total, and it grows with every
                document ingested. But the inputs span multiple as-of dates and double-count
                by construction, so no such balance was ever true at any single moment.
                Contingent guarantees are excluded here; they are not balances. Every figure
                above is instead tagged with the date it actually describes.
              </p>
            </div>
            <div className="honesty-footer__block">
              <h5>As-of dates in this view</h5>
              <div className="honesty-footer__dates">
                {asOfChips.length
                  ? asOfChips.map((d) => (
                      <span key={d} className="honesty-footer__date">
                        {formatDate(d)}
                      </span>
                    ))
                  : "—"}
              </div>
              <p>Mixed as-of dates are part of the story, not a bug — treat any single grand total with suspicion.</p>
            </div>
          </footer>
        </>
      )}
    </main>
  );
}

/** Presents the liquidity collision as a finding-shaped card so it reads alongside the others. */
function LiquidityFindingCard({ index }: { index: number }) {
  const liquidity = useLiquidity();

  if (liquidity.state.status === "loading") {
    return <StatusPanel kind="loading" label="the liquidity collision" />;
  }
  if (liquidity.state.status === "error") {
    return (
      <StatusPanel kind="error" label="the liquidity collision" message={liquidity.state.message} onRetry={liquidity.reload} />
    );
  }

  const { stress, benchmark, asymmetry } = liquidity.state.data;

  return (
    <article className="finding-card" aria-labelledby="finding-liquidity-heading">
      <div className="finding-card__top">
        <span className="finding-card__index">{String(index).padStart(2, "0")}</span>
        <span className="severity-tag severity-tag--high">
          <span className="severity-tag__dot" aria-hidden="true" />
          High
        </span>
      </div>
      <h4 id="finding-liquidity-heading" className="finding-card__headline">
        Stressed coverage is {stress.coverage.toFixed(2)}× against an institutional
        standard of {benchmark.target.toFixed(0)}×
      </h4>
      <p className="finding-card__detail">
        Capital calls accelerate exactly as the liquid book and distributions that would
        fund them are shocked. {stress.coverage.toFixed(2)}× coverage against a{" "}
        {benchmark.target.toFixed(0)}× benchmark — and a shortfall this small puts{" "}
        {asymmetry.ratio.toFixed(0)}× its size in NAV at risk of forced selling.
      </p>
      <div className="finding-card__amount">{formatMoney(stress.shortfall)} shortfall</div>
      <p className="finding-card__entities">See section 04 for assumptions and the full simulation.</p>
    </article>
  );
}
