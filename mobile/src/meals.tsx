import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  Moon,
  Plus,
  Soup,
  Sun,
  Sunrise,
  UserRound,
} from "lucide-react";
import { directShopping } from "@/features/shopping/direct-client";
import type { ShoppingList } from "@/features/shopping/types";
import { directMeals } from "@/features/meals/direct-client";
import {
  addDays,
  fromLocalDate,
  ingredientLines,
  localDate,
  mealNames,
  mealTypes,
  saturday,
  type Meal,
  type MealType,
} from "@/features/meals/model";
import breakfast from "./assets/meal-breakfast.webp";
import lunch from "./assets/meal-lunch.webp";
import dinner from "./assets/meal-dinner.webp";
import basket from "./assets/meal-basket.webp";
import "./meals.css";
function assetUrl(asset: string | { src: string }): string {
  return typeof asset === "string" ? asset : asset.src;
}
const pictures = {
  breakfast: assetUrl(breakfast),
  lunch: assetUrl(lunch),
  dinner: assetUrl(dinner),
};
const icons = { breakfast: Sunrise, lunch: Sun, dinner: Moon };
const weekDay = (d: Date) =>
  new Intl.DateTimeFormat("fa-IR", { weekday: "long" }).format(d);
const shortDate = (d: Date) =>
  new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "long" }).format(d);
