import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { directHousehold } from "@/features/households/direct-client";

type Details = Awaited<
  ReturnType<ReturnType<typeof directHousehold>["details"]>
>;
export function HouseholdDetails({
  client,
  householdId,
  userId,
  onLeave,
}: {
  client: SupabaseClient;
  householdId: string;
  userId: string;
  onLeave: () => void;
}) {
  const api = useMemo(() => directHousehold(client), [client]);
  const [details, setDetails] = useState<Details | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const data = await api.details(householdId, userId);
    setDetails(data);
    setName(data.house.name);
  }, [api, householdId, userId]);
  useEffect(() => {
    let active = true;
    void api
      .details(householdId, userId)
      .then((data) => {
        if (active) {
          setDetails(data);
          setName(data.house.name);
        }
      })
      .catch(() => {
        if (active) setMessage("دریافت اعضای خانه ناموفق بود.");
      });
    return () => {
      active = false;
    };
  }, [api, householdId, userId]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch {
      setMessage("عملیات خانه انجام نشد؛ دسترسی و اتصال را بررسی کنید.");
    } finally {
      setBusy(false);
    }
  }
  function rename(event: FormEvent) {
    event.preventDefault();
    void action(async () => {
      await api.rename(householdId, name);
      await load();
    });
  }
  return (
    <>
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
      {!details ? (
        <p>در حال دریافت اطلاعات خانه…</p>
      ) : (
        <>
          <p>خانه: {details.house.name}</p>
          <ul>
            {details.members.map((member) => (
              <li key={member.user_id}>
                {member.name} {member.role === "OWNER" ? "(مالک)" : ""}
              </li>
            ))}
          </ul>
          {details.role === "OWNER" && (
            <>
              <form onSubmit={rename}>
                <label>
                  نام خانه
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    minLength={2}
                    maxLength={80}
                  />
                </label>
                <button disabled={busy}>تغییر نام خانه</button>
              </form>
              <button
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    const invite = await api.invite();
                    setCode(invite.code);
                    await load();
                  })
                }
              >
                ساخت کد دعوت
              </button>
              {code && (
                <label>
                  کد دعوت (تا ۷۲ ساعت معتبر است)
                  <input
                    value={code}
                    readOnly
                    dir="ltr"
                    onFocus={(e) => e.target.select()}
                  />
                </label>
              )}
              <h3>دعوت‌ها</h3>
              <ul>
                {details.invitations.map((invitation) => (
                  <li key={invitation.id}>
                    <span>
                      {invitation.status} —{" "}
                      {new Intl.DateTimeFormat("fa-IR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(new Date(invitation.expires_at))}
                    </span>
                    {invitation.status === "PENDING" && (
                      <button
                        className="minor"
                        disabled={busy}
                        onClick={() =>
                          void action(async () => {
                            await api.cancel(invitation.id);
                            setCode("");
                            await load();
                          })
                        }
                      >
                        لغو دعوت
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          <button
            className="minor"
            disabled={busy}
            onClick={() => {
              if (window.confirm("از خانه خارج شوید؟"))
                void action(async () => {
                  await api.leave();
                  onLeave();
                });
            }}
          >
            ترک خانه
          </button>
        </>
      )}
    </>
  );
}
