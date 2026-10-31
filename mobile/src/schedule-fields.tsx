import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaskRecurrenceFrequency } from "@/features/tasks/types";

export const frequencyLabels: Record<TaskRecurrenceFrequency, string> = {
  NONE: "بدون تکرار",
  DAILY: "روزانه",
  INTERVAL_DAYS: "هر چند روز",
  WEEKLY: "هفتگی",
  MONTHLY: "ماهانه",
  YEARLY: "سالانه",
};
const weekdays = [
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
  "شنبه",
];
export function RepeatFields({
  frequency,
  setFrequency,
  interval,
  setInterval,
  days,
  setDays,
}: {
  frequency: TaskRecurrenceFrequency;
  setFrequency: (value: TaskRecurrenceFrequency) => void;
  interval: string;
  setInterval: (value: string) => void;
  days: number[];
  setDays: (value: number[]) => void;
}) {
  return (
    <>
      <label>
        تکرار
        <select
          value={frequency}
          onChange={(e) =>
            setFrequency(e.target.value as TaskRecurrenceFrequency)
          }
        >
          {Object.entries(frequencyLabels).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {frequency === "INTERVAL_DAYS" && (
        <label>
          فاصله (روز)
          <input
            type="number"
            min="1"
            max="365"
            required
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
          />
        </label>
      )}
      {frequency === "WEEKLY" && (
        <fieldset>
          <legend>روزهای هفته</legend>
          {weekdays.map((day, index) => (
            <label className="item" key={day}>
              <input
                type="checkbox"
                checked={days.includes(index)}
                onChange={(e) =>
                  setDays(
                    e.target.checked
                      ? [...days, index]
                      : days.filter((d) => d !== index),
                  )
                }
              />
              {day}
            </label>
          ))}
        </fieldset>
      )}
    </>
  );
}

export function MemberFields({
  client,
  householdId,
  selected,
  setSelected,
}: {
  client: SupabaseClient;
  householdId: string;
  selected: string[];
  setSelected: (value: string[]) => void;
}) {
  const [members, setMembers] = useState<
    { id: string; full_name: string | null }[]
  >([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    void client
      .rpc("household_member_names", { target_household_id: householdId })
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) setError(true);
        else setMembers(data ?? []);
      });
    return () => {
      alive = false;
    };
  }, [client, householdId]);
  if (error)
    return (
      <p role="alert" className="error">
        دریافت اعضا ناموفق بود؛ پیش‌فرض خودتان هستید.
      </p>
    );
  return (
    <fieldset>
      <legend>مسئولان (انتخاب‌نکردن یعنی خودتان)</legend>
      {members.map((member) => (
        <label className="item" key={member.id}>
          <input
            type="checkbox"
            checked={selected.includes(member.id)}
            onChange={(e) =>
              setSelected(
                e.target.checked
                  ? [...selected, member.id]
                  : selected.filter((id) => id !== member.id),
              )
            }
          />
          {member.full_name || "کاربر"}
        </label>
      ))}
    </fieldset>
  );
}
