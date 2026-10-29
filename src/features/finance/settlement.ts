import type {
  FinancialRecord,
  FinancialRecordType,
} from "@/features/finance/types";

/**
 * Household settlement ("تسویه‌حساب").
 *
 * Every shared record in the household was paid by exactly one person but is
 * consumed by everyone, so each record creates a debt from the other members to
 * the payer. Instead of tracking individual IOUs, this module reduces the whole
 * period to one net balance per member and then to the smallest sensible set of
 * transfers ("علی ۱۲۰٬۰۰۰ تومان به سارا بدهکار است").
 *
 * All money math happens in integer minor units (cents) so repeated division and
 * subtraction can never drift, and the invariant `sum(balances) === 0` always
 * holds — see `settleHousehold.test.ts`.
 */

const BILL_TYPES: ReadonlySet<FinancialRecordType> = new Set([
  "BILL",
  "SUBSCRIPTION",
  "INSTALLMENT",
]);

export type SettlementMember = {
  id: string;
  name: string;
};

export type MemberBalance = {
  memberId: string;
  name: string;
  /** Amount this member actually paid for shared records. */
  paid: number;
  /** Fair share this member should have paid. */
  share: number;
  /** Positive = gets money back, negative = owes money. Always sums to 0. */
  balance: number;
};

export type SettlementTransfer = {
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  amount: number;
};

export type SettlementResult = {
  balances: MemberBalance[];
  transfers: SettlementTransfer[];
  /** Total shared spend that took part in the settlement. */
  total: number;
  /** True when nobody owes anybody. */
  isSettled: boolean;
};

function toCents(amount: number | string): number {
  const value = typeof amount === "string" ? Number(amount) : amount;

  if (!Number.isFinite(value)) return 0;

  return Math.round(value * 100);
}

function fromCents(cents: number): number {
  return cents / 100;
}

/**
 * A shared record only becomes a debt when the money has actually left someone's
 * pocket. Anything that carries a due date is future money, so it is skipped
 * until it is marked paid — this keeps unpaid bills (including the ones created
 * from the quick-add sheet, which are stored as expenses with a due date) out of
 * the balance.
 */
export function isSettleableRecord(
  record: Pick<
    FinancialRecord,
    | "visibility"
    | "record_type"
    | "amount"
    | "archived_at"
    | "paid_at"
    | "due_at"
  >,
): boolean {
  if (record.archived_at) return false;
  if (record.visibility !== "HOUSEHOLD_SHARED") return false;
  if (record.record_type === "INCOME") return false;
  if (BILL_TYPES.has(record.record_type) && !record.paid_at) return false;
  if (record.due_at && !record.paid_at) return false;

  return toCents(record.amount) > 0;
}

/**
 * Splits `totalCents` across `count` members without losing a single cent.
 * The remainder is handed out one cent at a time, deterministically, so the
 * shares always add back up to the original total.
 */
export function splitEvenly(totalCents: number, count: number): number[] {
  if (count <= 0) return [];

  const base = Math.floor(totalCents / count);
  const remainder = totalCents - base * count;

  return Array.from({ length: count }, (_, index) =>
    index < remainder ? base + 1 : base,
  );
}

export function settleHousehold({
  records,
  members,
}: {
  records: Pick<
    FinancialRecord,
    | "visibility"
    | "record_type"
    | "amount"
    | "archived_at"
    | "paid_at"
    | "due_at"
    | "paid_by"
    | "owner_id"
  >[];
  members: SettlementMember[];
}): SettlementResult {
  // De-duplicate while keeping the incoming order, which keeps the remainder
  // distribution (and therefore the result) stable across renders.
  const seen = new Set<string>();
  const participants = members.filter((member) => {
    if (!member.id || seen.has(member.id)) return false;
    seen.add(member.id);
    return true;
  });

  if (participants.length === 0) {
    return { balances: [], transfers: [], total: 0, isSettled: true };
  }

  const paidCents = new Map<string, number>(
    participants.map((member) => [member.id, 0]),
  );

  let totalCents = 0;

  for (const record of records) {
    if (!isSettleableRecord(record)) continue;

    // The payer is whoever marked it paid; otherwise the owner of the record.
    const payerId = record.paid_by ?? record.owner_id;

    // A record paid by someone who is no longer in the household cannot be
    // settled against the current members, so it is left out on purpose.
    if (!payerId || !paidCents.has(payerId)) continue;

    const amountCents = toCents(record.amount);
    totalCents += amountCents;
    paidCents.set(payerId, (paidCents.get(payerId) ?? 0) + amountCents);
  }

  const shares = splitEvenly(totalCents, participants.length);

  const balances: MemberBalance[] = participants.map((member, index) => {
    const paid = paidCents.get(member.id) ?? 0;
    const share = shares[index] ?? 0;

    return {
      memberId: member.id,
      name: member.name,
      paid: fromCents(paid),
      share: fromCents(share),
      balance: fromCents(paid - share),
    };
  });

  const creditors = balances
    .filter((entry) => entry.balance > 0)
    .map((entry) => ({ ...entry, cents: Math.round(entry.balance * 100) }))
    .sort((a, b) => b.cents - a.cents);

  const debtors = balances
    .filter((entry) => entry.balance < 0)
    .map((entry) => ({ ...entry, cents: Math.round(-entry.balance * 100) }))
    .sort((a, b) => b.cents - a.cents);

  const transfers: SettlementTransfer[] = [];
  let creditorIndex = 0;
  let debtorIndex = 0;

  // Greedy matching: each debtor pays the largest outstanding creditor first,
  // which settles everyone in at most `participants - 1` transfers.
  while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
    const creditor = creditors[creditorIndex];
    const debtor = debtors[debtorIndex];
    const amountCents = Math.min(creditor.cents, debtor.cents);

    if (amountCents > 0) {
      transfers.push({
        fromId: debtor.memberId,
        fromName: debtor.name,
        toId: creditor.memberId,
        toName: creditor.name,
        amount: fromCents(amountCents),
      });
    }

    creditor.cents -= amountCents;
    debtor.cents -= amountCents;

    if (creditor.cents === 0) creditorIndex += 1;
    if (debtor.cents === 0) debtorIndex += 1;
  }

  return {
    balances,
    transfers,
    total: fromCents(totalCents),
    isSettled: transfers.length === 0,
  };
}
