import type { SessionStats } from "../game/gameTypes";
import { formatDuration, formatPercent } from "../../lib/format";

interface ResultsScreenProps {
  bestRun: SessionStats | null;
  isNewBestRun: boolean;
  onBackToStart: () => void;
  onPlayAgain: () => void;
  presentation?: "page" | "modal";
  stats: SessionStats;
  totalCountries: number;
}

export function ResultsScreen({
  bestRun,
  isNewBestRun,
  onBackToStart,
  onPlayAgain,
  presentation = "page",
  stats,
  totalCountries
}: ResultsScreenProps) {
  const solvedAllCountries = stats.completedCountries === totalCountries;

  return (
    <section
      aria-modal={presentation === "modal" ? true : undefined}
      className={`results-screen${
        presentation === "modal" ? " results-screen--modal" : ""
      }`}
      role={presentation === "modal" ? "dialog" : undefined}
    >
      <div className="hero-card">
        <p className="eyebrow">Run complete</p>
        <h1>
          {solvedAllCountries
            ? "You found every country in the deck."
            : `You found ${stats.completedCountries} of ${totalCountries} countries.`}
        </h1>
        <p className="hero-copy">
          {isNewBestRun
            ? "This is your best run so far."
            : "Wrong guesses move you onward. Skips park countries for a later revisit."}
        </p>
        <div className="hero-actions">
          <button className="button button--primary" type="button" onClick={onPlayAgain}>
            Play again
          </button>
          <button className="button" type="button" onClick={onBackToStart}>
            Back to title
          </button>
        </div>
      </div>

      <div className="info-grid">
        <article className="panel">
          <p className="eyebrow">This run</p>
          <h2>{formatDuration(stats.elapsedMs)}</h2>
          <p>
            {stats.wrongClicks} wrong clicks, {stats.skipsUsed} skips,{" "}
            {formatPercent(stats.firstTryCorrect, totalCountries)} first-try accuracy.
          </p>
        </article>

        <article className="panel">
          <p className="eyebrow">Coverage</p>
          <h2>{stats.completedCountries}</h2>
          <p>
            Countries found out of {totalCountries}. Manual revisits: {stats.revisitedCountries}.
          </p>
        </article>

        <article className="panel">
          <p className="eyebrow">Best benchmark</p>
          {bestRun ? (
            <>
              <h2>{formatDuration(bestRun.elapsedMs)}</h2>
              <p>
                {bestRun.wrongClicks} wrong clicks, {bestRun.skipsUsed} skips,{" "}
                {formatPercent(bestRun.firstTryCorrect, totalCountries)} first-try
                accuracy.
              </p>
            </>
          ) : (
            <>
              <h2>No benchmark yet</h2>
              <p>Complete a run to establish your first best time.</p>
            </>
          )}
        </article>
      </div>
    </section>
  );
}
