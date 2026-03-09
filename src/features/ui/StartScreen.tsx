import type { SessionStats } from "../game/gameTypes";
import { formatDuration, formatPercent } from "../../lib/format";

interface StartScreenProps {
  bestRun: SessionStats | null;
  canResume: boolean;
  onResume: () => void;
  onStartNew: () => void;
  resumeLabel: string | null;
  resumeMeta: string | null;
  totalCountries: number;
}

export function StartScreen({
  bestRun,
  canResume,
  onResume,
  onStartNew,
  resumeLabel,
  resumeMeta,
  totalCountries
}: StartScreenProps) {
  return (
    <section className="start-screen">
      <div className="hero-card">
        <p className="eyebrow">Atlas Recall</p>
        <h1>Learn the map by recognition, not spelling.</h1>
        <p className="hero-copy">
          Click countries on the map and identify them from autocomplete, with the
          list limited to places you have not solved yet.
        </p>
        <div className="hero-actions">
          {canResume ? (
            <button className="button button--primary" type="button" onClick={onResume}>
              Resume run
            </button>
          ) : null}
          <button className={`button${canResume ? "" : " button--primary"}`} type="button" onClick={onStartNew}>
            New game
          </button>
        </div>
        {canResume && resumeLabel ? (
          <p className="resume-copy">
            {resumeLabel}
            {resumeMeta ? ` · ${resumeMeta}` : ""}
          </p>
        ) : null}
      </div>

      <div className="info-grid">
        <article className="panel">
          <p className="eyebrow">Launch scope</p>
          <h2>{totalCountries} playable countries</h2>
          <p>
            Click a country, then identify it from autocomplete using only unsolved names.
          </p>
        </article>

        <article className="panel">
          <p className="eyebrow">Best benchmark</p>
          {bestRun ? (
            <>
              <h2>{formatDuration(bestRun.elapsedMs)}</h2>
              <p>
                {bestRun.wrongClicks} wrong clicks, {bestRun.skipsUsed} skips,{" "}
                {formatPercent(bestRun.firstTryCorrect, bestRun.totalCountries)} first-try
                accuracy.
              </p>
            </>
          ) : (
            <>
              <h2>No benchmark yet</h2>
              <p>Start a run to set your first benchmark.</p>
            </>
          )}
        </article>

        <article className="panel">
          <p className="eyebrow">Flow</p>
          <h2>Name what you click</h2>
          <p>
            After each answer, the game can walk you to a nearby unsolved country so you keep
            moving around the map instead of restarting your search from scratch.
          </p>
        </article>
      </div>
    </section>
  );
}
