export type CountryId = string;

export interface CountryRecord {
  id: CountryId;
  displayName: string;
  svgPath: string;
  centroid: [number, number];
  bbox: [number, number, number, number];
}

export interface WorldMapData {
  label: string;
  viewBox: string;
  countries: CountryRecord[];
}

export interface CountryAnswerState {
  correct: boolean;
  wrongClicks: number;
  skipped: boolean;
}

export interface SessionStats {
  startedAt: number;
  completedAt?: number;
  elapsedMs: number;
  wrongClicks: number;
  skipsUsed: number;
  revisitedCountries: number;
  firstTryCorrect: number;
  completedCountries: number;
  totalCountries: number;
}

export interface GameSession {
  selectedMapCountryId: CountryId | null;
  answered: Record<CountryId, CountryAnswerState>;
  stats: SessionStats;
}

export interface PersistedState {
  schemaVersion: 4;
  bestRun: SessionStats | null;
  inProgressSession: GameSession | null;
}

export type GuessOutcome = "correct" | "wrong" | "skipped" | null;

export interface GameState {
  status: "idle" | "playing" | "completed";
  session: GameSession | null;
  latestCompletedStats: SessionStats | null;
  lastOutcome: GuessOutcome;
}
