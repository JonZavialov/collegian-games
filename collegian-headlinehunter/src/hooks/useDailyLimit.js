import { useState, useEffect, useCallback, useMemo } from "react";

/**
 * Hook to manage daily game limits with date-based seeding
 * Ensures everyone gets the same rounds each day and tracks play counts
 *
 * @param {string} gameId - Unique identifier for the game (e.g., "headline-hunter")
 * @param {number} dailyLimit - Maximum plays allowed per day
 * @returns {object} Daily limit state and functions
 */
const useDailyLimit = (gameId, dailyLimit) => {
  const [playsToday, setPlaysToday] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Get today's date in YYYY-MM-DD format (using local timezone)
  const getTodayKey = useCallback(() => {
    const now = new Date();
    return now.toISOString().split("T")[0];
  }, []);

  // Get formatted date for display (e.g., "January 30, 2026")
  const getFormattedDate = useCallback(() => {
    const now = new Date();
    return now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, []);

  // Get short formatted date (e.g., "Jan 30")
  const getShortDate = useCallback(() => {
    const now = new Date();
    return now.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }, []);

  const storageKey = `${gameId}_daily_plays`;

  // Load plays from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const { date, count } = JSON.parse(stored);
        const today = getTodayKey();
        if (date === today) {
          setPlaysToday(count);
        } else {
          // New day - reset counter
          localStorage.setItem(
            storageKey,
            JSON.stringify({ date: today, count: 0 })
          );
          setPlaysToday(0);
        }
      } catch {
        // Invalid data, reset
        localStorage.setItem(
          storageKey,
          JSON.stringify({ date: getTodayKey(), count: 0 })
        );
        setPlaysToday(0);
      }
    } else {
      // First time playing
      localStorage.setItem(
        storageKey,
        JSON.stringify({ date: getTodayKey(), count: 0 })
      );
      setPlaysToday(0);
    }
    setIsLoading(false);
  }, [storageKey, getTodayKey]);

  // Check if user has reached daily limit
  const hasReachedLimit = useMemo(() => {
    return playsToday >= dailyLimit;
  }, [playsToday, dailyLimit]);

  // Get remaining plays
  const remainingPlays = useMemo(() => {
    return Math.max(0, dailyLimit - playsToday);
  }, [playsToday, dailyLimit]);

  // Record a completed play
  const recordPlay = useCallback(() => {
    const today = getTodayKey();
    const newCount = playsToday + 1;
    localStorage.setItem(
      storageKey,
      JSON.stringify({ date: today, count: newCount })
    );
    setPlaysToday(newCount);
  }, [getTodayKey, playsToday, storageKey]);

  // Seeded random function based on date + game + optional seed
  // This ensures everyone gets the same "random" content each day
  const seededRandom = useCallback(
    (seed = 0) => {
      const dateStr = getTodayKey();
      const seedStr = `${dateStr}-${gameId}-${seed}`;

      // Simple string hash
      let hash = 0;
      for (let i = 0; i < seedStr.length; i++) {
        const char = seedStr.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }

      // LCG (Linear Congruential Generator) for deterministic sequence
      const a = 1664525;
      const c = 1013904223;
      const m = Math.pow(2, 32);
      const result = ((a * Math.abs(hash) + c) % m) / m;

      return result;
    },
    [gameId, getTodayKey]
  );

  // Get a seeded random index from an array for a specific round
  const getSeededIndex = useCallback(
    (arrayLength, roundNumber = 0) => {
      if (arrayLength <= 0) return 0;
      const rand = seededRandom(roundNumber);
      return Math.floor(rand * arrayLength);
    },
    [seededRandom]
  );

  // Shuffle an array deterministically based on date + round
  const seededShuffle = useCallback(
    (array, roundNumber = 0) => {
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const rand = seededRandom(roundNumber * 1000 + i);
        const j = Math.floor(rand * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    },
    [seededRandom]
  );

  // Get time until reset (midnight local time)
  const getTimeUntilReset = useCallback(() => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const diff = tomorrow - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }, []);

  return {
    playsToday,
    dailyLimit,
    hasReachedLimit,
    remainingPlays,
    isLoading,
    recordPlay,
    seededRandom,
    getSeededIndex,
    seededShuffle,
    getTodayKey,
    getFormattedDate,
    getShortDate,
    getTimeUntilReset,
  };
};

export default useDailyLimit;
