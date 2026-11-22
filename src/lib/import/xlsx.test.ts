import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ImportFileError, MAX_FILE_BYTES, parseCsv } from "./csv";
import { readImportFile } from "./readFile";
import { parseXlsx } from "./xlsx";

const fixture = (name: string) => readFileSync(join(process.cwd(), "src/lib/import/fixtures", name));
const toArrayBuffer = (b: Buffer) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;

describe("parseXlsx", () => {
  it("reads the first sheet to the same rows as its CSV twin (date cell, negative amount, quoted comma and quotes)", async () => {
    const rows = await parseXlsx(toArrayBuffer(fixture("sample.xlsx")));
    expect(rows).toEqual(parseCsv(fixture("sample.csv").toString("utf8")));
    expect(rows[1]).toEqual(["2026-03-14", "Tesco, Express", "-12.5"]);
  });

  it("gives a clear error for a file that isn't a workbook", async () => {
    await expect(parseXlsx(new TextEncoder().encode("Date,Amount\n1,2").buffer as ArrayBuffer)).rejects.toThrow(ImportFileError);
    await expect(parseXlsx(new ArrayBuffer(0))).rejects.toThrow(ImportFileError);
  });

  it("says so for a password-protected workbook (an OLE container, not a zip)", async () => {
    const ole = new Uint8Array(512);
    ole.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    await expect(parseXlsx(ole.buffer)).rejects.toThrow(/password|\.xls/i);
  });
});

describe("readImportFile", () => {
  it("reads .xlsx files by extension and refuses one over 2 MB before reading it", async () => {
    const file = new File([fixture("sample.xlsx")], "bank.XLSX");
    expect(await readImportFile(file)).toEqual(parseCsv(fixture("sample.csv").toString("utf8")));
    const big = new File([new Uint8Array(MAX_FILE_BYTES + 1)], "big.xlsx");
    await expect(readImportFile(big)).rejects.toThrow(/over 2 MB/);
  });

  it("says which types it reads", async () => {
    await expect(readImportFile(new File(["x"], "old.xls"))).rejects.toThrow(/\.csv or \.xlsx/);
  });
});
