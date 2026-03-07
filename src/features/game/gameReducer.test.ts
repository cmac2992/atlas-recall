import { createInitialGameState, createNewSession, gameReducer } from "./gameReducer";
import type { GameState } from "./gameTypes";

function createPlayingState(): GameState {
  return {
    status: "playing",
    session: {
      selectedMapCountryId: "ar",
      answered: {},
      stats: {
        startedAt: 1_000,
        elapsedMs: 0,
        wrongClicks: 0,
        skipsUsed: 0,
        revisitedCountries: 0,
        firstTryCorrect: 0,
        completedCountries: 0,
        totalCountries: 3
      }
    },
    latestCompletedStats: null,
    lastOutcome: null
  };
}

describe("gameReducer", () => {
  it("initializes a session with correct totals", () => {
    const session = createNewSession(["ar", "br", "cl"], 1_000);

    expect(session.stats.totalCountries).toBe(3);
    expect(session.selectedMapCountryId).toBeNull();
  });

  it("selects a map country", () => {
    const state = createInitialGameState();
    const startedState = gameReducer(state, {
      type: "start_new",
      session: createNewSession(["ar", "br"], 1_000)
    });

    const nextState = gameReducer(startedState, {
      type: "select_map_country",
      countryId: "ar"
    });

    expect(nextState.session?.selectedMapCountryId).toBe("ar");
  });

  it("counts wrong guesses and advances to the provided next country", () => {
    const nextState = gameReducer(createPlayingState(), {
      type: "submit_country_name",
      countryId: "br",
      nextSelectedCountryId: "cl",
      now: 2_000
    });

    expect(nextState.session?.answered.ar.wrongClicks).toBe(1);
    expect(nextState.session?.selectedMapCountryId).toBe("cl");
    expect(nextState.session?.stats.wrongClicks).toBe(1);
  });

  it("solves the selected country and advances to the provided next country", () => {
    const nextState = gameReducer(createPlayingState(), {
      type: "submit_country_name",
      countryId: "ar",
      nextSelectedCountryId: "br",
      now: 2_000
    });

    expect(nextState.session?.answered.ar.correct).toBe(true);
    expect(nextState.session?.selectedMapCountryId).toBe("br");
    expect(nextState.session?.stats.completedCountries).toBe(1);
  });

  it("tracks first-try accuracy only on clean solves", () => {
    const wrongFirst = gameReducer(createPlayingState(), {
      type: "submit_country_name",
      countryId: "br",
      nextSelectedCountryId: "cl",
      now: 1_500
    });

    const reselectedState: GameState = {
      ...wrongFirst,
      session: wrongFirst.session
        ? {
            ...wrongFirst.session,
            selectedMapCountryId: "ar"
          }
        : null
    };

    const solved = gameReducer(reselectedState, {
      type: "submit_country_name",
      countryId: "ar",
      nextSelectedCountryId: "cl",
      now: 2_000
    });

    expect(solved.session?.stats.firstTryCorrect).toBe(0);
  });

  it("skips the selected country and advances to the provided next country", () => {
    const nextState = gameReducer(createPlayingState(), {
      type: "skip_selected_country",
      nextSelectedCountryId: "br",
      now: 2_000
    });

    expect(nextState.session?.answered.ar.skipped).toBe(true);
    expect(nextState.session?.selectedMapCountryId).toBe("br");
    expect(nextState.session?.stats.skipsUsed).toBe(1);
  });

  it("completes the run after the last correct answer", () => {
    const state: GameState = {
      status: "playing",
      session: {
        selectedMapCountryId: "ar",
        answered: {},
        stats: {
          startedAt: 1_000,
          elapsedMs: 0,
          wrongClicks: 0,
          skipsUsed: 0,
          revisitedCountries: 0,
          firstTryCorrect: 0,
          completedCountries: 0,
          totalCountries: 1
        }
      },
      latestCompletedStats: null,
      lastOutcome: null
    };

    const nextState = gameReducer(state, {
      type: "submit_country_name",
      countryId: "ar",
      nextSelectedCountryId: null,
      now: 2_000
    });

    expect(nextState.status).toBe("completed");
    expect(nextState.latestCompletedStats?.completedCountries).toBe(1);
    expect(nextState.session?.selectedMapCountryId).toBeNull();
  });

  it("locks the current stats when the run is manually finished", () => {
    const nextState = gameReducer(createPlayingState(), {
      type: "finish_run",
      now: 2_000
    });

    expect(nextState.status).toBe("completed");
    expect(nextState.latestCompletedStats?.elapsedMs).toBe(1_000);
    expect(nextState.session?.selectedMapCountryId).toBeNull();
  });
});
