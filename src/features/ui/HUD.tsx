import { memo } from "react";
import type { CountryRecord, SessionStats } from "../game/gameTypes";
import { formatPercent } from "../../lib/format";
import { CountryCombobox } from "./CountryCombobox";
import { RunTimer } from "./RunTimer";

interface HUDProps {
  availableCountries: CountryRecord[];
  canAdvance: boolean;
  canGoBack: boolean;
  feedbackMessage: string;
  onClearSelection: () => void;
  onDone: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSubmitCountryName: (countryId: string) => void;
  remainingPrompts: number;
  selectedCountryId: string | null;
  stats: SessionStats;
}

export const HUD = memo(function HUD({
  availableCountries,
  canAdvance,
  canGoBack,
  feedbackMessage,
  onClearSelection,
  onDone,
  onNext,
  onPrevious,
  onSubmitCountryName,
  remainingPrompts,
  selectedCountryId,
  stats
}: HUDProps) {
  return (
    <aside className="hud-card">
      <div className="hud-card__toolbar">
        <div className="hud-card__nav">
          <button
            aria-label="Previous country"
            className="button button--toolbar button--nav"
            disabled={!canGoBack}
            type="button"
            onClick={onPrevious}
          >
            <span>Prev</span>
            <span aria-hidden="true" className="button__hint">
              ←
            </span>
          </button>
          <button
            aria-label="Next country"
            className="button button--toolbar button--nav button--nav-next"
            disabled={!canAdvance}
            type="button"
            onClick={onNext}
          >
            <span>Next</span>
            <span aria-hidden="true" className="button__hint">
              →
            </span>
          </button>
        </div>
        <button
          className="button button--toolbar button--primary button--done"
          type="button"
          onClick={onDone}
        >
          Done
        </button>
      </div>
      <CountryCombobox
        countries={availableCountries}
        onClear={onClearSelection}
        onSubmit={onSubmitCountryName}
        selectedCountryId={selectedCountryId}
      />
      <div className="hud-metrics hud-metrics--compact">
        <div>
          <span>Solved</span>
          <strong>
            {stats.completedCountries}/{stats.totalCountries}
          </strong>
        </div>
        <div>
          <span>Left</span>
          <strong>{remainingPrompts}</strong>
        </div>
        <div>
          <span>Wrong</span>
          <strong>{stats.wrongClicks}</strong>
        </div>
        <div>
          <span>Time</span>
          <RunTimer stats={stats} />
        </div>
      </div>
      <p className="hud-card__feedback">
        {feedbackMessage} First-try: {formatPercent(stats.firstTryCorrect, stats.totalCountries)}.
      </p>
    </aside>
  );
});
