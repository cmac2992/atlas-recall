import { memo, useEffect, useState } from "react";
import type { SessionStats } from "../game/gameTypes";
import { formatDuration } from "../../lib/format";

interface RunTimerProps {
  stats: SessionStats;
}

export const RunTimer = memo(function RunTimer({ stats }: RunTimerProps) {
  const [elapsedMs, setElapsedMs] = useState(() =>
    stats.completedAt ? stats.elapsedMs : Math.max(0, Date.now() - stats.startedAt)
  );

  useEffect(() => {
    if (stats.completedAt) {
      setElapsedMs(stats.elapsedMs);
      return undefined;
    }

    setElapsedMs(Math.max(0, Date.now() - stats.startedAt));

    const intervalId = window.setInterval(() => {
      setElapsedMs(Math.max(0, Date.now() - stats.startedAt));
    }, 1_000);

    return () => window.clearInterval(intervalId);
  }, [stats.completedAt, stats.elapsedMs, stats.startedAt]);

  return <strong>{formatDuration(elapsedMs)}</strong>;
});
