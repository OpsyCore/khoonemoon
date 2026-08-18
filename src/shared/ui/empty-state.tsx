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
      <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
        {title}
      </p>
      <p className="text-sm text-zinc-600 dark:text-zinc-300">{description}</p>
    </Card>
  );
}
