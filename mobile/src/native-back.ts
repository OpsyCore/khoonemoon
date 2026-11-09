import { useEffect, useRef } from "react";
import type { MobilePage } from "./navigation";

/** Returns false when the activity should perform its normal back behavior. */
export function handleNativeBack(options: {
  page: MobilePage;
  history: MobilePage[];
  navigate: (page: MobilePage) => void;
  dirty: boolean;
}): boolean {
  const overlay = document.querySelector(".offline-overlay");
  if (overlay) return true;
  const dialogs = document.querySelectorAll<HTMLDialogElement>("dialog[open]");
  const dialog = dialogs.item(dialogs.length - 1);
  if (dialog) {
    if (
      options.dirty &&
      !window.confirm(
        "تغییرات ذخیره‌نشده ممکن است از دست بروند. ادامه می‌دهید؟",
      )
    )
      return true;
    // Respect each component's existing cancel handler (including busy guards).
    const event = new Event("cancel", { cancelable: true });
    if (dialog.dispatchEvent(event)) dialog.close();
    return true;
  }
  if (options.page === "task-new" || options.page === "event-new") {
    const backButton = document.querySelector<HTMLButtonElement>(
      '.new-task header button[aria-label="بازگشت"]',
    );
    if (backButton) {
      if (
        options.dirty &&
        !window.confirm(
          "تغییرات ذخیره‌نشده ممکن است از دست بروند. ادامه می‌دهید؟",
        )
      )
        return true;
      // These forms have their own follow-up/reminder guard and disabled state.
      backButton.click();
      return true;
    }
    // While a lazy form is loading, use the normal page history below.
  }
  while (options.history.at(-1) === options.page) options.history.pop();
  if (!options.history.length) return false;
  if (
    options.dirty &&
    !window.confirm("تغییرات ذخیره‌نشده ممکن است از دست بروند. ادامه می‌دهید؟")
  )
    return true;
  options.navigate(options.history.pop()!);
  return true;
}

export function useNativeBack(
  page: MobilePage,
  active: boolean,
  setPage: (page: MobilePage) => void,
) {
  const history = useRef<MobilePage[]>([]);
  const previous = useRef(page);
  const goingBack = useRef(false);
  const dirty = useRef(false);
  useEffect(() => {
    if (previous.current !== page) {
      if (
        !goingBack.current &&
        previous.current !== "task-new" &&
        previous.current !== "event-new"
      )
        history.current.push(previous.current);
      if (history.current.length > 30) history.current.shift();
      previous.current = page;
      goingBack.current = false;
      dirty.current = false;
    }
  }, [page]);
  useEffect(() => {
    if (!active) {
      history.current = [];
      dirty.current = false;
      return;
    }
    const markDirty = (event: Event) => {
      if (event.target instanceof Element && event.target.closest("form"))
        dirty.current = true;
    };
    const onBack = (event: Event) => {
      const handled = handleNativeBack({
        page,
        history: history.current,
        dirty: dirty.current,
        navigate: (target) => {
          goingBack.current = true;
          setPage(target);
        },
      });
      if (handled) event.preventDefault();
    };
    document.addEventListener("input", markDirty);
    document.addEventListener("change", markDirty);
    window.addEventListener("khoonemoon:native-back", onBack);
    return () => {
      document.removeEventListener("input", markDirty);
      document.removeEventListener("change", markDirty);
      window.removeEventListener("khoonemoon:native-back", onBack);
    };
  }, [active, page, setPage]);
}
