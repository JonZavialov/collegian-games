import { useState, useEffect, useCallback } from "react";
import { Mail, Check, Loader, AlertCircle, Settings, Trash2 } from "lucide-react";

export default function EmailSignup({ gameName = "Game" }) {
  const [email, setEmail] = useState("");
  const [newsletter, setNewsletter] = useState(true);
  const [giveaways, setGiveaways] = useState(false);
  const [status, setStatus] = useState("idle"); // idle, checking, exists, submitting, success, error, updating, unsubscribing, updated, unsubscribed
  const [errorMessage, setErrorMessage] = useState("");
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);
  const [showUpdateOptions, setShowUpdateOptions] = useState(false);
  const [loadingPreferences, setLoadingPreferences] = useState(false);

  // Check if user already submitted from this browser
  useEffect(() => {
    const submitted = localStorage.getItem("collegian_email_submitted");
    if (submitted) {
      setAlreadySubscribed(true);
    }
  }, []);

  // Debounced email check
  const checkEmail = useCallback(async (emailToCheck) => {
    if (!emailToCheck || !emailToCheck.includes("@")) return;

    setStatus("checking");
    setShowUpdateOptions(false);
    try {
      const response = await fetch("/.netlify/functions/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailToCheck }),
      });
      const data = await response.json();

      if (data.exists) {
        setStatus("exists");
      } else {
        setStatus("idle");
      }
    } catch {
      setStatus("idle");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (email && email.includes("@")) {
        checkEmail(email);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [email, checkEmail]);

  // Load existing preferences when user wants to manage their subscription
  const handleManageSubscription = async () => {
    setLoadingPreferences(true);
    try {
      const response = await fetch("/.netlify/functions/get-email-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (response.ok) {
        setNewsletter(data.newsletter);
        setGiveaways(data.giveaways);
        setShowUpdateOptions(true);
      } else {
        setErrorMessage(data.message || "Failed to load preferences");
        setStatus("error");
      }
    } catch {
      setErrorMessage("Failed to load preferences. Please try again.");
      setStatus("error");
    } finally {
      setLoadingPreferences(false);
    }
  };

  const handleUpdatePreferences = async () => {
    if (!newsletter && !giveaways) {
      setErrorMessage("Please select at least one option, or choose to unsubscribe");
      setStatus("error");
      return;
    }

    setStatus("updating");
    setErrorMessage("");

    try {
      const response = await fetch("/.netlify/functions/update-email-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          newsletter,
          giveaways,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("updated");
      } else {
        setErrorMessage(data.message || "Something went wrong");
        setStatus("error");
      }
    } catch {
      setErrorMessage("Failed to update. Please try again.");
      setStatus("error");
    }
  };

  const handleUnsubscribe = async () => {
    setStatus("unsubscribing");
    setErrorMessage("");

    try {
      const response = await fetch("/.netlify/functions/update-email-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          unsubscribe: true,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("unsubscribed");
        localStorage.removeItem("collegian_email_submitted");
      } else {
        setErrorMessage(data.message || "Something went wrong");
        setStatus("error");
      }
    } catch {
      setErrorMessage("Failed to unsubscribe. Please try again.");
      setStatus("error");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      setErrorMessage("Please enter a valid email address");
      setStatus("error");
      return;
    }

    if (!newsletter && !giveaways) {
      setErrorMessage("Please select at least one option");
      setStatus("error");
      return;
    }

    setStatus("submitting");
    setErrorMessage("");

    try {
      const response = await fetch("/.netlify/functions/submit-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          newsletter,
          giveaways,
          source: gameName,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus("success");
        localStorage.setItem("collegian_email_submitted", "true");
      } else {
        setErrorMessage(data.message || "Something went wrong");
        setStatus("error");
      }
    } catch {
      setErrorMessage("Failed to connect. Please try again.");
      setStatus("error");
    }
  };

  if (alreadySubscribed) {
    return null;
  }

  if (status === "success") {
    return (
      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
        <div className="flex items-center justify-center gap-2 text-green-700">
          <Check size={20} />
          <span className="font-bold">You&apos;re signed up!</span>
        </div>
        <p className="text-center text-green-600 text-sm mt-1">
          Thanks for subscribing to The Daily Collegian.
        </p>
      </div>
    );
  }

  if (status === "updated") {
    return (
      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-xl">
        <div className="flex items-center justify-center gap-2 text-green-700">
          <Check size={20} />
          <span className="font-bold">Preferences updated!</span>
        </div>
        <p className="text-center text-green-600 text-sm mt-1">
          Your subscription preferences have been saved.
        </p>
      </div>
    );
  }

  if (status === "unsubscribed") {
    return (
      <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="flex items-center justify-center gap-2 text-slate-700">
          <Check size={20} />
          <span className="font-bold">Unsubscribed</span>
        </div>
        <p className="text-center text-slate-600 text-sm mt-1">
          You&apos;ve been removed from our mailing list.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 p-4 sm:p-5 bg-gradient-to-br from-blue-50 to-slate-50 border border-slate-200 rounded-xl">
      <div className="flex items-center justify-center gap-2 mb-3">
        <Mail size={20} className="text-blue-600" />
        <h3 className="font-black text-slate-800 text-lg">Stay Connected</h3>
      </div>
      <p className="text-center text-slate-600 text-sm mb-4">
        Get the latest from The Daily Collegian delivered to your inbox.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            className={`w-full px-4 py-3 rounded-lg border-2 font-medium transition-all focus:outline-none ${
              status === "exists" && !showUpdateOptions
                ? "border-yellow-400 bg-yellow-50"
                : status === "error"
                  ? "border-red-400 bg-red-50"
                  : showUpdateOptions
                    ? "border-blue-400 bg-blue-50"
                    : "border-slate-200 focus:border-blue-500 bg-white"
            }`}
            disabled={showUpdateOptions}
          />
          {status === "checking" && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader size={18} className="animate-spin text-slate-400" />
            </div>
          )}
          {status === "exists" && !showUpdateOptions && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <AlertCircle size={18} className="text-yellow-500" />
            </div>
          )}
          {showUpdateOptions && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Settings size={18} className="text-blue-500" />
            </div>
          )}
        </div>

        {status === "exists" && !showUpdateOptions && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm font-medium flex items-center gap-1 mb-2">
              <AlertCircle size={14} />
              This email is already registered.
            </p>
            <button
              type="button"
              onClick={handleManageSubscription}
              disabled={loadingPreferences}
              className="w-full py-2 px-3 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loadingPreferences ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Settings size={16} />
                  Manage Subscription
                </>
              )}
            </button>
          </div>
        )}

        {status === "error" && errorMessage && (
          <p className="text-red-600 text-sm font-medium flex items-center gap-1">
            <AlertCircle size={14} />
            {errorMessage}
          </p>
        )}

        <div className="space-y-2">
          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={newsletter}
              onChange={(e) => setNewsletter(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <div>
              <span className="font-bold text-slate-700 group-hover:text-blue-700 transition-colors">
                Newsletter
              </span>
              <p className="text-xs text-slate-500">
                Daily news and updates from Penn State
              </p>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={giveaways}
              onChange={(e) => setGiveaways(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <div>
              <span className="font-bold text-slate-700 group-hover:text-blue-700 transition-colors">
                Sponsored Giveaways
              </span>
              <p className="text-xs text-slate-500">
                Exclusive offers and prize opportunities
              </p>
            </div>
          </label>
        </div>

        {showUpdateOptions ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleUpdatePreferences}
              disabled={status === "updating"}
              className={`w-full py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                status === "updating"
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl"
              }`}
            >
              {status === "updating" ? (
                <>
                  <Loader size={18} className="animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Save Changes
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleUnsubscribe}
              disabled={status === "unsubscribing"}
              className={`w-full py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
                status === "unsubscribing"
                  ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                  : "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
              }`}
            >
              {status === "unsubscribing" ? (
                <>
                  <Loader size={18} className="animate-spin" />
                  Unsubscribing...
                </>
              ) : (
                <>
                  <Trash2 size={18} />
                  Unsubscribe Completely
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowUpdateOptions(false);
                setNewsletter(true);
                setGiveaways(false);
                setStatus("exists");
              }}
              className="w-full py-2 text-slate-500 hover:text-slate-700 font-medium text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="submit"
            disabled={status === "submitting" || status === "exists"}
            className={`w-full py-3 rounded-lg font-bold transition-all flex items-center justify-center gap-2 ${
              status === "submitting" || status === "exists"
                ? "bg-slate-300 text-slate-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl"
            }`}
          >
            {status === "submitting" ? (
              <>
                <Loader size={18} className="animate-spin" />
                Signing up...
              </>
            ) : (
              <>
                <Mail size={18} />
                Sign Up
              </>
            )}
          </button>
        )}
      </form>

      <p className="text-center text-xs text-slate-400 mt-3">
        We respect your privacy. Unsubscribe anytime.
      </p>
    </div>
  );
}
