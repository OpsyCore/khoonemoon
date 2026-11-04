"use client";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { LogoutButton } from "@/features/auth/components/logout-button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { SettingsDashboard } from "../../../../mobile/src/settings";
import { useInstallPrompt } from "../../../../mobile/src/install-guide";
import type { ThemeMode } from "../../../../mobile/src/theme";
export function SettingsReference() {
  const client = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const install = useInstallPrompt();
  const mode: ThemeMode =
    theme === "dark" || theme === "light" ? theme : "system";
  return (
    <SettingsDashboard
      client={client}
      theme={mode}
      setTheme={setTheme}
      install={install}
      onHouse={() => router.push("/home")}
      onAccount={() => router.push("/profile")}
      accountExtra={<LogoutButton showLabel />}
    />
  );
}
