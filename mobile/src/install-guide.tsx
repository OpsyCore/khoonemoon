import { useEffect, useState } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);
  const [installed, setInstalled] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const offer = (event: Event) => {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const done = () => {
      setPrompt(null);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", offer);
    window.addEventListener("appinstalled", done);
    return () => {
      window.removeEventListener("beforeinstallprompt", offer);
      window.removeEventListener("appinstalled", done);
    };
  }, []);
  async function install() {
    if (!prompt) return;
    setPrompt(null);
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      setMessage(
        choice.outcome === "accepted"
          ? "درخواست نصب پذیرفته شد."
          : "نصب انجام نشد؛ از منوی مرورگر هم می‌توانید اقدام کنید.",
      );
    } catch {
      setMessage("درخواست نصب در دسترس نیست؛ از منوی مرورگر اقدام کنید.");
    }
  }
  return { available: !!prompt, installed, message, install };
}

export function InstallGuide({
  state,
}: {
  state: ReturnType<typeof useInstallPrompt>;
}) {
  return (
    <section>
      <h2>نصب و اتصال</h2>
      {window.KhoonemoonNotifications ? (
        <p>این برنامه به‌صورت مستقل روی اندروید نصب شده است.</p>
      ) : (
        <>
          <p>
            برای نصب وب‌اپ از گزینهٔ نصب مرورگر یا منوی مرورگر و «افزودن به صفحه
            اصلی» استفاده کنید.
          </p>
          {state.available && !state.installed && (
            <button type="button" onClick={() => void state.install()}>
              نصب وب‌اپ
            </button>
          )}
          {state.installed && <p role="status">وب‌اپ نصب شد.</p>}
          {state.message && <p role="status">{state.message}</p>}
        </>
      )}
      <p>
        پس از دریافت اولیه ممکن است پوسته بدون اینترنت باز شود؛ داده‌های خصوصی و
        ثبت تغییرات به اینترنت نیاز دارند و آفلاین ذخیره نمی‌شوند.
      </p>
    </section>
  );
}
