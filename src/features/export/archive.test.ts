import { describe, expect, it } from "vitest";

import {
  buildArchive,
  csvEscape,
  exportFileName,
  LEDGER_CSV_COLUMNS,
  toCsv,
  UTF8_BOM,
} from "./archive";

describe("csvEscape", () => {
  it("leaves an ordinary value alone", () => {
    expect(csvEscape("نان")).toBe("نان");
    expect(csvEscape(2500)).toBe("2500");
  });

  it("quotes a value containing an ASCII comma so columns do not shift", () => {
    expect(csvEscape("نان, شیر")).toBe('"نان, شیر"');
  });

  it("leaves the Persian comma alone — it is punctuation, not a separator", () => {
    expect(csvEscape("نان، شیر")).toBe("نان، شیر");
  });

  it("doubles inner quotes — the rule every hand-rolled exporter forgets", () => {
    expect(csvEscape('گفت "تمام شد"')).toBe('"گفت ""تمام شد"""');
  });

  it("quotes newlines, which would otherwise split one record into two rows", () => {
    expect(csvEscape("خط اول\nخط دوم")).toBe('"خط اول\nخط دوم"');
  });

  it("writes an empty field for null and undefined instead of the word null", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });
});

describe("toCsv", () => {
  it("starts with a BOM so Excel shows Persian instead of mojibake", () => {
    const csv = toCsv({ columns: LEDGER_CSV_COLUMNS, rows: [] });

    expect(csv.startsWith(UTF8_BOM)).toBe(true);
  });

  it("can omit the BOM for tools that choke on it", () => {
    const csv = toCsv({ columns: LEDGER_CSV_COLUMNS, rows: [], bom: false });

    expect(csv.startsWith(UTF8_BOM)).toBe(false);
  });

  it("uses CRLF and a trailing newline", () => {
    const csv = toCsv({
      columns: LEDGER_CSV_COLUMNS,
      rows: [
        {
          record_type: "EXPENSE",
          title: "نان",
          amount: 2500,
          currency: "IRR",
          category: null,
          note: null,
          occurred_at: "2026-03-20T10:00:00.000Z",
          due_at: null,
          paid_at: null,
        },
      ],
    });

    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv).toContain(
      "\r\nEXPENSE,نان,2500,IRR,,,2026-03-20T10:00:00.000Z,,\r\n",
    );
  });
});

describe("buildArchive", () => {
  it("lists every table with its row count, including empty ones", () => {
    const archive = buildArchive({
      tables: [
        { name: "tasks", rows: [{ id: "1" }, { id: "2" }] },
        { name: "events", rows: [] },
      ],
      now: new Date("2026-03-20T10:00:00.000Z"),
    });

    expect(archive.counts).toEqual({ tasks: 2, events: 0 });
    expect(archive.tables.tasks).toHaveLength(2);
    expect(archive.exported_at).toBe("2026-03-20T10:00:00.000Z");
  });
});

describe("exportFileName", () => {
  it("is ASCII and dated, so no server has to encode the header", () => {
    const name = exportFileName({
      extension: "csv",
      now: new Date("2026-03-20T23:00:00.000Z"),
    });

    expect(name).toBe("khoonemoon-2026-03-20.csv");
    expect(/^[\x20-\x7E]+$/.test(name)).toBe(true);
  });
});
