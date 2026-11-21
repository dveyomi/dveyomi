import { ImportFileError, readCsvFile, type FileReader } from "./csv";

/**
 * The file types the import wizard reads, by extension. Each reader turns a
 * File into rows of text fields; the wizard maps rows the same way whatever
 * the file was. Another format (e.g. Excel) adds a reader here and to
 * IMPORT_ACCEPT.
 */
const READERS: Record<string, FileReader> = { csv: readCsvFile };

/** The file picker's accept attribute. */
export const IMPORT_ACCEPT = ".csv,text/csv";

/** Reads a chosen file with the reader for its extension. Throws ImportFileError for a type it can't read. */
export async function readImportFile(file: File): Promise<string[][]> {
  const extension = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  const read = READERS[extension];
  if (!read) throw new ImportFileError("Choose a .csv file exported from your bank.");
  return read(file);
}