const longDate = (d: Date) =>
  new Intl.DateTimeFormat("fa-IR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
export function Meals({
  client,
  householdId,
  onShopping,
  onHouse,
}: {
  client: SupabaseClient;
  householdId: string | null;
  onShopping: () => void;
  onHouse: () => void;
}) {
  const api = useMemo(() => directMeals(client), [client]);
  const [selected, setSelected] = useState(() => localDate(new Date()));
  const [rows, setRows] = useState<Meal[]>([]);
  const [loadedKey, setLoadedKey] = useState("");
  const requestSequence = useRef(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[] | null>(
    null,
  );
  const [shoppingList, setShoppingList] = useState("");
  const [chosenIngredients, setChosenIngredients] = useState<string[]>([]);
  const [transferOpen, setTransferOpen] = useState(false);
  const transferContext = useRef("");
  const [transferKey, setTransferKey] = useState("");
  const [editing, setEditing] = useState<Meal | null>(null);
  const [type, setType] = useState<MealType>("breakfast");
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState("");
  const [assignee, setAssignee] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [image, setImage] = useState<MealType | "">("");
  const selectedDay = fromLocalDate(selected);
  const weekStart = useMemo(
    () => localDate(saturday(fromLocalDate(selected))),
    [selected],
  );
  const loaded = loadedKey === `${householdId}:${weekStart}`;
  const currentTransferContext = `${householdId}:${weekStart}`;
  useEffect(() => {
    transferContext.current = currentTransferContext;
  }, [currentTransferContext]);
  const load = useCallback(async () => {
    if (!householdId) return;
    const sequence = ++requestSequence.current;
    const currentKey = `${householdId}:${weekStart}`;
    const start = fromLocalDate(weekStart);
    const end = localDate(addDays(start, 13));
    try {
      const data = await api.list(householdId, weekStart, end);
      if (sequence !== requestSequence.current) return;
      setRows(data);
      setLoadedKey(currentKey);
    } catch {
      if (sequence !== requestSequence.current) return;
      setLoadedKey("");
      setMessage(
        "دریافت برنامه غذایی ناموفق بود؛ اتصال را بررسی و دوباره تلاش کنید.",
      );
    }
  }, [api, householdId, weekStart]);
  useEffect(() => {
    void Promise.resolve().then(load);
    return () => {
      requestSequence.current += 1;
    };
  }, [load]);
  const dayMeals = rows.filter((m) => m.meal_date === selected);
  const upcoming = Array.from({ length: 6 }, (_, i) =>
    addDays(selectedDay, i + 1),
  );
  const grocery = ingredientLines(
    rows.filter(
      (m) =>
        m.meal_date >= weekStart &&
        m.meal_date <= localDate(addDays(fromLocalDate(weekStart), 6)),
    ),
  );
  async function openTransfer() {
    if (!householdId || busy) return;
    const context = currentTransferContext;
    setBusy(true);
    setMessage("");
    try {
      const lists = await directShopping(client).lists(householdId);
      if (context !== transferContext.current) return;
      setTransferKey(context);
      setShoppingLists(lists);
      setShoppingList(lists[0]?.id ?? "");
      setChosenIngredients(grocery);
      setTransferOpen(true);
    } catch {
      setMessage("دریافت لیست‌های خرید ناموفق بود؛ دوباره تلاش کنید.");
    } finally {
      setBusy(false);
    }
  }
  async function transferIngredients() {
    if (!shoppingList || !chosenIngredients.length || busy) return;
    if (chosenIngredients.length > 200) {
      setMessage("در هر بار حداکثر ۲۰۰ ماده انتخاب کنید.");
      return;
    }
    if (chosenIngredients.some((name) => name.length > 160)) {
      setMessage(
        "نام هر ماده برای لیست خرید باید حداکثر ۱۶۰ نویسه باشد؛ متن وعده را کوتاه کنید.",
      );
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await client.rpc("mobile_add_meal_ingredients", {
        p_list: shoppingList,
        p_names: chosenIngredients,
      });
      if (
        error ||
        !data ||
        !Number.isSafeInteger(data.inserted) ||
        !Number.isSafeInteger(data.skipped)
      )
        throw new Error();
      setMessage(
        `${data.inserted.toLocaleString("fa-IR")} ماده اضافه شد؛ ${data.skipped.toLocaleString("fa-IR")} مورد موجود بود.`,
      );
      setTransferOpen(false);
    } catch {
      setMessage(
        "انتقال تأیید نشد؛ ممکن است مواد اضافه شده باشند. فهرست خرید را بررسی کنید؛ تلاش دوباره موارد موجود را تکرار نمی‌کند.",
      );
    } finally {
      setBusy(false);
    }
  }
  function changeDay(date: Date) {
    if (busy) return;
    if (
      formOpen &&
      (title || minutes || assignee || ingredients) &&
      !window.confirm("تغییرات ذخیره‌نشده کنار گذاشته شود؟")
    )
      return;
    setFormOpen(false);
    setSelected(localDate(date));
  }
  function openForm(slot: MealType, record?: Meal) {
    setType(slot);
    setEditing(record ?? null);
    setTitle(record?.title ?? "");
    setMinutes(record?.minutes?.toString() ?? "");
    setAssignee(record?.assignee ?? "");
    setIngredients(record?.ingredients ?? "");
    setImage(record?.image_choice ?? "");
    setMessage("");
    setFormOpen(true);
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!householdId || busy) return;
    const parsed = minutes.trim() === "" ? null : Number(minutes);
    if (
      parsed !== null &&
      (!Number.isInteger(parsed) || parsed < 0 || parsed > 1440)
    ) {
      setMessage("زمان باید از صفر تا ۱۴۴۰ دقیقه باشد.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const input = {
        date: selected,
        type,
        title,
        minutes: parsed,
        assignee: assignee || null,
        ingredients: ingredients || null,
        image: image || null,
      };
      if (editing) await api.update(editing, input);
      else await api.create(householdId, input);
      setFormOpen(false);
      setMessage("وعده ذخیره شد.");
      await load();
    } catch {
      setMessage(
        "ذخیره تأیید نشد؛ اطلاعات را بررسی و پیش از تلاش دوباره تازه‌سازی کنید. برای هر روز و وعده فقط یک برنامه مجاز است.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove(meal: Meal) {
    if (busy || !window.confirm(`وعده «${meal.title}» حذف شود؟`)) return;
    setBusy(true);
    try {
      await api.remove(meal);
      setFormOpen(false);
      setMessage("وعده حذف شد.");
      await load();
    } catch {
      setMessage("حذف تأیید نشد؛ اطلاعات را تازه‌سازی کنید.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="meals-page" dir="rtl">
      <header className="meals-hero">
        <span aria-hidden="true" className="meals-branch">
          ❧
        </span>
        <span aria-hidden="true" className="meals-vase">
          ♧
        </span>
        <h1>برنامه غذایی</h1>
        <p>❧ &nbsp; برای روزهای خوشمزه‌تر &nbsp; ❧</p>
      </header>
      {!householdId ? (
        <section className="meals-panel meals-no-house">
          <p>برای برنامه‌ریزی مشترک، ابتدا یک خانه بسازید یا به آن بپیوندید.</p>
          <button type="button" onClick={onHouse}>
            رفتن به خانه
          </button>
        </section>
      ) : (
        <>
          <div className="meals-week-controls">
            <button
              type="button"
              aria-label="هفته قبل"
              disabled={busy}
              onClick={() => changeDay(addDays(selectedDay, -7))}
            >
              <ChevronRight size={18} />
            </button>
            <span>هفتهٔ {shortDate(fromLocalDate(weekStart))}</span>
            <button
              type="button"
              aria-label="هفته بعد"
              disabled={busy}
              onClick={() => changeDay(addDays(selectedDay, 7))}
            >
              <ChevronLeft size={18} />
            </button>
          </div>
          <nav className="meals-week" aria-label="روزهای هفته">
            {Array.from({ length: 7 }, (_, i) =>
              addDays(fromLocalDate(weekStart), i),
            ).map((d) => (
              <button
                type="button"
                key={localDate(d)}
                aria-pressed={selected === localDate(d)}
                disabled={busy}
                onClick={() => changeDay(d)}
              >
                {weekDay(d)}
                {selected === localDate(d) && <span aria-hidden="true">❀</span>}
              </button>
            ))}
          </nav>
          {message && (
            <p role="status" className="meals-message">
              {message}
            </p>
          )}
          {!loaded ? (
            <p role="status">
              برنامه دریافت نشده است.{" "}
              <button type="button" onClick={() => void load()}>
                تلاش دوباره
              </button>
            </p>
          ) : (
            <>
              <section className="meals-panel meals-today">
                <h2>
                  <span>❧</span>{" "}
                  {selected === localDate(new Date()) && <em>امروز</em>}{" "}
                  {longDate(selectedDay)} <span>❧</span>
                </h2>
                <div className="meal-cards">
                  {mealTypes.map((slot) => {
                    const m = dayMeals.find((r) => r.meal_type === slot);
                    const Icon = icons[slot];
                    return (
                      <article className="meal-card" key={slot}>
                        <h3>
                          <Icon aria-hidden="true" /> {mealNames[slot]}
                        </h3>
                        {m?.image_choice ? (
                          <div className="meal-photo">
                            <img src={pictures[m.image_choice]} alt="" />
                            <small>تصویر نمونه</small>
                          </div>
                        ) : (
                          <div className="meal-photo meal-no-photo">
                            <Soup size={35} aria-hidden="true" />
                            <span>{m ? "بدون تصویر" : "وعده‌ای ثبت نشده"}</span>
                          </div>
                        )}
                        {m ? (
                          <>
                            <strong>{m.title}</strong>
                            <p>
                              <Clock3 size={16} />
                              {m.minutes === null
                                ? "زمان مشخص نشده"
                                : `${m.minutes.toLocaleString("fa-IR")} دقیقه`}
                            </p>
                            <p>
                              <UserRound size={16} />
                              {m.assignee
                                ? `مسئول: ${m.assignee}`
                                : "مسئول مشخص نشده"}
                            </p>
                            <button
                              type="button"
                              onClick={() => openForm(slot, m)}
                            >
                              ویرایش
                            </button>
                          </>
                        ) : (
                          <button type="button" onClick={() => openForm(slot)}>
                            افزودن {mealNames[slot]}
                          </button>
                        )}
                      </article>
                    );
                  })}
                </div>
              </section>
              <section className="meals-future">
                <h2>برنامه روزهای بعد</h2>
                <div className="meals-future-strip">
                  {upcoming.map((d) => {
                    const date = localDate(d);
                    const dayRows = rows.filter((r) => r.meal_date === date);
                    return (
                      <button
                        type="button"
                        key={date}
                        disabled={busy}
                        onClick={() => {
                          changeDay(d);
                        }}
                      >
                        <strong>{weekDay(d)}</strong>
                        <span>{shortDate(d)}</span>
                        <span className="meals-future-icons">
                          {mealTypes.map((slot) => {
                            const Icon = icons[slot];
                            return (
                              <i
                                key={slot}
                                className={
                                  dayRows.some((r) => r.meal_type === slot)
                                    ? "filled"
                                    : ""
                                }
                              >
                                <Icon size={14} />
                              </i>
                            );
                          })}
                        </span>
                        <b>{dayRows.length.toLocaleString("fa-IR")} وعده</b>
                      </button>
                    );
                  })}
                </div>
              </section>
              <section className="meals-ingredients">
                <img src={assetUrl(basket)} alt="" />
                <div>
                  <h2>مواد اولیه موردنیاز</h2>
                  <p>
                    {grocery.length
                      ? grocery.join("، ")
                      : "هنوز ماده اولیه‌ای برای این هفته ثبت نشده است."}
                  </p>
                  <button type="button" onClick={onShopping}>
                    مشاهده در لیست خرید ‹
                  </button>
                  {grocery.length > 0 && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void openTransfer()}
                    >
                      انتخاب و افزودن مواد به خرید
                    </button>
                  )}
                  {transferOpen && transferKey === currentTransferContext && (
                    <div className="meals-transfer">
                      {shoppingLists?.length ? (
                        <>
                          <label>
                            لیست خرید{" "}
                            <select
                              value={shoppingList}
                              onChange={(e) => setShoppingList(e.target.value)}
                            >
                              {shoppingLists.map((list) => (
                                <option key={list.id} value={list.id}>
                                  {list.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          {grocery.map((item) => (
                            <label key={item}>
                              <input
                                type="checkbox"
                                checked={chosenIngredients.includes(item)}
                                onChange={(e) =>
                                  setChosenIngredients((items) =>
                                    e.target.checked
                                      ? [...items, item]
                                      : items.filter((value) => value !== item),
                                  )
                                }
                              />{" "}
                              {item}
                            </label>
                          ))}
                          <button
                            type="button"
                            disabled={busy || !chosenIngredients.length}
                            onClick={() => void transferIngredients()}
                          >
                            افزودن موارد انتخاب‌شده
                          </button>
                        </>
                      ) : (
                        <small>ابتدا در صفحه خرید یک لیست بسازید.</small>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setTransferOpen(false)}
                      >
                        بستن
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
          <button
            type="button"
            className="meals-add"
            onClick={() => openForm("breakfast")}
          >
            <Plus /> افزودن وعده غذایی
          </button>
          {formOpen && (
            <form className="meals-form meals-panel" onSubmit={save}>
              <h2>
                {editing ? "ویرایش وعده" : "افزودن وعده"} ·{" "}
                {longDate(selectedDay)}
              </h2>
              <label>
                وعده
                <select
                  value={type}
                  disabled={!!editing}
                  onChange={(e) => setType(e.target.value as MealType)}
                >
                  {mealTypes.map((t) => (
                    <option key={t} value={t}>
                      {mealNames[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                نام غذا
                <input
                  required
                  maxLength={120}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label>
                زمان آماده‌سازی (دقیقه)
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                />
              </label>
              <label>
                نام مسئول (اختیاری)
                <input
                  maxLength={80}
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                />
              </label>
              <label>
                مواد اولیه (هر مورد در یک خط)
                <textarea
                  maxLength={2000}
                  value={ingredients}
                  onChange={(e) => setIngredients(e.target.value)}
                />
              </label>
              <label>
                تصویر نمونه
                <select
                  value={image}
                  onChange={(e) => setImage(e.target.value as MealType | "")}
                >
                  <option value="">بدون تصویر</option>
                  <option value="breakfast">صبحانه سنتی</option>
                  <option value="lunch">جوجه‌کباب</option>
                  <option value="dinner">قرمه‌سبزی</option>
                </select>
              </label>
              <div>
                <button type="submit" disabled={busy}>
                  {busy ? "در حال ذخیره…" : "ذخیره وعده"}
                </button>
                <button type="button" onClick={() => setFormOpen(false)}>
                  انصراف
                </button>
                {editing && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void remove(editing)}
                  >
                    حذف وعده
                  </button>
                )}
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}
