"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/shared/ui/button";

export function LogoutButton({ showLabel = false }: { showLabel?: boolean }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
      router.replace("/auth/login");
      router.refresh();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={showLabel ? undefined : "w-9 px-0"}
      aria-label="خروج از حساب"
      onClick={handleLogout}
      disabled={isLoading}
    >
      {showLabel ? "خروج از حساب" : <LogOut className="size-4" />}
    </Button>
  );
}
