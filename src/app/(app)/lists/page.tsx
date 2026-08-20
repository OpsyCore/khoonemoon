import Link from "next/link";
import { Card, CardDescription, CardTitle } from "@/shared/ui/card";
import { Button } from "@/shared/ui/button";
import { House, ListTodo } from "lucide-react";

export default function ListsPage() {
  return (
    <div className="space-y-4">
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">لیست‌ها و مدیریت گروهی</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          مدیریت لیست‌های خرید، یادداشت‌ها و تسک‌های مشترک.
        </p>
      </section>

      <Card className="flex items-center justify-between p-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
            <House className="size-5" />
            <CardTitle>کارهای خانه و چورها (مایل‌استون ۷)</CardTitle>
          </div>
          <CardDescription>
            مدیریت چرخشی و برنامه‌ریزی کارهای مشترک خانه فعال است.
          </CardDescription>
        </div>
        <Link href="/home">
          <Button size="sm">برو به خونه</Button>
        </Link>
      </Card>

      <Card className="space-y-2 p-5 opacity-80">
        <div className="flex items-center gap-2 text-zinc-500">
          <ListTodo className="size-5" />
          <CardTitle>خرید هفتگی و انبار (به‌زودی)</CardTitle>
        </div>
        <CardDescription>
          لیست‌های خرید هوشمند و انبار خانه در مایل‌استون‌های بعدی اضافه خواهند شد.
        </CardDescription>
      </Card>
    </div>
  );
}
