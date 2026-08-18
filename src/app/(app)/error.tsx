"use client";

import { ErrorState } from "@/shared/ui/error-state";

export default function AppError({ reset }: { reset: () => void }) {
  return (
    <ErrorState
      title="خطا در بارگذاری صفحه"
      description="دوباره تلاش کنید."
      onRetry={reset}
    />
  );
}
