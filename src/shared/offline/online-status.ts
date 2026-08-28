export function subscribeOnlineStatus(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("online", onStoreChange);
  window.addEventListener("offline", onStoreChange);
  return () => {
    window.removeEventListener("online", onStoreChange);
    window.removeEventListener("offline", onStoreChange);
  };
}

export function getOnlineSnapshot() {
  if (typeof navigator === "undefined") {
    return true;
  }
  return navigator.onLine;
}

export function getOnlineServerSnapshot() {
  return true;
}

export function offlineUserMessage() {
  return "اتصال اینترنت قطع است. پس از اتصال دوباره تلاش کنید.";
}

export function resolveOfflineRetryHref(isOnline: boolean) {
  return isOnline ? "/today" : "/offline";
}
