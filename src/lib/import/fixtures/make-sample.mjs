// Regenerates sample.xlsx, the Excel twin of sample.csv:
//   node src/lib/import/fixtures/make-sample.mjs
// (write-excel-file is a dev dependency used only here.)
import { writeFile } from "node:fs/promises";
import writeExcelFile from "write-excel-file/node";

const here = new URL(".", import.meta.url);
const date = (y, m, d) => ({ value: new Date(Date.UTC(y, m - 1, d)), type: Date, format: "yyyy-mm-dd" });

const data = [
  ["Date", "Description", "Amount"],
  [date(2026, 3, 14), "Tesco, Express", -12.5],
  [date(2026, 3, 15), 'The "Anchor" pub', -23],
  [date(2026, 3, 16), "Salary", 1500.75],
  ["2026-03-17", "Coffee", -3.2],
];

await writeFile(new URL("sample.xlsx", here), await writeExcelFile(data).toBuffer());
