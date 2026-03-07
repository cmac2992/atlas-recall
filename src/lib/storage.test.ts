import {
  createDefaultPersistedState,
  loadPersistedState,
  savePersistedState,
  selectPreferredBestRun,
  STORAGE_KEY
} from "./storage";

describe("storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("falls back to defaults when the schema version is invalid", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 999
      })
    );

    expect(loadPersistedState()).toEqual(createDefaultPersistedState());
  });

  it("round-trips persisted state", () => {
    const state = {
      schemaVersion: 4 as const,
      bestRun: null,
      inProgressSession: null
    };

    savePersistedState(state);

    expect(loadPersistedState()).toEqual(state);
  });

  it("migrates the previous schema into the naming-only state", () => {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 3,
        bestRuns: {
          find_country_on_map: null,
          name_clicked_country: {
            gameMode: "name_clicked_country",
            startedAt: 1,
            elapsedMs: 100,
            wrongClicks: 0,
            skipsUsed: 0,
            revisitedCountries: 0,
            firstTryCorrect: 2,
            completedCountries: 2,
            totalCountries: 10
          }
        },
        inProgressSession: {
          gameMode: "name_clicked_country",
          remainingQueue: [],
          revisitQueue: [],
          currentPrompt: null,
          selectedMapCountryId: "ca",
          answered: {},
          stats: {
            gameMode: "name_clicked_country",
            startedAt: 2,
            elapsedMs: 50,
            wrongClicks: 0,
            skipsUsed: 0,
            revisitedCountries: 0,
            firstTryCorrect: 0,
            completedCountries: 0,
            totalCountries: 10
          }
        }
      })
    );

    expect(loadPersistedState()).toEqual({
      schemaVersion: 4,
      bestRun: {
        startedAt: 1,
        elapsedMs: 100,
        wrongClicks: 0,
        skipsUsed: 0,
        revisitedCountries: 0,
        firstTryCorrect: 2,
        completedCountries: 2,
        totalCountries: 10
      },
      inProgressSession: {
        selectedMapCountryId: "ca",
        answered: {},
        stats: {
          startedAt: 2,
          elapsedMs: 50,
          wrongClicks: 0,
          skipsUsed: 0,
          revisitedCountries: 0,
          firstTryCorrect: 0,
          completedCountries: 0,
          totalCountries: 10
        }
      }
    });
  });

  it("prefers more complete runs over faster partial ones", () => {
    const preferred = selectPreferredBestRun(
      {
        startedAt: 1,
        completedAt: 101,
        elapsedMs: 100,
        wrongClicks: 0,
        skipsUsed: 0,
        revisitedCountries: 0,
        firstTryCorrect: 5,
        completedCountries: 5,
        totalCountries: 10
      },
      {
        startedAt: 2,
        completedAt: 202,
        elapsedMs: 200,
        wrongClicks: 3,
        skipsUsed: 1,
        revisitedCountries: 0,
        firstTryCorrect: 8,
        completedCountries: 8,
        totalCountries: 10
      }
    );

    expect(preferred.completedCountries).toBe(8);
  });
});
