import { useEffect, useState } from "react";

export type ReminderFollowup = {
  id: string;
  due: string;
  minutes: number;
};

type FollowupKind = "task" | "event";

const idPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseReminderFollowup(
  raw: string | null,
): ReminderFollowup | null {
  try {
    const value = JSON.parse(raw ?? "null");
    return value &&
      idPattern.test(value.id) &&
      typeof value.due === "string" &&
      Number.isFinite(Date.parse(value.due)) &&
      [0, 10, 15, 30, 60, 1440].includes(value.minutes)
      ? value
      : null;
  } catch {
    return null;
  }
}

export function useReminderFollowup(
  userId: string,
  kind: FollowupKind,
  verifyStorage = false,
) {
  const key = `khoonemoon:${kind}-reminder-followup:${userId}`;
  const [followup, setFollowup] = useState<ReminderFollowup | null>(null);
  const [storageOK, setStorageOK] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = parseReminderFollowup(localStorage.getItem(key));
      // Hydrate the account-scoped follow-up after SSR.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setFollowup(saved);
    } catch {
      setStorageOK(false);
    }
    setReady(true);
  }, [key]);

  function persist(item: ReminderFollowup) {
    setFollowup(item);
    try {
      const serialized = JSON.stringify(item);
      localStorage.setItem(key, serialized);
      if (verifyStorage && localStorage.getItem(key) !== serialized)
        throw new Error("Follow-up persistence could not be verified.");
    } catch {
      setStorageOK(false);
      if (verifyStorage)
        throw new Error(
          "ذخیره پیگیری روی دستگاه ممکن نیست؛ این صفحه را باز نگه دارید.",
        );
    }
  }

  function clear() {
    setFollowup(null);
    try {
      localStorage.removeItem(key);
    } catch {
      setStorageOK(false);
    }
  }

  return { followup, storageOK, ready, persist, clear };
}
