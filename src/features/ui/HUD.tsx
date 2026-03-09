import { memo, useEffect, useRef } from "react";
import type { CountryRecord, SessionStats } from "../game/gameTypes";
import { formatPercent } from "../../lib/format";
import { CountryCombobox } from "./CountryCombobox";
import { RunTimer } from "./RunTimer";

interface HUDProps {
  availableCountries: CountryRecord[];
  canMoveBackward: boolean;
  canMoveForward: boolean;
  feedbackMessage: string;
  onVisibleLeftChange?: (leftPx: number) => void;
  onClearSelection: () => void;
  onDone: () => void;
  onMoveBackward: () => void;
  onMoveForward: () => void;
  onSubmitCountryName: (countryId: string) => void;
  remainingPrompts: number;
  selectedCountryId: string | null;
  stats: SessionStats;
}

export const HUD = memo(function HUD({
  availableCountries,
  canMoveBackward,
  canMoveForward,
  feedbackMessage,
  onVisibleLeftChange,
  onClearSelection,
  onDone,
  onMoveBackward,
  onMoveForward,
  onSubmitCountryName,
  remainingPrompts,
  selectedCountryId,
  stats
}: HUDProps) {
  const hudRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const hudElement = hudRef.current;

    if (!hudElement || !onVisibleLeftChange || typeof window === "undefined") {
      return;
    }

    const updateVisibleLeft = () => {
      onVisibleLeftChange(hudElement.getBoundingClientRect().right);
    };

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(updateVisibleLeft);

    resizeObserver?.observe(hudElement);
    window.addEventListener("resize", updateVisibleLeft);
    window.requestAnimationFrame(updateVisibleLeft);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateVisibleLeft);
    };
  }, [onVisibleLeftChange]);

  return (
    <aside className="hud-card" ref={hudRef}>
      <div className="hud-card__toolbar">
        <div className="hud-card__nav">
          <button
            aria-label="Previous country"
            className="button button--toolbar button--nav"
            disabled={!canMoveBackward}
            type="button"
            onClick={onMoveBackward}
          >
            <span>Prev</span>
            <span aria-hidden="true" className="button__hint">
              ←
            </span>
          </button>
          <button
            aria-label="Next country"
            className="button button--toolbar button--nav button--nav-next"
            disabled={!canMoveForward}
            type="button"
            onClick={onMoveForward}
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
          Submit
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
