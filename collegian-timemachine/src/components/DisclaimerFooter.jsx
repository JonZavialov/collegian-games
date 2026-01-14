import React from "react";

export default function DisclaimerFooter() {
  return (
    <footer className="mx-auto mt-10 max-w-6xl border-t border-slate-200 px-4 py-4 text-center text-slate-500">
      <small className="text-xs">
        Accessibility Note: This game relies on visual analysis of historical
        archives. For accessible text-based news, please visit the full
        archives at{" "}
        <a
          className="font-semibold text-blue-700 hover:underline"
          href="https://panewsarchive.psu.edu/"
          target="_blank"
          rel="noreferrer"
        >
          https://panewsarchive.psu.edu/
        </a>
        .
      </small>
    </footer>
  );
}
