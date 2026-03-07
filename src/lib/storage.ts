import type { GameSession, PersistedState, SessionStats } from "../features/game/gameTypes";

export const STORAGE_KEY = "atlas-recall-state";
export const CURRENT_SCHEMA_VERSION = 4;

export function createDefaultPersistedState(): PersistedState {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    bestRun: null,
    inProgressSession: null
  };
}

// We validate old saved data before trusting it. Local storage can contain data
// from older versions of the app, manual edits, or corrupted browser state.
function isSessionStats(value: unknown): value is SessionStats {
  if (!value || typeof value !== "object") {
    return false;
  }

  const stats = value as Partial<SessionStats>;

  return (
    typeof stats.startedAt === "number" &&
    typeof stats.elapsedMs === "number" &&
    typeof stats.wrongClicks === "number" &&
    typeof stats.skipsUsed === "number" &&
    typeof stats.revisitedCountries === "number" &&
    typeof stats.firstTryCorrect === "number" &&
    typeof stats.completedCountries === "number" &&
    typeof stats.totalCountries === "number"
  );
}

// Strip a stats object down to the exact fields we still support. This lets us
// migrate older saved objects without carrying dead fields forward forever.
function sanitizeStats(stats: SessionStats): SessionStats {
  return {
    startedAt: stats.startedAt,
    ...(typeof stats.completedAt === "number" ? { completedAt: stats.completedAt } : {}),
    elapsedMs: stats.elapsedMs,
    wrongClicks: stats.wrongClicks,
    skipsUsed: stats.skipsUsed,
    revisitedCountries: stats.revisitedCountries,
    firstTryCorrect: stats.firstTryCorrect,
    completedCountries: stats.completedCountries,
    totalCountries: stats.totalCountries
  };
}

// Older builds stored extra fields for abandoned game modes. We accept that old
// shape, but immediately convert it to the smaller naming-only session format.
function migrateSession(value: unknown): GameSession | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const session = value as Partial<GameSession> & {
    gameMode?: string;
    currentPrompt?: unknown;
    remainingQueue?: unknown;
    revisitQueue?: unknown;
  };

  if (session.gameMode && session.gameMode !== "name_clicked_country") {
    return null;
  }

  if (!isSessionStats(session.stats)) {
    return null;
  }

  return {
    selectedMapCountryId:
      typeof session.selectedMapCountryId === "string" ? session.selectedMapCountryId : null,
    answered:
      session.answered && typeof session.answered === "object" ? session.answered : {},
    stats: sanitizeStats(session.stats)
  };
}

// Schema 3 was the last "multi-mode" version. Schema 4 is the simplified
// naming-only format. This function is the single place that knows how to bridge
// between them.
function migratePersistedState(rawState: unknown): PersistedState {
  if (!rawState || typeof rawState !== "object") {
    return createDefaultPersistedState();
  }

  const parsedState = rawState as {
    schemaVersion?: number;
    bestRun?: unknown;
    bestRuns?: { name_clicked_country?: unknown };
    inProgressSession?: unknown;
  };

  if (
    parsedState.schemaVersion !== CURRENT_SCHEMA_VERSION &&
    parsedState.schemaVersion !== 3
  ) {
    return createDefaultPersistedState();
  }

  const bestRunCandidate =
    parsedState.schemaVersion === 3
      ? parsedState.bestRuns?.name_clicked_country
      : parsedState.bestRun;

  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    bestRun: isSessionStats(bestRunCandidate) ? sanitizeStats(bestRunCandidate) : null,
    inProgressSession: migrateSession(parsedState.inProgressSession)
  };
}

export function loadPersistedState(): PersistedState {
  if (typeof window === "undefined") {
    return createDefaultPersistedState();
  }

  const rawState = window.localStorage.getItem(STORAGE_KEY);

  if (!rawState) {
    return createDefaultPersistedState();
  }

  try {
    return migratePersistedState(JSON.parse(rawState));
  } catch {
    return createDefaultPersistedState();
  }
}

export function savePersistedState(state: PersistedState) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore quota and private-mode storage failures.
  }
}

// More countries solved is always better than fewer, even if the faster run was
// quicker. Time only breaks ties after completion count.
function getRunScore(stats: SessionStats) {
  return {
    completedCountries: stats.completedCountries,
    elapsedMs: stats.elapsedMs,
    wrongClicks: stats.wrongClicks,
    skipsUsed: stats.skipsUsed
  };
}

export function selectPreferredBestRun(
  currentBestRun: SessionStats | null,
  candidateRun: SessionStats
) {
  if (!currentBestRun) {
    return candidateRun;
  }

  const currentScore = getRunScore(currentBestRun);
  const candidateScore = getRunScore(candidateRun);

  if (candidateScore.completedCountries > currentScore.completedCountries) {
    return candidateRun;
  }

  if (candidateScore.completedCountries < currentScore.completedCountries) {
    return currentBestRun;
  }

  if (candidateScore.elapsedMs < currentScore.elapsedMs) {
    return candidateRun;
  }

  if (candidateScore.elapsedMs > currentScore.elapsedMs) {
    return currentBestRun;
  }

  if (candidateScore.wrongClicks < currentScore.wrongClicks) {
    return candidateRun;
  }

  if (candidateScore.wrongClicks > currentScore.wrongClicks) {
    return currentBestRun;
  }

  if (candidateScore.skipsUsed < currentScore.skipsUsed) {
    return candidateRun;
  }

  return currentBestRun;
}
