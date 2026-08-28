import Link from "next/link";
import { DocumentsManager } from "@/features/documents/components/documents-manager";

export default function DocumentsPage() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/home" className="font-medium text-sky-700 dark:text-sky-300">
          خونه
        </Link>
        <span> / مدارک</span>
      </p>
      <DocumentsManager />
    </div>
  );
}
