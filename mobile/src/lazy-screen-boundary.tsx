import { Component, type ReactNode } from "react";

/** A missing or damaged local chunk must not leave a blank Android screen. */
export class LazyScreenBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <section role="alert">
          <p>بارگذاری صفحه ممکن نشد. اتصال یا فایل‌های برنامه را بررسی کنید.</p>
          <button type="button" onClick={() => window.location.reload()}>
            بارگذاری دوباره برنامه
          </button>
        </section>
      );
    return this.props.children;
  }
}
