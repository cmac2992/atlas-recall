import type {
  CountryAnswerState,
  CountryId,
  GameSession,
  GameState,
  SessionStats
} from "./gameTypes";

interface StartNewAction {
  type: "start_new";
  session: GameSession;
}

interface ResumeAction {
  type: "resume";
  session: GameSession;
  now: number;
}

interface SelectMapCountryAction {
  type: "select_map_country";
  countryId: CountryId;
}

interface SubmitCountryNameAction {
  type: "submit_country_name";
  countryId: CountryId;
  nextSelectedCountryId: CountryId | null;
  now: number;
}

interface ClearMapSelectionAction {
  type: "clear_map_selection";
}

interface MoveOnFromSelectedCountryAction {
  type: "move_on_from_selected_country";
  nextSelectedCountryId: CountryId | null;
  now: number;
}

interface ReturnToStartAction {
  type: "return_to_start";
}

interface FinishRunAction {
  type: "finish_run";
  now: number;
}

export type GameAction =
  | StartNewAction
  | ResumeAction
  | SelectMapCountryAction
  | SubmitCountryNameAction
  | MoveOnFromSelectedCountryAction
  | ClearMapSelectionAction
  | FinishRunAction
  | ReturnToStartAction;

// The reducer stores elapsed time as a snapshot. The HUD owns the live ticking UI
// so the rest of the app does not rerender every second.
function updateElapsed(stats: SessionStats, now: number): SessionStats {
  if (stats.completedAt) {
    return {
      ...stats,
      elapsedMs: stats.completedAt - stats.startedAt
    };
  }

  return {
    ...stats,
    elapsedMs: Math.max(0, now - stats.startedAt)
  };
}

// Countries do not need to exist in the answer map until the player touches them.
function ensureAnswerState(
  answered: GameSession["answered"],
  countryId: CountryId
): CountryAnswerState {
  return answered[countryId] ?? {
    correct: false,
    wrongClicks: 0,
    skipped: false
  };
}

// A completed session freezes selection and timing so the modal can render a
// stable result summary.
function completeSession(session: GameSession, now: number) {
  const stats = updateElapsed(
    {
      ...session.stats,
      completedAt: now
    },
    now
  );

  return {
    ...session,
    selectedMapCountryId: null,
    stats
  };
}

export function createNewSession(
  countryIds: CountryId[],
  startedAt: number
) {
  return {
    selectedMapCountryId: null,
    answered: {},
    stats: {
      startedAt,
      elapsedMs: 0,
      wrongClicks: 0,
      skipsUsed: 0,
      revisitedCountries: 0,
      firstTryCorrect: 0,
      completedCountries: 0,
      totalCountries: countryIds.length
    }
  } satisfies GameSession;
}

export function createInitialGameState(): GameState {
  return {
    status: "idle",
    session: null,
    latestCompletedStats: null,
    lastOutcome: null
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === "start_new") {
    return {
      status: "playing",
      session: action.session,
      latestCompletedStats: null,
      lastOutcome: null
    };
  }

  if (action.type === "resume") {
    return {
      status: "playing",
      session: {
        ...action.session,
        stats: updateElapsed(action.session.stats, action.now)
      },
      latestCompletedStats: null,
      lastOutcome: null
    };
  }

  if (action.type === "return_to_start") {
    return {
      status: "idle",
      session: null,
      latestCompletedStats: state.latestCompletedStats,
      lastOutcome: null
    };
  }

  if (!state.session || state.status !== "playing") {
    return state;
  }

  if (action.type === "finish_run") {
    const completedSession = completeSession(state.session, action.now);

    return {
      status: "completed",
      session: completedSession,
      latestCompletedStats: completedSession.stats,
      lastOutcome: state.lastOutcome
    };
  }

  if (action.type === "clear_map_selection") {
    return {
      ...state,
      session: {
        ...state.session,
        selectedMapCountryId: null
      }
    };
  }

  if (action.type === "select_map_country") {
    if (state.session.answered[action.countryId]?.correct) {
      return state;
    }

    return {
      ...state,
      session: {
        ...state.session,
        selectedMapCountryId: action.countryId
      },
      lastOutcome: null
    };
  }

  if (action.type === "move_on_from_selected_country") {
    const selectedMapCountryId = state.session.selectedMapCountryId;

    if (!selectedMapCountryId) {
      return state;
    }

    const currentAnswer = ensureAnswerState(state.session.answered, selectedMapCountryId);

    return {
      ...state,
      session: {
        ...state.session,
        selectedMapCountryId: action.nextSelectedCountryId,
        answered: {
          ...state.session.answered,
          [selectedMapCountryId]: {
            ...currentAnswer,
            skipped: true
          }
        },
        stats: updateElapsed(
          {
            ...state.session.stats,
            skipsUsed: state.session.stats.skipsUsed + 1,
            revisitedCountries:
              state.session.stats.revisitedCountries + (currentAnswer.skipped ? 0 : 1)
          },
          action.now
        )
      },
      lastOutcome: "skipped"
    };
  }

  if (action.type !== "submit_country_name") {
    return state;
  }

  const selectedMapCountryId = state.session.selectedMapCountryId;

  if (!selectedMapCountryId) {
    return state;
  }

  const currentAnswer = ensureAnswerState(state.session.answered, selectedMapCountryId);

  // In this game, a wrong answer still moves the player onward. We keep the miss
  // on the clicked country so stats are accurate when they come back later.
  if (action.countryId !== selectedMapCountryId) {
    return {
      ...state,
      session: {
        ...state.session,
        selectedMapCountryId: action.nextSelectedCountryId,
        answered: {
          ...state.session.answered,
          [selectedMapCountryId]: {
            ...currentAnswer,
            wrongClicks: currentAnswer.wrongClicks + 1
          }
        },
        stats: updateElapsed(
          {
            ...state.session.stats,
            wrongClicks: state.session.stats.wrongClicks + 1
          },
          action.now
        )
      },
      lastOutcome: "wrong"
    };
  }

  // A correct answer marks the country solved and advances to the next selection.
  const answered = {
    ...state.session.answered,
    [selectedMapCountryId]: {
      ...currentAnswer,
      correct: true
    }
  };
  const nextStats = updateElapsed(
    {
      ...state.session.stats,
      completedCountries: state.session.stats.completedCountries + 1,
      firstTryCorrect:
        state.session.stats.firstTryCorrect + (currentAnswer.wrongClicks === 0 ? 1 : 0)
    },
    action.now
  );
  const nextSession = {
    ...state.session,
    selectedMapCountryId: action.nextSelectedCountryId,
    answered,
    stats: nextStats
  };

  if (nextStats.completedCountries === nextStats.totalCountries) {
    const completedSession = completeSession(nextSession, action.now);

    return {
      status: "completed",
      session: completedSession,
      latestCompletedStats: completedSession.stats,
      lastOutcome: "correct"
    };
  }

  return {
    ...state,
    session: nextSession,
    lastOutcome: "correct"
  };
}
