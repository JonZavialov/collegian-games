import { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  Loader,
  Trophy,
  RefreshCw,
  XCircle,
  ArrowRight,
  ExternalLink,
  AlertTriangle,
  Info,
  X,
} from "lucide-react";
import Confetti from "react-confetti";
import useGameAnalytics from "./hooks/useGameAnalytics";
import DisclaimerFooter from "./components/DisclaimerFooter";
import EmailSignup from "./components/EmailSignup";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

// 🔴 DEBUG: Persistent logging to localStorage (survives page reloads)
const DEBUG_KEY = "timemachine_debug_log";
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString().slice(11, 23);
  const entry = data ? `[${timestamp}] ${message}: ${JSON.stringify(data)}` : `[${timestamp}] ${message}`;
  const existing = JSON.parse(localStorage.getItem(DEBUG_KEY) || "[]");
  existing.push(entry);
  // Keep last 50 entries
  if (existing.length > 50) existing.shift();
  localStorage.setItem(DEBUG_KEY, JSON.stringify(existing));
  console.log(entry);
};

// Clear old logs on fresh load (not reload)
if (!sessionStorage.getItem("debug_session_started")) {
  localStorage.removeItem(DEBUG_KEY);
  sessionStorage.setItem("debug_session_started", "true");
}
debugLog("=== PAGE LOAD ===");

