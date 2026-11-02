import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  Handshake,
  Heart,
  House,
  Lightbulb,
  MoreHorizontal,
  Plus,
  Scale,
  ShoppingBasket,
  Utensils,
  Wallet,
} from "lucide-react";
import type { FinancialRecord } from "@/features/finance/types";
import type { SettlementResult } from "@/features/finance/settlement";
import { financeDashboard } from "@/features/finance/dashboard";
import { formatAmount, getBillStatus } from "@/features/finance/bills";
import { formatPersianDate } from "@/shared/utils/locale";
import "./finance-overview.css";

export function FinanceOverview({
  records,
  now,
  currency,
  settlement,
  membersReady,
  householdId,
  excluded,
  onAdd,
  onRecord,
  onCategory,
}: {
  records: FinancialRecord[];
  now: Date;
  currency: string;
  settlement: SettlementResult;
  membersReady: boolean;
  householdId: string | null;
  excluded: number;
  onAdd: () => void;
  onRecord: (r: FinancialRecord) => void;
  onCategory: (category: string, income?: boolean) => void;
}) {
  const d = financeDashboard(records, now, currency);
  const ratio = d.expense ? (d.shared / d.expense) * 100 : 0;
  const change = (x: number | null) =>
    x === null
      ? "ماه قبل داده‌ای برای مقایسه ندارد"
      : `${x > 0 ? "+" : ""}${x.toLocaleString("fa-IR", { maximumFractionDigits: 1 })}٪ نسبت به کل ماه قبل`;
  const cats = [
    { name: "درآمد", icon: Wallet, income: true },
    { name: "رفت‌وآمد", icon: CalendarDays },
    { name: "مسکن", icon: House },
    { name: "خوراک", icon: Utensils },
    { name: "خرید", icon: ShoppingBasket },
    { name: "سلامت", icon: Heart },
    { name: "تفریح", icon: CircleDollarSign },
    { name: "همه", icon: MoreHorizontal },
  ];
  return (
    <div className="fin-dash">
      <div className="fin-month-grid">
        <div className="fin-month expense">
          <div>
            <span>
              <ArrowDownRight size={20} />
            </span>
            <strong>هزینه این ماه</strong>
          </div>
          <b>{formatAmount(d.expense, currency)}</b>
          <small>{change(d.expenseChange)}</small>
        </div>
        <div className="fin-month income">
          <div>
            <span>
              <ArrowUpRight size={20} />
            </span>
            <strong>درآمد این ماه</strong>
          </div>
          <b>{formatAmount(d.income, currency)}</b>
          <small>{change(d.incomeChange)}</small>
        </div>
      </div>
      <p className="fin-explanation">
        ماه شمسی جاری؛ فقط درآمد و هزینه‌های ثبت‌شده و قبض‌های پرداخت‌شده در ارز
        انتخابی. بدهی و قبض پرداخت‌نشده در هزینه محاسبه نمی‌شوند.
      </p>
      <div className="fin-middle">
        <div className="fin-card fin-bills">
          <h3>قبض‌ها و پرداخت‌های تسویه‌نشده</h3>
          {d.upcoming.length ? (
            d.upcoming.map((r) => (
              <button key={r.id} onClick={() => onRecord(r)}>
                <span className="fin-round amber">
                  <Lightbulb size={19} />
                </span>
                <span>
                  <strong>{r.title}</strong>
                  <small>
                    {r.due_at && formatPersianDate(r.due_at)} ·{" "}
                    {getBillStatus({
                      dueAt: r.due_at,
                      paidAt: r.paid_at,
                      now,
                    }) === "OVERDUE"
                      ? "معوق"
                      : "پرداخت‌نشده"}
                  </small>
                </span>
                <b>{formatAmount(r.amount, currency)}</b>
              </button>
            ))
          ) : (
            <p>قبض پرداخت‌نشده‌ای وجود ندارد.</p>
          )}
        </div>
        <div className="fin-card fin-breakdown">
          <h3>تقسیم هزینه‌های این ماه</h3>
          <div className="fin-breakdown-content">
            <div className="fin-legend">
              <span>
                <i className="olive" /> مشترک{" "}
                <b>{formatAmount(d.shared, currency)}</b>
              </span>
              <span>
                <i className="clay" /> شخصی{" "}
                <b>{formatAmount(d.personal, currency)}</b>
              </span>
            </div>
            <div
              className="fin-donut"
              style={{
                background: d.expense
                  ? `conic-gradient(#59694d 0 ${ratio}%, #c9846b ${ratio}% 100%)`
                  : "#e3e1d8",
              }}
              role="img"
              aria-label={`هزینه مشترک ${formatAmount(d.shared, currency)} و شخصی ${formatAmount(d.personal, currency)}`}
            >
              <span>
                <b>{formatAmount(d.expense, currency)}</b>
                <small>مجموع هزینه</small>
              </span>
            </div>
          </div>
        </div>
      </div>
      {householdId && (
        <>
          <h3 className="fin-section-label">مشارکت مالی شما</h3>
          {membersReady ? (
            <>
              <div className="fin-members">
                {settlement.balances.map((member) => (
                  <div className="fin-card fin-member" key={member.memberId}>
                    <div>
                      <span className="fin-avatar">
                        {member.name.slice(0, 1)}
                      </span>
                      <strong>{member.name}</strong>
                    </div>
                    <small>پرداخت ثبت‌شده در هزینه‌های قابل تسویه</small>
                    <b>{formatAmount(member.paid, currency)}</b>
                    <small>
                      سهم برابر: {formatAmount(member.share, currency)}
                    </small>
                    <div className="fin-progress">
                      <span
                        style={{
                          width: `${settlement.total ? Math.min(100, (member.paid / settlement.total) * 100) : 0}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="fin-settlement fin-card">
                <div>
                  <span>
                    <Handshake size={20} />
                  </span>
                  <strong>برآورد تسویه بین اعضای فعلی</strong>
                  <p>
                    {settlement.total === 0
                      ? "هنوز هزینه قابل تسویه‌ای ثبت نشده است."
                      : settlement.transfers.length
                        ? "انتقال‌های پیشنهادی در پایین آمده است."
                        : "در این برآورد انتقالی پیشنهاد نمی‌شود."}
                  </p>
                </div>
                <div>
                  <span>
                    <Scale size={20} />
                  </span>
                  <strong>تراز این ماه</strong>
                  <b>{formatAmount(d.income - d.expense, currency)}</b>
                  <small>درآمد منهای هزینه، نه مانده حساب</small>
                </div>
              </div>
              <div className="fin-card fin-transfer">
                <div>
                  <Lightbulb size={20} />
                  <strong>انتقال‌های پیشنهادی</strong>
                </div>
                <p>
                  تقسیم برابر هزینه‌های مشترک قابل تسویه بین اعضای فعلی، بدون
                  بدهی‌های ثبت‌شده؛ پرداخت واقعی ثبت نمی‌شود.
                </p>
                {excluded > 0 && (
                  <p role="status">
                    {excluded.toLocaleString("fa-IR")} پرداخت به‌علت نبود
                    پرداخت‌کننده در اعضای فعلی محاسبه نشده است.
                  </p>
                )}
                {settlement.transfers.length ? (
                  settlement.transfers.map((t) => (
                    <p key={`${t.fromId}-${t.toId}`}>
                      {t.fromName} به {t.toName}:{" "}
                      {formatAmount(t.amount, currency)}
                    </p>
                  ))
                ) : (
                  <p>
                    {settlement.total
                      ? "در این برآورد انتقالی پیشنهاد نمی‌شود."
                      : "داده‌ای برای پیشنهاد انتقال وجود ندارد."}
                  </p>
                )}
              </div>
            </>
          ) : (
            <p>اطلاعات اعضا برای برآورد تسویه در دسترس نیست.</p>
          )}
        </>
      )}
      <div className="fin-card fin-categories">
        <h3>دسته‌بندی هزینه‌ها و درآمدها</h3>
        <div>
          {cats.map(({ name, icon: Icon, income }) => (
            <button
              key={name}
              onClick={() => onCategory(name === "همه" ? "" : name, income)}
            >
              <span>
                <Icon size={20} />
              </span>
              <small>{name}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="fin-card fin-recent">
        <h3>آخرین موارد ثبت‌شده</h3>
        {d.recent.length ? (
          d.recent.map((r) => (
            <button key={r.id} onClick={() => onRecord(r)}>
              <span className="fin-round">
                <CircleDollarSign size={20} />
              </span>
              <span>
                <strong>{r.title}</strong>
                <small>
                  ثبت: {formatPersianDate(r.created_at)}
                  {r.due_at && !r.paid_at ? " · پرداخت‌نشده" : ""}
                </small>
              </span>
              <b
                className={r.record_type === "INCOME" ? "positive" : "negative"}
              >
                {r.record_type === "INCOME"
                  ? "+"
                  : r.record_type === "EXPENSE" && !r.due_at
                    ? "−"
                    : ""}
                {formatAmount(r.amount, currency)}
              </b>
            </button>
          ))
        ) : (
          <p>هنوز موردی ثبت نشده است.</p>
        )}
      </div>
      <button className="fin-add" type="button" onClick={onAdd}>
        <Plus size={22} /> ثبت تراکنش جدید
      </button>
    </div>
  );
}
