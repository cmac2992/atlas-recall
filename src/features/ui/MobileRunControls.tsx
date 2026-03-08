import { memo, useEffect, useRef, useState } from "react";
import type { SessionStats } from "../game/gameTypes";
import { formatPercent } from "../../lib/format";
import { RunTimer } from "./RunTimer";

interface MobileRunControlsProps {
  onDone: () => void;
  remainingPrompts: number;
  stats: SessionStats;
}

export const MobileRunControls = memo(function MobileRunControls({
  onDone,
  remainingPrompts,
  stats
}: MobileRunControlsProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [isMenuOpen]);

  return (
    <div className="mobile-run-controls" ref={menuRef}>
      {isMenuOpen ? (
        <section className="mobile-run-menu">
          <div className="mobile-run-menu__header">
            <h2>Run details</h2>
            <button
              aria-label="Hide run details"
              className="mobile-run-menu__close"
              type="button"
              onClick={() => {
                setIsMenuOpen(false);
              }}
            >
              Hide
            </button>
          </div>
          <div className="mobile-run-menu__grid">
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
          <p className="mobile-run-menu__meta">
            First-try {formatPercent(stats.firstTryCorrect, stats.totalCountries)}. Skips{" "}
            {stats.skipsUsed}.
          </p>
        </section>
      ) : null}
      <div className="mobile-run-controls__bar">
        <button
          aria-expanded={isMenuOpen}
          aria-label={isMenuOpen ? "Hide run details" : "Show run details"}
          className="button button--toolbar mobile-run-controls__menu-button"
          type="button"
          onClick={() => {
            setIsMenuOpen((currentValue) => !currentValue);
          }}
        >
          {isMenuOpen ? "Hide" : "Stats"}
        </button>
        <button
          className="button button--primary mobile-run-controls__done-button"
          type="button"
          onClick={onDone}
        >
          Submit run
        </button>
      </div>
    </div>
  );
});
