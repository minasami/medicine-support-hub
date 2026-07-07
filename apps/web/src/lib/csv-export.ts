type CsvValue = string | number | boolean | null | undefined | Date;

type CsvColumn<Row extends Record<string, CsvValue>> = {
  key: keyof Row;
  header: string;
};

function formatCsvValue(value: CsvValue) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function escapeCsvCell(value: CsvValue) {
  const text = formatCsvValue(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

function safeFilename(filename: string) {
  return filename
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "export.csv";
}

export function downloadCsv<Row extends Record<string, CsvValue>>(filename: string, columns: CsvColumn<Row>[], rows: Row[]) {
  const header = columns.map(column => escapeCsvCell(column.header)).join(",");
  const body = rows.map(row => columns.map(column => escapeCsvCell(row[column.key])).join(","));
  const csv = [header, ...body].join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeFilename(filename.endsWith(".csv") ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
