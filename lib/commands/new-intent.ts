"use client";

import * as React from "react";

/** Event the command palette fires when a "New …" action targets the page you're already on. */
export const NEW_INTENT_EVENT = "nexa:new-intent";

/**
 * Opens a module's create form when it was reached via a `?new=1` deep link —
 * the convention the Cmd+K command palette uses for "New …" actions.
 *
 * Two triggers, so it works no matter where you start:
 *  - on mount, if the URL carries `?new=1` (you navigated in from elsewhere);
 *  - on the NEW_INTENT_EVENT, which the palette fires when the action targets
 *    the route you're already on (where router.push won't remount the page).
 */
export function useNewIntent(onNew: () => void, param = "new") {
  const cb = React.useRef(onNew);
  cb.current = onNew;
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (new URLSearchParams(window.location.search).get(param) === "1") cb.current();
    } catch {
      /* ignore */
    }
    const onIntent = () => cb.current();
    window.addEventListener(NEW_INTENT_EVENT, onIntent);
    return () => window.removeEventListener(NEW_INTENT_EVENT, onIntent);
  }, [param]);
}
