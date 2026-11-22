import { enGB, type Messages } from "@/i18n/messages";
import { ImportFileError, importLimitError, type FileReader } from "./csv";

/**
 * Excel (.xlsx) import: the first sheet as the same rows of text fields
 * parseCsv gives, so the wizard maps both the same way. Date cells come out
 * as YYYY-MM-DD, numbers as plain decimal strings (exactly as stored, no
 * floating-point rounding), and rows with every cell empty are dropped. The
 * reader library is loaded on first use, so no other page carries it.
 */


/** Encrypted workbooks and old .xls files are OLE containers, not zip files like .xlsx. */
const OLE_MAGIC = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

const two = (n: number) => String(n).padStart(2, "0");

/** One cell as the text a CSV would hold. Dates are the calendar date Excel shows (stored as UTC midnight). */
function cellText(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) {
    return Number.isNaN(cell.getTime()) ? "" : `${cell.getUTCFullYear()}-${two(cell.getUTCMonth() + 1)}-${two(cell.getUTCDate())}`;
  }
  if (typeof cell === "boolean") return cell ? "TRUE" : "FALSE";
  return String(cell);
}

/** The first sheet of an .xlsx file as rows of text fields. Throws ImportFileError when it can't be read. */
export async function parseXlsx(buffer: ArrayBuffer, m: Messages = enGB): Promise<string[][]> {
  const head = new Uint8Array(buffer, 0, Math.min(8, buffer.byteLength));
  if (head.length === OLE_MAGIC.length && OLE_MAGIC.every((b, i) => head[i] === b)) {
    throw new ImportFileError(m.importer.passwordProtected);
  }
  let data: unknown[][];
  try {
    const { readSheet } = await import("read-excel-file/universal");
    // A view rather than the buffer: the library checks ArrayBuffer by instanceof, which fails across realms.
    // parseNumber keeps numbers as the digits stored in the file.
    data = (await readSheet(new Uint8Array(buffer), { parseNumber: (s: string) => s })) as unknown[][];
  } catch {
    throw new ImportFileError(m.importer.notWorkbook);
  }
  return data.map((row) => row.map(cellText)).filter((row) => row.some((c) => c.trim() !== ""));
}

/** Reads an .xlsx File into rows. Throws ImportFileError for a file over 2 MB, before reading it. */
export const readXlsxFile: FileReader = async (file, m = enGB) => {
  const tooBig = importLimitError({ bytes: file.size }, m);
  if (tooBig) throw new ImportFileError(tooBig);
  return parseXlsx(await file.arrayBuffer(), m);
};