// ✅ PDF WORKER SETUP
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// CONFIGURATION
const START_YEAR = 1940;
const END_YEAR = 2010;
const COLLEGIAN_LCCN = "sn85054904";
const MAX_PAGE_PROBE = 10;
const DAILY_LIMIT = 1;
const DAILY_STORAGE_KEY = "time-machine_daily_progress";

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const formatDate = (dateKey) =>
  new Date(`${dateKey}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

const getTimeUntilReset = () => {
  const now = new Date();
  const nextReset = new Date(now);
  nextReset.setHours(24, 0, 0, 0);
  const diffMs = Math.max(nextReset - now, 0);
  const totalMinutes = Math.ceil(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return { hours, minutes };
};

const formatCountdown = ({ hours, minutes }) =>
  `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

const createSeededRandom = (seed) => {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
};

const getDailyDate = (dateKey, roundNumber = 1) => {
  const seed = Number(dateKey.replace(/-/g, "")) + roundNumber * 31;
  const random = createSeededRandom(seed);
  const start = new Date(`${START_YEAR}-09-05T00:00:00Z`);
  const end = new Date(`${END_YEAR}-12-10T00:00:00Z`);
  let date;
  let attempts = 0;
  do {
    date = new Date(
      start.getTime() + random() * (end.getTime() - start.getTime()),
    );
    attempts += 1;
  } while (
    (date.getUTCDay() === 0 || date.getUTCDay() === 6) &&
    attempts < 25
  );

  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return { full: `${yyyy}-${mm}-${dd}`, year: parseInt(yyyy, 10) };
};

export default function TimeMachine() {
  const [targetDate, setTargetDate] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loading, setLoading] = useState(true);
  const [redactionBoxes, setRedactionBoxes] = useState([]);
  const [gameState, setGameState] = useState("playing");
  const [score, setScore] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [archiveError, setArchiveError] = useState(null);
  const [pdfSource, setPdfSource] = useState(null);
  const [totalPages, setTotalPages] = useState(null);
  const [isPageCountLoading, setIsPageCountLoading] = useState(false);

  // UX State
  const [guessYear, setGuessYear] = useState(1975);
  const [shake, setShake] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 768
  );
  const [pdfViewportWidth, setPdfViewportWidth] = useState(null);
  const [showTutorial, setShowTutorial] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [closestGuessDiff, setClosestGuessDiff] = useState(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [dailyProgress, setDailyProgress] = useState(() => {
    if (typeof window === "undefined") {
      return { dateKey: getTodayKey(), roundsCompleted: 0 };
    }
    const stored = localStorage.getItem(DAILY_STORAGE_KEY);
    if (!stored) {
      return { dateKey: getTodayKey(), roundsCompleted: 0 };
    }
    try {
      const parsed = JSON.parse(stored);
      const roundsCompleted = Number.isInteger(parsed?.roundsCompleted)
        ? parsed.roundsCompleted
        : Number.isInteger(parsed?.roundsPlayed)
          ? parsed.roundsPlayed
          : 0;
      if (typeof parsed?.dateKey === "string") {
        return { dateKey: parsed.dateKey, roundsCompleted };
      }
    } catch (error) {
      console.warn("Failed to read daily progress:", error);
    }
    return { dateKey: getTodayKey(), roundsCompleted: 0 };
  });
  const [currentRoundNumber, setCurrentRoundNumber] = useState(1);
  const roundCompletedRef = useRef(false);
  const isProcessingGuessRef = useRef(false);
  const pageNumberRef = useRef(1); // Track current page for async operations
  const [timeUntilReset, setTimeUntilReset] = useState(getTimeUntilReset);

  const pdfWrapperRef = useRef(null);
  const pdfObjectUrlRef = useRef(null);
  const prefetchedPdfUrlsRef = useRef(new Map());
  const prefetchControllersRef = useRef(new Map());
  const analytics = useGameAnalytics("time-machine", currentRoundNumber);
  const tutorialStorageKey = "time-machine_tutorial_dismissed";
  const maxPageLimit = totalPages
    ? Math.min(totalPages, MAX_PAGE_PROBE)
    : MAX_PAGE_PROBE;
  const todayKey = getTodayKey();
  const effectiveProgress =
    dailyProgress.dateKey === todayKey
      ? dailyProgress
      : { dateKey: todayKey, roundsCompleted: 0 };
  const roundsLeft = Math.max(
    DAILY_LIMIT - effectiveProgress.roundsCompleted,
    0,
  );
  const formattedDate = formatDate(todayKey);
  // Limit devicePixelRatio more aggressively on mobile to reduce memory usage
  const devicePixelRatio =
    typeof window !== "undefined"
      ? Math.min(window.devicePixelRatio || 1, isMobile ? 1 : 2)
      : 1;

  useEffect(() => {
    startNewGame();
    const updateWidth = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener("resize", updateWidth);

    // Catch unhandled errors/rejections that might cause mobile Safari to reload
    const handleError = (event) => {
      console.error("Caught unhandled error:", event.error || event.reason);
      event.preventDefault?.();
    };
    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleError);

    return () => {
      window.removeEventListener("resize", updateWidth);
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleError);
      // Clean up object URLs on unmount
      if (pdfObjectUrlRef.current) {
        URL.revokeObjectURL(pdfObjectUrlRef.current);
      }
      prefetchedPdfUrlsRef.current.forEach((url) => {
        URL.revokeObjectURL(url);
      });
    };
  }, []);

  useEffect(() => {
    if (dailyProgress.dateKey !== todayKey) {
      const refreshed = { dateKey: todayKey, roundsCompleted: 0 };
      setDailyProgress(refreshed);
      localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(refreshed));
    }
  }, [dailyProgress.dateKey, todayKey]);

  useEffect(() => {
    const interval = setInterval(() => {
      setTimeUntilReset(getTimeUntilReset());
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Keep pageNumberRef in sync for async operations
  useEffect(() => {
    pageNumberRef.current = pageNumber;
  }, [pageNumber]);

  useEffect(() => {
    const dismissed = localStorage.getItem(tutorialStorageKey) === "true";
    if (!dismissed) {
      setShowTutorial(true);
    }
  }, [tutorialStorageKey]);

  const openTutorial = () => {
    setDontShowAgain(false);
    setShowTutorial(true);
  };

  const closeTutorial = () => {
    if (dontShowAgain) {
      localStorage.setItem(tutorialStorageKey, "true");
    }
    setShowTutorial(false);
  };

  const startReplay = useCallback(() => {
    setIsReplaying(true);
    setScore(0);
    setCurrentRoundNumber(1);
    roundCompletedRef.current = false;
    isProcessingGuessRef.current = false;
    analytics.logAction("replay_started", {}, 1);
    // Trigger the game to start again
    setLoading(true);
    setGameState("playing");
    setPageNumber(1);
    setRedactionBoxes([]);
    setRetryCount(0);
    setArchiveError(null);
    setFeedbackMsg(null);
    setTargetDate(getDailyDate(getTodayKey(), 1));
    setGuessYear(1975);
    setZoomLevel(1);
    setPdfSource(null);
    setTotalPages(null);
    setClosestGuessDiff(null);
  }, [analytics]);

  useEffect(() => {
    if (!pdfWrapperRef.current) {
      return;
    }

    const updatePdfWidth = () => {
      const containerWidth = pdfWrapperRef.current?.clientWidth ?? 0;
      const nextWidth = Math.max(containerWidth - 32, 320);
      setPdfViewportWidth(nextWidth);
    };

    updatePdfWidth();
    const observer = new ResizeObserver(updatePdfWidth);
    observer.observe(pdfWrapperRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  const startNewGame = useCallback(() => {
    const todayKey = getTodayKey();
    const baseProgress =
      dailyProgress.dateKey === todayKey
        ? dailyProgress
        : { dateKey: todayKey, roundsCompleted: 0 };
    if (baseProgress.roundsCompleted >= DAILY_LIMIT) {
      setGameState("daily-complete");
      setLoading(false);
      setTargetDate(null);
      setPdfSource(null);
      setTotalPages(null);
      return;
    }
    const nextRoundNumber = baseProgress.roundsCompleted + 1;
    setCurrentRoundNumber(nextRoundNumber);
    roundCompletedRef.current = false;
    isProcessingGuessRef.current = false;
    setLoading(true);
    setGameState("playing");
    setPageNumber(1);
    setRedactionBoxes([]);
    setRetryCount(0);
    setArchiveError(null);
    setFeedbackMsg(null);
    setTargetDate(getDailyDate(todayKey, nextRoundNumber));
    setGuessYear(1975);
    setZoomLevel(1);
    setPdfSource(null);
    setTotalPages(null);
    setClosestGuessDiff(null);

    prefetchedPdfUrlsRef.current.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    prefetchedPdfUrlsRef.current.clear();
    prefetchControllersRef.current.forEach((controller) => {
      controller.abort();
    });
    prefetchControllersRef.current.clear();

    // 📊 TRACK: New Game Started
    analytics.logStart({}, nextRoundNumber);
  }, [analytics, dailyProgress]);

  const markRoundComplete = useCallback(() => {
    if (roundCompletedRef.current) {
      return;
    }
    roundCompletedRef.current = true;

    // Don't update localStorage progress during replay
    if (isReplaying) {
      return;
    }

    const todayKey = getTodayKey();
    const baseProgress =
      dailyProgress.dateKey === todayKey
        ? dailyProgress
        : { dateKey: todayKey, roundsCompleted: 0 };
    const updatedProgress = {
      dateKey: todayKey,
      roundsCompleted: Math.max(
        baseProgress.roundsCompleted,
        currentRoundNumber,
      ),
    };
    setDailyProgress(updatedProgress);
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(updatedProgress));
  }, [currentRoundNumber, dailyProgress, isReplaying]);

  const handleLoadError = useCallback(() => {
    if (pageNumber === 1) {
      console.log(`No paper found for ${targetDate?.full}. Retrying...`);
      setTargetDate(
        getDailyDate(todayKey, currentRoundNumber + retryCount + 1),
      );
      setRetryCount((prev) => prev + 1);
    } else {
      setLoading(false);
      setGameState("lost");
      setTotalPages((prevTotal) => prevTotal ?? pageNumber - 1);

      // 📊 TRACK: Game Lost (Ran out of pages)
      analytics.logLoss(
        {
          target_year: targetDate?.year,
          pages_viewed: pageNumber,
          score: score,
        },
        pageNumber,
      );
    }
  }, [
    analytics,
    currentRoundNumber,
    pageNumber,
    retryCount,
    score,
    targetDate?.full,
    targetDate?.year,
    todayKey,
  ]);

  const handleSubmitGuess = () => {
    // Prevent spam clicking - ignore if already processing a guess
    if (!targetDate || isProcessingGuessRef.current || loading) return;

    const diff = Math.abs(targetDate.year - guessYear);
    const isWin = diff <= 2;

    // 📊 TRACK: Guess Submitted
    analytics.logAction(
      "guess_submitted",
      {
        guessed_year: guessYear,
        target_year: targetDate.year,
        difference: diff,
        result: isWin ? "win" : "miss",
        page_number: pageNumber,
      },
      pageNumber,
    );

    // WIN CONDITION: +/- 2 Years
    if (isWin) {
      setGameState("won");
      setScore(score + 1);
      setFeedbackMsg(null);

      // 📊 TRACK: Win Streak
      analytics.logWin(
        {
          streak: score + 1,
          target_year: targetDate.year,
        },
        pageNumber,
      );
    } else {
      setClosestGuessDiff((prev) =>
        prev === null ? diff : Math.min(prev, diff),
      );
      if (pageNumber >= maxPageLimit) {
        setGameState("lost");
        setLoading(false);
        setTotalPages((prevTotal) => prevTotal ?? maxPageLimit);
        setFeedbackMsg(null);

        // 📊 TRACK: Game Lost (Ran out of pages)
        analytics.logLoss(
          {
            target_year: targetDate.year,
            pages_viewed: pageNumber,
            score: score,
          },
          pageNumber,
        );
        return;
      }

      // WRONG GUESS UX - lock immediately to prevent spam
      debugLog("Wrong guess - starting page transition", { from: pageNumber, to: pageNumber + 1 });
      isProcessingGuessRef.current = true;
      setShake(true);
      setFeedbackMsg(
        `Nope! Not ${guessYear}. Loading Page ${pageNumber + 1}...`,
      );

      setTimeout(() => setShake(false), 500);

      // Use longer delay on mobile to allow memory cleanup between page loads
      const transitionDelay = isMobile ? 1200 : 700;
      setTimeout(() => {
        debugLog("setTimeout fired - incrementing page", { newPage: pageNumber + 1, delay: transitionDelay });
        setPageNumber((prev) => prev + 1);
        setLoading(true);
        setFeedbackMsg(null);
        // Reset the processing lock after state updates are queued
        // The loading state will keep the button disabled until PDF loads
        isProcessingGuessRef.current = false;
      }, transitionDelay);
    }
  };

  const getPdfUrlForPage = useCallback(
    (page) =>
      targetDate
        ? `/archive/lccn/${COLLEGIAN_LCCN}/${targetDate.full}/ed-1/seq-${page}.pdf`
        : null,
    [targetDate],
  );

  useEffect(() => {
    // Skip page count probing on mobile to reduce network requests and memory usage
    if (isMobile) {
      return;
    }

    if (!targetDate || gameState !== "playing") {
      return;
    }

    const controller = new AbortController();
    const findTotalPages = async () => {
      setIsPageCountLoading(true);
      setTotalPages(null);

      const pageExists = async (page) => {
        const url = getPdfUrlForPage(page);
        if (!url) {
          return false;
        }

        const response = await fetch(url, {
          method: "HEAD",
          signal: controller.signal,
        });

        if (response.status === 404) {
          return false;
        }

        if (response.status === 403 || response.status === 429) {
          throw new Error("Archive busy");
        }

        if (!response.ok) {
          throw new Error(`Failed to probe page ${page}: ${response.status}`);
        }

        return true;
      };

      try {
        let lowerBound = 0;
        let upperBound = 1;

        while (upperBound <= MAX_PAGE_PROBE) {
          const exists = await pageExists(upperBound);
          if (!exists) {
            break;
          }
          lowerBound = upperBound;
          upperBound *= 2;
        }

        const searchUpper = Math.min(upperBound - 1, MAX_PAGE_PROBE);
        let low = lowerBound + 1;
        let high = searchUpper;
        let lastExisting = lowerBound;

        while (low <= high) {
          const mid = Math.floor((low + high) / 2);
          const exists = await pageExists(mid);
          if (exists) {
            lastExisting = mid;
            low = mid + 1;
          } else {
            high = mid - 1;
          }
        }

        if (!controller.signal.aborted) {
          setTotalPages(lastExisting || null);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Failed to preload page count:", error);
      } finally {
        if (!controller.signal.aborted) {
          setIsPageCountLoading(false);
        }
      }
    };

    findTotalPages();

    return () => {
      controller.abort();
    };
  }, [gameState, getPdfUrlForPage, isMobile, targetDate]);

  const onPageLoadSuccess = async (page) => {
    setLoading(false);

    // Capture current page number to detect if page changed during async operations
    const currentPage = pageNumberRef.current;

    // Wrap in try-catch to prevent unhandled promise rejections
    // which can cause mobile Safari to reload the page
    try {
      const boxes = [];
      const textContent = await page.getTextContent();

      // If page changed while we were fetching text content, abort
      // This prevents "Worker task was terminated" errors from crashing the app
      if (currentPage !== pageNumberRef.current) {
        debugLog("Page changed during getTextContent, aborting", { was: currentPage, now: pageNumberRef.current });
        return;
      }

      const targetYearStr = targetDate?.year?.toString();

      // Guard against missing data
      if (!targetYearStr || !textContent?.items) {
        setRedactionBoxes([]);
        return;
      }

      const viewport = page.getViewport({ scale: 1 });
      const baseScale = pdfViewportWidth ? pdfViewportWidth / viewport.width : 1;
      const scaleFactor = baseScale * zoomLevel * (isMobile ? 0.6 : 1);

      textContent.items.forEach((item) => {
        if (item.str?.includes(targetYearStr)) {
          const pdfX = item.transform?.[4] ?? 0;
          const pdfY = item.transform?.[5] ?? 0;
          const itemHeight = item.height || 10;
          const itemWidth = item.width || 0;
          const x = pdfX * scaleFactor;
          const y = (viewport.height - pdfY - itemHeight) * scaleFactor;

          boxes.push({
            x: x - 4,
            y: y - 4,
            w: itemWidth * scaleFactor + 12,
            h: itemHeight * scaleFactor + 8,
          });
        }
      });
      setRedactionBoxes(boxes);
    } catch (error) {
      // Ignore worker termination errors - these happen when page changes during text extraction
      if (error?.message?.includes("terminated") || error?.message?.includes("destroyed")) {
        debugLog("Worker terminated (expected during page change)", { error: error.message });
        return;
      }
      console.error("Error processing PDF page:", error);
      // Don't crash - just show no redaction boxes
      setRedactionBoxes([]);
    }
  };

  const pdfUrl = getPdfUrlForPage(pageNumber);

  const originalLink = targetDate
    ? `https://panewsarchive.psu.edu/lccn/${COLLEGIAN_LCCN}/${targetDate.full}/ed-1/seq-1/`
    : "#";
  const shouldRenderPdf = pdfSource && gameState === "playing" && !archiveError;
  const pageScale = zoomLevel * (isMobile ? 0.6 : 1);
  const documentKey = `${targetDate?.full ?? "no-date"}-${pageNumber}`;

  // Helper for tracking external link clicks
  const handleViewFullIssue = () => {
    analytics.logContentClick({
      target_year: targetDate?.year,
      url: originalLink,
    });
  };

  useEffect(() => {
    if (gameState === "playing" && pageNumber > 1) {
      analytics.logAction("page_turn", { page_number: pageNumber }, pageNumber);
    }
  }, [analytics, gameState, pageNumber]);

  useEffect(() => {
    if (gameState === "won" || gameState === "lost") {
      markRoundComplete();
    }
  }, [gameState, markRoundComplete]);

  useEffect(() => {
    debugLog("PDF fetch effect triggered", { pdfUrl, gameState, pageNumber });

    if (!pdfUrl || gameState !== "playing") {
      debugLog("PDF fetch skipped - conditions not met");
      return;
    }

    // Track which page this effect is for
    const effectPageNumber = pageNumber;

    const controller = new AbortController();
    const fetchPdf = async () => {
      debugLog("fetchPdf started", { pageNumber: effectPageNumber });

      // Check if page already changed before we even start
      if (effectPageNumber !== pageNumberRef.current) {
        debugLog("Page already changed, skipping fetch", { was: effectPageNumber, now: pageNumberRef.current });
        return;
      }

      if (prefetchedPdfUrlsRef.current.has(effectPageNumber)) {
        debugLog("Using prefetched PDF");
        const cachedUrl = prefetchedPdfUrlsRef.current.get(effectPageNumber);
        prefetchedPdfUrlsRef.current.delete(effectPageNumber);
        if (pdfObjectUrlRef.current) {
          URL.revokeObjectURL(pdfObjectUrlRef.current);
        }
        pdfObjectUrlRef.current = cachedUrl;
        setPdfSource(cachedUrl);
        setLoading(false);
        return;
      }

      setLoading(true);
      setArchiveError(null);
      setPdfSource(null);

      if (pdfObjectUrlRef.current) {
        debugLog("Revoking old object URL");
        URL.revokeObjectURL(pdfObjectUrlRef.current);
        pdfObjectUrlRef.current = null;
      }

      try {
        debugLog("Fetching PDF from network", { pdfUrl });
        const response = await fetch(pdfUrl, { signal: controller.signal });

        // Check again after fetch completes - if page changed, don't process
        if (effectPageNumber !== pageNumberRef.current) {
          debugLog("Page changed during fetch, discarding response", { was: effectPageNumber, now: pageNumberRef.current });
          return;
        }

        if (response.status === 403 || response.status === 429) {
          setArchiveError(
            "The Archives are currently experiencing high traffic. Please try again later.",
          );
          setLoading(false);
          return;
        }

        if (response.status === 404) {
          handleLoadError();
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch PDF: ${response.status}`);
        }

        const blob = await response.blob();

        // Final check before creating object URL - this is the expensive part
        if (effectPageNumber !== pageNumberRef.current) {
          debugLog("Page changed during blob read, discarding", { was: effectPageNumber, now: pageNumberRef.current });
          return;
        }

        debugLog("Creating object URL for page", { pageNumber: effectPageNumber });
        const objectUrl = URL.createObjectURL(blob);
        pdfObjectUrlRef.current = objectUrl;
        setPdfSource(objectUrl);
        setLoading(false);
        debugLog("PDF loaded successfully", { pageNumber: effectPageNumber });
      } catch (error) {
        if (controller.signal.aborted) {
          debugLog("Fetch aborted (expected)", { pageNumber: effectPageNumber });
          return;
        }
        console.error("Failed to fetch PDF:", error);
        setArchiveError(
          "We couldn't load this issue right now. Please try again.",
        );
        setLoading(false);
      }
    };

    fetchPdf();

    return () => {
      controller.abort();
      // Note: We intentionally do NOT revoke the object URL here.
      // Revoking during cleanup causes mobile Safari to crash because
      // react-pdf may still be rendering the old URL when the effect
      // re-runs. The URL is revoked inside fetchPdf when a new one
      // is created to replace it.
    };
  }, [gameState, handleLoadError, pdfUrl]);

  useEffect(() => {
    // Skip prefetching on mobile to reduce memory pressure
    if (isMobile) {
      return;
    }

    if (!targetDate || gameState !== "playing") {
      return;
    }

    const nextPage = pageNumber + 1;
    if (prefetchedPdfUrlsRef.current.has(nextPage)) {
      return;
    }
    if (prefetchControllersRef.current.has(nextPage)) {
      return;
    }

    const controller = new AbortController();
    prefetchControllersRef.current.set(nextPage, controller);

    const prefetchNextPage = async () => {
      const url = getPdfUrlForPage(nextPage);
      if (!url) {
        return;
      }

      try {
        const response = await fetch(url, {
          signal: controller.signal,
        });

        if (response.status === 404) {
          setTotalPages((prevTotal) => prevTotal ?? pageNumber);
          return;
        }

        if (!response.ok) {
          return;
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        prefetchedPdfUrlsRef.current.set(nextPage, objectUrl);

        if (prefetchedPdfUrlsRef.current.size > 2) {
          const [oldestPage, oldestUrl] = prefetchedPdfUrlsRef.current
            .entries()
            .next().value;
          prefetchedPdfUrlsRef.current.delete(oldestPage);
          URL.revokeObjectURL(oldestUrl);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error("Failed to prefetch page:", error);
      } finally {
        prefetchControllersRef.current.delete(nextPage);
      }
    };

    prefetchNextPage();

    return () => {
      controller.abort();
      prefetchControllersRef.current.delete(nextPage);
    };
  }, [gameState, getPdfUrlForPage, isMobile, pageNumber, targetDate]);

  // 🔴 DEBUG: Visible debug panel state
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);

  // Refresh debug logs when panel is shown
  useEffect(() => {
    if (showDebugPanel) {
      const logs = JSON.parse(localStorage.getItem(DEBUG_KEY) || "[]");
      setDebugLogs(logs);
    }
  }, [showDebugPanel, pageNumber, loading, gameState]);

  return (
    <div className="min-h-screen bg-slate-100 p-4 font-sans text-slate-900">
      {/* 🔴 DEBUG PANEL - tap "Time Machine" title 5 times to toggle */}
      {showDebugPanel && (
        <div className="fixed inset-0 z-[100] bg-black/90 p-4 overflow-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-white font-bold">Debug Log</h2>
            <button
              onClick={() => setShowDebugPanel(false)}
              className="text-white bg-red-600 px-3 py-1 rounded"
            >
              Close
            </button>
          </div>
          <div className="text-green-400 font-mono text-xs space-y-1">
            {debugLogs.map((log, i) => (
              <div key={i} className="border-b border-green-900 pb-1">{log}</div>
            ))}
            {debugLogs.length === 0 && <div>No logs yet</div>}
          </div>
          <button
            onClick={() => {
              localStorage.removeItem(DEBUG_KEY);
              setDebugLogs([]);
            }}
            className="mt-4 text-white bg-gray-600 px-3 py-1 rounded text-sm"
          >
            Clear Logs
          </button>
        </div>
      )}

      {showTutorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100/95 backdrop-blur p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-xs sm:max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl my-auto">
            <div className="p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900">
                    How to play Time Machine
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Scan a front page and guess the year (±2 wins).
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeTutorial}
                  className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
                  aria-label="Close tutorial"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mt-5">
                <div className="text-xs font-black uppercase tracking-widest text-slate-400">
                  Core gameplay
                </div>
                <ol className="mt-3 space-y-3 text-sm text-slate-700">
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-700">
                      1
                    </span>
                    <span>Scan the page for clues.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-700">
                      2
                    </span>
                    <span>Set your year on the slider and lock it in.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-black text-slate-700">
                      3
                    </span>
                    <span>Turn pages for more clues if you need them.</span>
                  </li>
                </ol>

                <p className="mt-4 text-xs text-slate-500">
                  You have a limited number of pages per round.
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-4">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                  <input
                    type="checkbox"
                    checked={dontShowAgain}
                    onChange={(event) => setDontShowAgain(event.target.checked)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  Don&apos;t show again
                </label>
                <button
                  type="button"
                  onClick={closeTutorial}
                  className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700"
                >
                  Start
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes shake {
          0% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
          100% { transform: translateX(0); }
        }
        .shake-element {
          animation: shake 0.4s ease-in-out;
          border-color: #ef4444 !important; /* Red border */
        }
      `}</style>

      {/* HEADER */}
      <div className="max-w-6xl mx-auto mb-6 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1
            className="text-3xl font-black uppercase tracking-tighter text-slate-900 cursor-pointer select-none"
            onClick={() => {
              // 🔴 DEBUG: Triple-tap to toggle debug panel
              const now = Date.now();
              const lastTap = window._debugTapTime || 0;
              const tapCount = (now - lastTap < 500) ? (window._debugTapCount || 0) + 1 : 1;
              window._debugTapTime = now;
              window._debugTapCount = tapCount;
              if (tapCount >= 3) {
                setShowDebugPanel(prev => !prev);
                window._debugTapCount = 0;
              }
            }}
          >
            Time Machine
          </h1>
          <p className="text-slate-500 text-sm">
            Drag the slider to guess the year. Close counts (±2 years).
          </p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
            <span className="rounded-full bg-slate-200/70 px-3 py-1">
              Today: {formattedDate}
            </span>
            <span className="rounded-full bg-slate-200/70 px-3 py-1">
              Rounds left: {roundsLeft} / {DAILY_LIMIT}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <button
            type="button"
            onClick={openTutorial}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
          >
            <Info size={14} /> <span className="hidden sm:inline">How to play</span>
          </button>
          <button
            type="button"
            onClick={() => analytics.logFeedback()}
            className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm transition hover:border-blue-200 hover:text-blue-700"
          >
            Feedback
          </button>
          <div className="bg-white px-5 py-2 rounded-full shadow-sm font-bold text-blue-700 border border-blue-100 flex items-center gap-2">
            <Trophy size={18} /> Streak: {score}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* CONTROLS (Left Side) */}
        <div
          className={`md:col-span-4 bg-white rounded-xl shadow-sm border border-slate-200 p-4 md:p-6 md:sticky md:top-6 transition-colors ${
            shake ? "border-red-400 bg-red-50" : ""
          }`}
        >
          {isReplaying && gameState === "playing" && (
            <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-center">
              <p className="text-amber-800 font-semibold text-sm">
                Replay Mode — Same issue from earlier today
              </p>
              <p className="text-amber-600 text-xs mt-1">
                New issue available tomorrow at midnight
              </p>
            </div>
          )}

          <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
              <div
                className={`w-3 h-3 rounded-full ${
                  loading ? "bg-amber-400 animate-pulse" : "bg-green-500"
                }`}
              ></div>
              <span className="font-bold text-slate-700">
                {loading
                  ? "Scanning Archives..."
                  : `Viewing Page ${pageNumber}${
                      totalPages ? ` of ${totalPages}` : ""
                    }`}
              </span>
            </div>

            {feedbackMsg && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 text-sm font-bold rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                <AlertTriangle size={16} /> {feedbackMsg}
              </div>
            )}

            {archiveError && (
              <div className="mb-4 p-3 bg-amber-100 text-amber-800 text-sm font-bold rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                <AlertTriangle size={16} /> {archiveError}
              </div>
            )}

            {retryCount > 0 && loading && pageNumber === 1 && (
              <p className="text-xs text-slate-400 animate-pulse">
                Searching for a valid issue... (Attempt {retryCount})
              </p>
            )}

            {!loading && !archiveError && (
              <p className="mt-2 text-xs font-semibold text-slate-400">
                {isPageCountLoading
                  ? "Counting total pages..."
                  : totalPages
                    ? `Total pages available: ${totalPages}`
                    : "Total pages unavailable for this issue."}
              </p>
            )}
          </div>

          {gameState === "won" ? (
            <div className="text-center py-6 bg-green-50 rounded-xl border border-green-100 animate-in zoom-in duration-300">
              <Confetti recycle={false} numberOfPieces={200} gravity={0.2} />
              <h2 className="text-3xl font-black text-green-600 mb-2">
                CORRECT!
              </h2>
              <p className="text-slate-600 mb-6">
                Published in{" "}
                <span className="font-bold text-slate-900">
                  {targetDate?.year}
                </span>
              </p>

              <div className="flex flex-col gap-3 px-4">
                <a
                  href={originalLink}
                  target="_blank"
                  rel="noreferrer"
                  onClick={handleViewFullIssue} // 📊 TRACK CLICK
                  className="flex items-center justify-center gap-2 text-blue-600 font-bold hover:underline text-sm mb-2"
                >
                  View Full Issue <ExternalLink size={14} />
                </a>
                {isReplaying ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">
                      Replay complete! Come back tomorrow for a new issue.
                    </div>
                    <button
                      onClick={() => {
                        setIsReplaying(false);
                        setGameState("daily-complete");
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      Back to summary
                    </button>
                  </div>
                ) : roundsLeft > 0 ? (
                  <button
                    onClick={startNewGame}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-black transition shadow-lg"
                  >
                    <RefreshCw size={18} /> Play Again
                  </button>
                ) : (
                  <button
                    onClick={() => setGameState("daily-complete")}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-black transition shadow-lg"
                  >
                    See Summary <ArrowRight size={18} />
                  </button>
                )}
                <EmailSignup gameName="Time Machine" />
              </div>
            </div>
          ) : gameState === "lost" ? (
            <div className="text-center py-6 bg-red-50 rounded-xl border border-red-100 animate-in zoom-in duration-300">
              <XCircle className="mx-auto text-red-500 mb-2" size={48} />
              <h2 className="text-3xl font-black text-red-600 mb-2">
                GAME OVER
              </h2>
              <p className="text-slate-600 mb-4">
                You ran out of pages!
                <br />
                It was{" "}
                <span className="font-bold text-slate-900">
                  {targetDate?.year}
                </span>
                {closestGuessDiff !== null && (
                  <>
                    <br />
                    Closest guess:{" "}
                    <span className="font-bold text-slate-900">
                      {closestGuessDiff}
                    </span>{" "}
                    {closestGuessDiff === 1 ? "year" : "years"} off
                  </>
                )}
              </p>

              <div className="flex flex-col gap-3 px-4">
                <a
                  href={originalLink}
                  target="_blank"
                  rel="noreferrer"
                  onClick={handleViewFullIssue} // 📊 TRACK CLICK
                  className="flex items-center justify-center gap-2 text-blue-600 font-bold hover:underline text-sm mb-2"
                >
                  View Full Issue <ExternalLink size={14} />
                </a>
                {isReplaying ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="rounded-lg bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600">
                      Replay complete! Come back tomorrow for a new issue.
                    </div>
                    <button
                      onClick={() => {
                        setIsReplaying(false);
                        setGameState("daily-complete");
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      Back to summary
                    </button>
                  </div>
                ) : roundsLeft > 0 ? (
                  <button
                    onClick={() => {
                      setScore(0);
                      startNewGame();
                    }}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition shadow-lg"
                  >
                    <RefreshCw size={18} /> Try Again
                  </button>
                ) : (
                  <button
                    onClick={() => setGameState("daily-complete")}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-black transition shadow-lg"
                  >
                    See Summary <ArrowRight size={18} />
                  </button>
                )}
                <EmailSignup gameName="Time Machine" />
              </div>
            </div>
          ) : gameState === "daily-complete" ? (
            <div className="text-center py-6 bg-blue-50 rounded-xl border border-blue-100 animate-in zoom-in duration-300">
              <h2 className="text-2xl font-black text-blue-700 mb-2">
                That&apos;s all for today
              </h2>
              <p className="text-slate-600 mb-4">
                You&apos;ve played today&apos;s Time Machine round.
              </p>
              <div className="rounded-lg bg-white px-4 py-3 text-sm font-semibold text-slate-600 shadow-sm">
                New round in{" "}
                <span className="font-black text-slate-800">
                  {formatCountdown(timeUntilReset)}
                </span>
                .
              </div>
              <div className="mt-4 pt-4 border-t border-blue-100 space-y-3">
                <button
                  onClick={startReplay}
                  className="w-full px-6 py-3 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition shadow-lg"
                >
                  Replay Today&apos;s Issue
                </button>
                <p className="text-xs text-slate-500">
                  Same newspaper, same fun. New issue tomorrow!
                </p>
              </div>
              <EmailSignup gameName="Time Machine" />
            </div>
          ) : (
            <div className={`space-y-6 ${shake ? "shake-element" : ""}`}>
              <div className="text-center">
                <div className="text-6xl font-black text-blue-600 mb-2 tabular-nums tracking-tighter">
                  {guessYear}
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                  Range: {guessYear - 2} – {guessYear + 2}
                </div>

                <input
                  type="range"
                  min={START_YEAR}
                  max={END_YEAR}
                  value={guessYear}
                  onChange={(e) => setGuessYear(parseInt(e.target.value))}
                  disabled={loading}
                  className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600 hover:accent-blue-500 transition-all"
                />
                <div className="flex justify-between text-xs text-slate-400 mt-2 font-bold">
                  <span>{START_YEAR}</span>
                  <span>{END_YEAR}</span>
                </div>
              </div>

              <button
                onClick={handleSubmitGuess}
                disabled={loading || feedbackMsg}
                className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold text-lg hover:bg-blue-600 transition-all shadow-lg hover:shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
              >
                {loading || feedbackMsg ? "Analyzing..." : "Lock In Guess"}{" "}
                <ArrowRight
                  size={20}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </button>
            </div>
          )}

          <div className="mt-8 pt-4 border-t border-slate-100 text-xs text-slate-400">
            Source: Pennsylvania Newspaper Archive
          </div>
        </div>

        {/* PDF VIEWER */}
        <div
          className="md:col-span-8 min-h-[300px] md:min-h-[600px] bg-slate-300 rounded-xl border border-slate-300 relative overflow-hidden"
          ref={pdfWrapperRef}
        >
          <div className="absolute left-1/2 top-4 z-40 -translate-x-1/2 rounded-full bg-white/95 px-4 py-2 text-sm font-semibold text-slate-700 shadow-md">
            <div className="flex items-center gap-3">
              <span className="font-bold text-slate-800">Zoom</span>
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => Math.max(1, prev - 0.25))}
                className="h-8 w-8 rounded-full border border-slate-200 text-base font-bold text-slate-700 hover:bg-slate-100"
              >
                -
              </button>
              <span className="min-w-[3.5rem] text-center tabular-nums">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoomLevel((prev) => Math.min(6, prev + 0.25))}
                className="h-8 w-8 rounded-full border border-slate-200 text-base font-bold text-slate-700 hover:bg-slate-100"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(1)}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Reset
              </button>
              <span className="hidden text-xs text-slate-500 md:inline">
                Scroll to pan while zoomed
              </span>
            </div>
          </div>
          {loading && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-slate-100/80 backdrop-blur-sm transition-all">
              <Loader className="animate-spin text-slate-400 mb-3" size={40} />
              <span className="text-slate-500 font-medium">
                {pageNumber > 1
                  ? "Loading next page..."
                  : "Fetching historical document..."}
              </span>
            </div>
          )}

          {shouldRenderPdf && (
            <div
              className={`relative bg-white min-h-[400px] md:min-h-[800px] shadow-2xl ${
                zoomLevel === 1
                  ? "overflow-y-auto overflow-x-hidden"
                  : "overflow-auto"
              }`}
            >
              <div className="relative mx-auto w-fit">
                <Document
                  key={documentKey}
                  file={pdfSource}
                  onLoadError={(error) => {
                    debugLog("Document load error", { error: error?.message || String(error) });
                    // Ignore worker termination errors
                    if (error?.message?.includes("terminated") || error?.message?.includes("destroyed")) {
                      return;
                    }
                    handleLoadError();
                  }}
                  className="flex justify-center"
                  loading={null}
                >
                  <Page
                    pageNumber={1}
                    scale={pageScale}
                    width={pdfViewportWidth ?? undefined}
                    onLoadSuccess={onPageLoadSuccess}
                    onLoadError={(error) => {
                      debugLog("Page load error", { error: error?.message || String(error) });
                      // Ignore worker termination errors
                      if (error?.message?.includes("terminated") || error?.message?.includes("destroyed")) {
                        return;
                      }
                      handleLoadError();
                    }}
                    devicePixelRatio={devicePixelRatio}
                    renderAnnotationLayer={false}
                    renderTextLayer={false}
                    renderMode={isMobile ? "canvas" : "svg"}
                    className="shadow-xl"
                  />
                </Document>

                {redactionBoxes.map((box, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: box.x,
                      top: box.y,
                      width: box.w,
                      height: box.h,
                      backgroundColor: "#1a1a1a",
                      zIndex: 20,
                      pointerEvents: "none",
                      borderRadius: "2px",
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {!shouldRenderPdf && (
            <div className="flex h-full min-h-[600px] items-center justify-center bg-white/80 text-center text-sm text-slate-500">
              <div className="max-w-sm space-y-2 px-6 py-8">
                <p className="text-base font-semibold text-slate-700">
                  {archiveError
                    ? "Archives are temporarily unavailable."
                    : gameState === "lost"
                      ? "No more pages available for this issue."
                      : "PDF is hidden while you review results."}
                </p>
                <p>
                  {archiveError
                    ? "Please try again later or visit the full archives for text-based access."
                    : gameState === "lost"
                      ? "Use the Try Again button to start a new issue."
                      : "Start a new game or view the full issue to keep reading."}
                </p>
                <a
                  href={originalLink}
                  target="_blank"
                  rel="noreferrer"
                  onClick={handleViewFullIssue}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-blue-600 hover:bg-slate-50"
                >
                  View Full Issue <ExternalLink size={14} />
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
      <DisclaimerFooter />
    </div>
  );
}
