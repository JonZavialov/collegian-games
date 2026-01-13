import { useCallback, useEffect, useRef } from "react";
import posthog from "posthog-js";

const useGameAnalytics = (gameId, roundIndex = 0) => {
  const startTimeRef = useRef(null);
  const roundIndexRef = useRef(roundIndex);

  useEffect(() => {
    roundIndexRef.current = roundIndex;
  }, [roundIndex]);

  useEffect(() => {
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }
  }, []);

  const getDurationSeconds = useCallback(() => {
    if (!startTimeRef.current) return 0;
    return Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000));
  }, []);

  const buildPayload = useCallback(
    (metadata = {}, roundIndexOverride) => ({
      game_id: gameId,
      duration_seconds: getDurationSeconds(),
      round_index: roundIndexOverride ?? roundIndexRef.current ?? 0,
      ...metadata,
    }),
    [gameId, getDurationSeconds]
  );

  const logEvent = useCallback(
    (eventName, metadata = {}, roundIndexOverride) => {
      posthog.capture(eventName, buildPayload(metadata, roundIndexOverride));
    },
    [buildPayload]
  );

  const logStart = useCallback(
    (metadata = {}, roundIndexOverride) => {
      startTimeRef.current = Date.now();
      logEvent("game_start", metadata, roundIndexOverride);
    },
    [logEvent]
  );

  const logWin = useCallback(
    (metadata = {}, roundIndexOverride) => {
      logEvent("game_won", metadata, roundIndexOverride);
    },
    [logEvent]
  );

  const logLoss = useCallback(
    (metadata = {}, roundIndexOverride) => {
      logEvent("game_lost", metadata, roundIndexOverride);
    },
    [logEvent]
  );

  const logAction = useCallback(
    (actionName, metadata = {}, roundIndexOverride) => {
      logEvent(
        "game_progress",
        {
          action: actionName,
          ...metadata,
        },
        roundIndexOverride
      );
    },
    [logEvent]
  );

  const logContentClick = useCallback(
    (metadata = {}, roundIndexOverride) => {
      logEvent("content_clicked", metadata, roundIndexOverride);
    },
    [logEvent]
  );

  return {
    logStart,
    logWin,
    logLoss,
    logAction,
    logContentClick,
  };
};

export default useGameAnalytics;
