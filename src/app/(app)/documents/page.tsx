import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DocumentsManager } from "@/features/documents/components/documents-manager";
import { PageHeader } from "@/shared/ui/page-header";

export default function DocumentsPage() {
  return (
    <div className="space-y-7">
      <div className="space-y-4">
        <Link
          href="/home"
          className="inline-flex items-center gap-1 text-[12px] font-medium text-muted transition hover:text-ink"
        >
          <ChevronRight className="size-3.5" strokeWidth={1.75} />
          بازگشت به خونه
        </Link>
        <PageHeader
          kicker="بایگانی خانه"
          title="مدارک"
          subtitle="اسناد و مدارک مهم زندگی مشترک، مرتب و در دسترس."
        />
      </div>
      <DocumentsManager />
    </div>
  );
}
