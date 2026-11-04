import { afterEach, describe, expect, it, vi } from "vitest";
import {
  importPendingTransferCode,
  listPendingTransferCodes,
  pendingCreate,
  pendingRequest,
} from "./pending-create";
const user = "00000000-0000-4000-8000-00000000000a";
function store(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    key: (n) => [...m.keys()][n] ?? null,
    getItem: (key) => m.get(key) ?? null,
    setItem: (key, value) => {
      m.set(key, value);
    },
    removeItem: (key) => {
      m.delete(key);
    },
  };
}
function useStorage(storage: Storage) {
  vi.stubGlobal("window", { localStorage: storage });
}
afterEach(() => vi.unstubAllGlobals());
describe("explicit cross-device recovery", () => {
  it("moves the same operation identity without sending or storing form values", async () => {
    const first = store(),
      second = store();
    useStorage(first);
    let id = "";
    const input = { title: "private fixture title" };
    await expect(
      pendingRequest({
        user,
        kind: "task",
        input,
        submit: async (op) => {
          id = op;
          return { data: null, error: "lost" };
        },
        valid: (v): v is string => typeof v === "string",
      }),
    ).rejects.toThrow();
    const [token] = listPendingTransferCodes(user);
    expect(token.kind).toBe("task");
    expect(
      [...Array(first.length)]
        .map((_, n) => first.getItem(first.key(n)!))
        .join(" "),
    ).not.toContain(input.title);
    useStorage(second);
    await importPendingTransferCode(user, token.code);
    let retried = "";
    const result = await pendingRequest({
      user,
      kind: "task",
      input,
      submit: async (op) => {
        retried = op;
        return { data: "ok", error: null };
      },
      valid: (v): v is string => typeof v === "string",
    });
    expect(result).toBe("ok");
    expect(retried).toBe(id);
    expect(listPendingTransferCodes(user)).toHaveLength(0);
  });
  it("refuses another account and refuses to overwrite an unrelated pending identity", async () => {
    const a = store(),
      b = store();
    const opts = {
      user,
      kind: "finance",
      input: { amount: 100 },
      submit: async () => ({ data: null, error: "lost" }),
      find: async () => ({ data: null, error: "lost" }),
    };
    useStorage(a);
    await expect(pendingCreate(opts)).rejects.toThrow();
    const token = listPendingTransferCodes(user)[0].code;
    useStorage(b);
    await expect(
      importPendingTransferCode("00000000-0000-4000-8000-00000000000b", token),
    ).rejects.toThrow();
    await expect(pendingCreate(opts)).rejects.toThrow();
    await expect(importPendingTransferCode(user, token)).rejects.toThrow(
      "جایگزین نشد",
    );
  });
  it("rejects malformed or forged-format codes", async () => {
    useStorage(store());
    await expect(
      importPendingTransferCode(user, "KHM1.invalid"),
    ).rejects.toThrow();
    await expect(
      importPendingTransferCode(user, "not a code"),
    ).rejects.toThrow();
  });
});
