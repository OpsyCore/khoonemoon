"use client";

import { useEffect, useState } from "react";
import { Button } from "@/shared/ui/button";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { Toggle } from "@/shared/ui/toggle";

type PreferencesState = {
  in_app_enabled: boolean;
  web_push_enabled: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string | null;
  quiet_hours_end: string | null;
};

export function ReminderPreferencesForm() {
  const [state, setState] = useState<PreferencesState>({
    in_app_enabled: true,
    web_push_enabled: false,
    quiet_hours_enabled: false,
    quiet_hours_start: null,
    quiet_hours_end: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      const res = await fetch("/api/reminder-preferences", {
        cache: "no-store",
      });
      const payload = (await res.json()) as { preferences?: PreferencesState };

      if (res.ok && payload.preferences) {
        setState(payload.preferences);
      }

      setLoading(false);
    };

    void run();
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    const res = await fetch("/api/reminder-preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inAppEnabled: state.in_app_enabled,
        webPushEnabled: state.web_push_enabled,
        quietHoursEnabled: state.quiet_hours_enabled,
        quietHoursStart: state.quiet_hours_start,
        quietHoursEnd: state.quiet_hours_end,
      }),
    });

    const payload = (await res.json()) as { message?: string };

    if (!res.ok) {
      setError(payload.message ?? "ذخیره تنظیمات یادآور ناموفق بود.");
      setSaving(false);
      return;
    }

    setSuccess("تنظیمات یادآور ذخیره شد.");
    setSaving(false);
  };

  if (loading) {
    return (
      <Card>
        <CardTitle>ترجیحات یادآور</CardTitle>
        <CardDescription>در حال بارگذاری تنظیمات...</CardDescription>
      </Card>
    );
  }

  return (
    <Card className="space-y-3 p-5">
      <CardTitle>ترجیحات یادآور</CardTitle>

      <div className="divide-y divide-line">
        <Toggle
          label="یادآور درون‌برنامه‌ای"
          checked={state.in_app_enabled}
          onChange={(checked) =>
            setState((prev) => ({ ...prev, in_app_enabled: checked }))
          }
        />
        <Toggle
          label="یادآور وب (Push)"
          checked={state.web_push_enabled}
          onChange={(checked) =>
            setState((prev) => ({ ...prev, web_push_enabled: checked }))
          }
        />
        <Toggle
          label="ساعات سکوت"
          description="در این بازه یادآورها بی‌صدا می‌مانند."
          checked={state.quiet_hours_enabled}
          onChange={(checked) =>
            setState((prev) => ({ ...prev, quiet_hours_enabled: checked }))
          }
        />
      </div>

      {state.quiet_hours_enabled ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label="شروع"
            type="time"
            value={state.quiet_hours_start ?? "22:00"}
            onChange={(event) =>
              setState((prev) => ({
                ...prev,
                quiet_hours_start: event.target.value,
              }))
            }
          />
          <Input
            label="پایان"
            type="time"
            value={state.quiet_hours_end ?? "07:00"}
            onChange={(event) =>
              setState((prev) => ({
                ...prev,
                quiet_hours_end: event.target.value,
              }))
            }
          />
        </div>
      ) : null}

      {error ? <p className="text-sm text-danger-ink">{error}</p> : null}
      {success ? <p className="text-sm text-olive-ink">{success}</p> : null}

      <Button onClick={save} isLoading={saving}>
        ذخیره تنظیمات یادآور
      </Button>
    </Card>
  );
}
