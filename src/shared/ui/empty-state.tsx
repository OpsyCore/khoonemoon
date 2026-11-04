import { Card } from "@/shared/ui/card";

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="flex flex-col items-start gap-2 p-5">
      <p className="text-base font-semibold text-[var(--app-ink)]">
        {title}
      </p>
      <p className="text-sm text-[var(--app-muted)]">{description}</p>
    </Card>
  );
}
