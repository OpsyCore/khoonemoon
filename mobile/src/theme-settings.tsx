import type { ThemeMode } from "./theme";
export function ThemeSettings({
  mode,
  setMode,
  persisted,
}: {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  persisted: boolean;
}) {
  return (
    <section>
      <h2>ظاهر برنامه</h2>
      <label>
        رنگ صفحه
        <select
          value={mode}
          onChange={(event) => setMode(event.target.value as ThemeMode)}
        >
          <option value="light">روشن</option>
          <option value="dark">تاریک</option>
          <option value="system">مانند تنظیم دستگاه</option>
        </select>
      </label>
      <p>حالت روشن با رنگ‌های کاغذی و گیاهی طراحی شده است.</p>
      {!persisted && (
        <p role="status">
          تنظیم برای این بار اعمال شد، اما در این دستگاه ذخیره نشد.
        </p>
      )}
    </section>
  );
}
