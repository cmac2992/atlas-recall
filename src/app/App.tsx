import { startTransition, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { worldAtlasData } from "../data/worldAtlasData";
import { createInitialGameState, createNewSession, gameReducer } from "../features/game/gameReducer";
import {
  EMPTY_BROWSE_HISTORY,
  getFirstUnsolvedCountryId,
  getNextNearbyCountryId,
  getPreviousOpenCountry,
  getRecentVisitedCountryIds,
  recordVisitedCountry,
  type SelectionHistoryState
} from "../features/game/navigation";
import type {
  GameSession,
  GuessOutcome,
  PersistedState
} from "../features/game/gameTypes";
import { WorldMap } from "../features/map/WorldMap";
import { HUD } from "../features/ui/HUD";
import {
  MobileSearchDock,
  type MobileSearchDockHandle
} from "../features/ui/MobileSearchDock";
import { MobileRunControls } from "../features/ui/MobileRunControls";
import { ResultsScreen } from "../features/ui/ResultsScreen";
import { StartScreen } from "../features/ui/StartScreen";
import { formatDuration } from "../lib/format";
import { loadPersistedState, savePersistedState, selectPreferredBestRun } from "../lib/storage";

const RECENT_COUNTRY_MEMORY = 10;

// We read local storage once on boot. A ref is simpler than adding another state
// layer and avoids re-parsing saved JSON on every render.
function useInitialPersistedState() {
  const initialRef = useRef<PersistedState | null>(null);

  if (initialRef.current === null) {
    initialRef.current = loadPersistedState();
  }

  return initialRef.current;
}

function buildFeedbackMessage(lastOutcome: GuessOutcome) {
  if (lastOutcome === "correct") {
    return "Correct match. Moving to another country.";
  }

  if (lastOutcome === "wrong") {
    return "Incorrect match. Moving to another country.";
  }

  if (lastOutcome === "skipped") {
    return "Moved on. That country can come back later.";
  }

  return "Click a country on the map, then identify it from the unsolved-country list.";
}

// Persisted sessions store a frozen elapsed time, not a live ticking clock.
// Before saving, we refresh that snapshot from startedAt.
function getPersistedSessionSnapshot(session: GameSession | null, now: number) {
  if (!session) {
    return null;
  }

  if (session.stats.completedAt) {
    return session;
  }

  return {
    ...session,
    stats: {
      ...session.stats,
      elapsedMs: Math.max(0, now - session.stats.startedAt)
    }
  };
}

export function App() {
  const initialPersistedState = useInitialPersistedState();
  const [bestRun, setBestRun] = useState(initialPersistedState.bestRun);
  const [savedSession, setSavedSession] = useState<GameSession | null>(
    initialPersistedState.inProgressSession
  );
  const [flashEvent, setFlashEvent] = useState<{
    countryId: string;
    variant: "correct" | "wrong";
    token: number;
  } | null>(null);
  const [desktopAutoPanEnabled, setDesktopAutoPanEnabled] = useState(true);
  const [desktopVisibleLeftPx, setDesktopVisibleLeftPx] = useState<number | null>(null);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [mobileVisibleBottomPx, setMobileVisibleBottomPx] = useState<number | null>(null);
  const [gameState, dispatch] = useReducer(gameReducer, undefined, createInitialGameState);
  const [browseHistory, setBrowseHistory] =
    useState<SelectionHistoryState>(EMPTY_BROWSE_HISTORY);
  const [persistenceVersion, setPersistenceVersion] = useState(0);
  const navigatingHistoryCountryIdRef = useRef<string | null>(null);
  const processedPersistenceVersionRef = useRef(0);
  const mobileSearchDockRef = useRef<MobileSearchDockHandle | null>(null);
  const countries = worldAtlasData.countries;
  const countryCount = countries.length;
  const activeSession = gameState.session;
  const remainingPrompts = activeSession
    ? activeSession.stats.totalCountries - activeSession.stats.completedCountries
    : 0;
  const solvedCountryIds = useMemo(
    () =>
      activeSession
        ? Object.entries(activeSession.answered)
            .filter(([, answer]) => answer.correct)
            .map(([countryId]) => countryId)
        : [],
    [activeSession]
  );
  const solvedCountryIdSet = useMemo(() => new Set(solvedCountryIds), [solvedCountryIds]);
  const unsolvedCountries = useMemo(
    () => countries.filter((country) => !solvedCountryIdSet.has(country.id)),
    [countries, solvedCountryIdSet]
  );
  const latestCompletedStats = gameState.latestCompletedStats;
  const effectiveBestRun = latestCompletedStats
    ? selectPreferredBestRun(bestRun, latestCompletedStats)
    : bestRun;
  const isNewBestRun = Boolean(
    latestCompletedStats &&
      effectiveBestRun &&
      effectiveBestRun.startedAt === latestCompletedStats.startedAt &&
      effectiveBestRun.completedAt === latestCompletedStats.completedAt
  );
  const previousOpenCountry = useMemo(
    () =>
      activeSession
        ? getPreviousOpenCountry(browseHistory, activeSession.answered)
        : null,
    [activeSession, browseHistory]
  );
  const recentCountryIds = useMemo(
    () =>
      getRecentVisitedCountryIds(
        browseHistory,
        activeSession?.selectedMapCountryId ?? null,
        RECENT_COUNTRY_MEMORY
      ),
    [activeSession?.selectedMapCountryId, browseHistory]
  );
  const canMoveForward = Boolean(
    activeSession &&
      (activeSession.selectedMapCountryId ||
        getFirstUnsolvedCountryId(countries, activeSession.answered))
  );

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 960px)");
    const applyViewportMode = () => {
      const isMobile = mediaQuery.matches;
      setIsMobileViewport(isMobile);

      if (!isMobile) {
        setMobileVisibleBottomPx(null);
      } else {
        setDesktopVisibleLeftPx(null);
      }
    };

    applyViewportMode();
    mediaQuery.addEventListener("change", applyViewportMode);

    return () => {
      mediaQuery.removeEventListener("change", applyViewportMode);
    };
  }, []);

  // Any selection that came from normal play should extend history. A selection
  // that came from "go back" should simply move the history pointer.
  useEffect(() => {
    if (gameState.status !== "playing" || !activeSession?.selectedMapCountryId) {
      return;
    }

    const selectedCountryId = activeSession.selectedMapCountryId;

    setBrowseHistory((currentHistory) =>
      recordVisitedCountry(
        currentHistory,
        selectedCountryId,
        navigatingHistoryCountryIdRef.current
      )
    );
    navigatingHistoryCountryIdRef.current = null;
  }, [activeSession?.selectedMapCountryId, gameState.status]);

  useEffect(() => {
    if (gameState.status !== "playing") {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        handleMoveForward();
        return;
      }

      if (event.key === "ArrowLeft" && previousOpenCountry) {
        event.preventDefault();
        handleMoveBackward();
        return;
      }

      if (event.key === "Escape" && gameState.session) {
        event.preventDefault();
        dispatch({ type: "clear_map_selection" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameState.session, gameState.status, previousOpenCountry]);

  const requestPersistence = () => {
    setPersistenceVersion((currentVersion) => currentVersion + 1);
  };

  // Save only after gameplay actions that actually change meaningful persisted data.
  useEffect(() => {
    if (
      persistenceVersion === 0 ||
      processedPersistenceVersionRef.current === persistenceVersion
    ) {
      return;
    }

    processedPersistenceVersionRef.current = persistenceVersion;

    const nextSavedSession = gameState.status === "completed" ? null : savedSession;
    let nextBestRun = bestRun;

    if (latestCompletedStats) {
      nextBestRun = selectPreferredBestRun(bestRun, latestCompletedStats);

      if (nextBestRun !== bestRun) {
        setBestRun(nextBestRun);
      }
    }

    if (gameState.status === "completed" && savedSession !== null) {
      setSavedSession(null);
    }

    savePersistedState({
      schemaVersion: 4,
      bestRun: nextBestRun,
      inProgressSession:
        gameState.status === "playing"
          ? getPersistedSessionSnapshot(gameState.session, Date.now())
          : nextSavedSession
    });
  }, [bestRun, gameState, latestCompletedStats, persistenceVersion, savedSession]);

  const resetRuntimeState = () => {
    navigatingHistoryCountryIdRef.current = null;
    setBrowseHistory(EMPTY_BROWSE_HISTORY);
  };

  // Choosing the next country is mostly a navigation concern, not reducer logic.
  // Keeping it here lets the reducer stay focused on scoring and session state.
  const getNextSelectedCountryId = (selectedCountryId: string | null) => {
    if (!activeSession) {
      return null;
    }

    return getNextNearbyCountryId(
      countries,
      selectedCountryId,
      activeSession.answered,
      recentCountryIds
    );
  };

  const startNewGame = () => {
    setSavedSession(null);
    resetRuntimeState();
    requestPersistence();

    startTransition(() => {
      dispatch({
        type: "start_new",
        session: createNewSession(countries.map((country) => country.id), Date.now())
      });
    });
  };

  const resumeGame = () => {
    if (!savedSession) {
      return;
    }

    resetRuntimeState();
    requestPersistence();

    startTransition(() => {
      dispatch({ type: "resume", session: savedSession, now: Date.now() });
    });
  };

  const handleMoveForward = () => {
    if (!activeSession) {
      return;
    }

    // If nothing is selected yet, Next acts like "start browsing".
    if (!activeSession.selectedMapCountryId) {
      const nextCountryId = getFirstUnsolvedCountryId(countries, activeSession.answered);

      if (nextCountryId) {
        dispatch({ type: "select_map_country", countryId: nextCountryId });
      }

      return;
    }

    // Once a country is selected, Next means "skip this for now and move on".
    requestPersistence();
    dispatch({
      type: "move_on_from_selected_country",
      nextSelectedCountryId: getNextSelectedCountryId(activeSession.selectedMapCountryId),
      now: Date.now()
    });
  };

  const handleMoveBackward = () => {
    if (!previousOpenCountry) {
      return;
    }

    // Move the history cursor first so the selection effect knows this was a
    // history navigation, not a fresh visit that needs a duplicate entry.
    navigatingHistoryCountryIdRef.current = previousOpenCountry.countryId;
    setBrowseHistory((currentHistory) => ({
      ...currentHistory,
      index: previousOpenCountry.historyIndex
    }));
    dispatch({
      type: "select_map_country",
      countryId: previousOpenCountry.countryId
    });
  };

  const handleDone = () => {
    if (gameState.status !== "playing") {
      return;
    }

    requestPersistence();
    dispatch({
      type: "finish_run",
      now: Date.now()
    });
  };

  const handleCountrySelect = (countryId: string) => {
    if (!activeSession || gameState.status !== "playing") {
      return;
    }

    if (activeSession.answered[countryId]?.correct) {
      return;
    }

    if (isMobileViewport) {
      flushSync(() => {
        dispatch({ type: "select_map_country", countryId });
      });
      mobileSearchDockRef.current?.focusInput();
      return;
    }

    dispatch({ type: "select_map_country", countryId });
  };

  const handleSubmitCountryName = (countryId: string) => {
    if (!activeSession?.selectedMapCountryId) {
      return;
    }

    // The map flash is a pure visual cue. The reducer still owns the actual
    // correctness rules and score changes.
    setFlashEvent({
      countryId: activeSession.selectedMapCountryId,
      variant: countryId === activeSession.selectedMapCountryId ? "correct" : "wrong",
      token: Date.now()
    });

    requestPersistence();

    // Mirror the flushSync + focusInput pattern from handleCountrySelect so the
    // keyboard stays deployed between guesses on mobile.
    if (isMobileViewport) {
      flushSync(() => {
        dispatch({
          type: "submit_country_name",
          countryId,
          nextSelectedCountryId: getNextSelectedCountryId(activeSession.selectedMapCountryId),
          now: Date.now()
        });
      });
      mobileSearchDockRef.current?.focusInput();
      return;
    }

    dispatch({
      type: "submit_country_name",
      countryId,
      nextSelectedCountryId: getNextSelectedCountryId(activeSession.selectedMapCountryId),
      now: Date.now()
    });
  };

  const handleClearMapSelection = () => {
    dispatch({ type: "clear_map_selection" });
  };

  const returnToStart = () => {
    resetRuntimeState();
    dispatch({ type: "return_to_start" });
  };

  if (activeSession && (gameState.status === "playing" || gameState.status === "completed")) {
    return (
      <main className="shell shell--play">
        <section className="play-stage">
          <WorldMap
            countries={countries}
            desktopAutoPanEnabled={desktopAutoPanEnabled}
            desktopVisibleLeftPx={!isMobileViewport ? desktopVisibleLeftPx : null}
            flashEvent={flashEvent}
            mobileVisibleBottomPx={isMobileViewport ? mobileVisibleBottomPx : null}
            onCountrySelect={gameState.status === "playing" ? handleCountrySelect : () => {}}
            onToggleDesktopAutoPan={() => {
              setDesktopAutoPanEnabled((currentValue) => !currentValue);
            }}
            selectedCountryId={activeSession.selectedMapCountryId}
            solvedCountryIds={solvedCountryIds}
            viewBox={worldAtlasData.viewBox}
          />
          {gameState.status === "playing" && !isMobileViewport ? (
              <HUD
                availableCountries={unsolvedCountries}
                canMoveBackward={Boolean(previousOpenCountry)}
                canMoveForward={canMoveForward}
                feedbackMessage={buildFeedbackMessage(gameState.lastOutcome)}
                onVisibleLeftChange={setDesktopVisibleLeftPx}
                onClearSelection={handleClearMapSelection}
                onDone={handleDone}
                onMoveBackward={handleMoveBackward}
                onMoveForward={handleMoveForward}
                onSubmitCountryName={handleSubmitCountryName}
              remainingPrompts={remainingPrompts}
              selectedCountryId={activeSession.selectedMapCountryId}
              stats={activeSession.stats}
            />
          ) : null}
          {gameState.status === "playing" && isMobileViewport ? (
            <>
              <MobileRunControls
                onDone={handleDone}
                remainingPrompts={remainingPrompts}
                stats={activeSession.stats}
              />
              <MobileSearchDock
                availableCountries={unsolvedCountries}
                ref={mobileSearchDockRef}
                onClearSelection={handleClearMapSelection}
                onSubmitCountryName={handleSubmitCountryName}
                onViewportBottomChange={setMobileVisibleBottomPx}
                selectedCountryId={activeSession.selectedMapCountryId}
              />
            </>
          ) : null}
          {gameState.status === "completed" && latestCompletedStats ? (
            <div className="results-modal-backdrop">
              <ResultsScreen
                bestRun={effectiveBestRun}
                isNewBestRun={isNewBestRun}
                onBackToStart={returnToStart}
                onPlayAgain={startNewGame}
                presentation="modal"
                stats={latestCompletedStats}
                totalCountries={countryCount}
              />
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <StartScreen
        bestRun={bestRun}
        canResume={Boolean(savedSession)}
        onResume={resumeGame}
        onStartNew={startNewGame}
        resumeLabel={
          savedSession
            ? `${savedSession.stats.completedCountries} of ${savedSession.stats.totalCountries} completed`
            : null
        }
        resumeMeta={
          savedSession ? `Elapsed ${formatDuration(savedSession.stats.elapsedMs)}` : null
        }
        totalCountries={countryCount}
      />
    </main>
  );
}
