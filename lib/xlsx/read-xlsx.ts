// ---------------------------------------------------------------------------
// Minimal, dependency-free XLSX *reader* — the counterpart to xlsx.ts (writer).
// An .xlsx is a ZIP of XML parts; entries are DEFLATE-compressed, so we unzip
// using the browser's native DecompressionStream('deflate-raw') and parse the
// chosen worksheet (resolving shared strings) into a plain string grid.
//
// Client-only: relies on DecompressionStream + DOMParser. Call from a user
// action ("use client"), never during SSR.
// ---------------------------------------------------------------------------

const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("This browser can’t read .xlsx — save the file as CSV and upload that instead.");
  }
  const ds = new DecompressionStream("deflate-raw");
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(ds);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

/** Unzip an archive into a map of entry name → decompressed bytes. */
async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const td = new TextDecoder();

  // Locate the End Of Central Directory record (scan back from the end).
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("This doesn’t look like a valid .xlsx file.");

  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true); // start of central directory
  const out = new Map<string, Uint8Array>();

  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const localOff = dv.getUint32(p + 42, true);
    const name = td.decode(bytes.subarray(p + 46, p + 46 + nameLen));

    // The local header repeats name/extra lengths; data follows them.
    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const dataStart = localOff + 30 + lNameLen + lExtraLen;
    const comp = bytes.subarray(dataStart, dataStart + compSize);

    let data: Uint8Array;
    if (method === 0) data = comp; // stored
    else if (method === 8) data = await inflateRaw(comp); // deflate
    else throw new Error(`Unsupported compression (method ${method}) in .xlsx.`);

    out.set(name, data);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return out;
}

/** "AB12" → zero-based column index (12 → ignore the digits). */
function colOf(ref: string): number {
  let n = 0;
  for (let i = 0; i < ref.length; i++) {
    const ch = ref.charCodeAt(i);
    if (ch >= 65 && ch <= 90) n = n * 26 + (ch - 64);
    else if (ch >= 97 && ch <= 122) n = n * 26 + (ch - 96);
    else break;
  }
  return n - 1;
}

const localTags = (el: Element | Document, tag: string) =>
  Array.from(el.getElementsByTagNameNS("*", tag));
const text = (el: Element) => el.textContent ?? "";

/**
 * Read one worksheet of an .xlsx into a string grid (fully-empty rows dropped,
 * matching the CSV parser). Picks the sheet named `preferSheet` (case-insensitive)
 * if present, otherwise the first sheet.
 */
export async function readXlsxGrid(bytes: Uint8Array, preferSheet?: string): Promise<string[][]> {
  const files = await unzip(bytes);
  const dec = (name: string) => {
    const b = files.get(name);
    return b ? new TextDecoder().decode(b) : undefined;
  };

  const wbXml = dec("xl/workbook.xml");
  if (!wbXml) throw new Error("Not a workbook (missing xl/workbook.xml).");
  const parser = new DOMParser();

  // Map sheet name → relationship id, then rel id → target path.
  const wb = parser.parseFromString(wbXml, "application/xml");
  const sheets = localTags(wb, "sheet").map((s) => ({
    name: s.getAttribute("name") ?? "",
    rid: s.getAttributeNS(REL_NS, "id") ?? s.getAttribute("r:id") ?? "",
  }));
  if (sheets.length === 0) throw new Error("The workbook has no sheets.");

  const relXml = dec("xl/_rels/workbook.xml.rels") ?? "";
  const rels = parser.parseFromString(relXml, "application/xml");
  const relMap = new Map(
    localTags(rels, "Relationship").map((r) => [r.getAttribute("Id") ?? "", r.getAttribute("Target") ?? ""]),
  );

  const chosen =
    (preferSheet && sheets.find((s) => s.name.toLowerCase() === preferSheet.toLowerCase())) || sheets[0];
  const target = (relMap.get(chosen.rid) ?? "worksheets/sheet1.xml").replace(/^\//, "");
  const path = target.startsWith("xl/") ? target : `xl/${target}`;
  const sheetXml = dec(path);
  if (!sheetXml) throw new Error(`Worksheet "${chosen.name}" could not be read.`);

  // Shared strings (each <si> may hold several <t> runs to concatenate).
  const shared: string[] = [];
  const ssXml = dec("xl/sharedStrings.xml");
  if (ssXml) {
    const ss = parser.parseFromString(ssXml, "application/xml");
    for (const si of localTags(ss, "si")) shared.push(localTags(si, "t").map(text).join(""));
  }

  const ws = parser.parseFromString(sheetXml, "application/xml");
  const grid: string[][] = [];
  for (const rowEl of localTags(ws, "row")) {
    const arr: string[] = [];
    let maxCol = -1;
    for (const cEl of localTags(rowEl, "c")) {
      const col = colOf(cEl.getAttribute("r") ?? "");
      if (col < 0) continue;
      const t = cEl.getAttribute("t");
      let val = "";
      if (t === "inlineStr") {
        val = localTags(cEl, "t").map(text).join("");
      } else {
        const v = localTags(cEl, "v")[0];
        const raw = v ? text(v) : "";
        if (t === "s") val = shared[Number(raw)] ?? "";
        else if (t === "b") val = raw === "1" ? "TRUE" : "FALSE";
        else val = raw;
      }
      arr[col] = val;
      if (col > maxCol) maxCol = col;
    }
    const dense: string[] = [];
    for (let i = 0; i <= maxCol; i++) dense.push(arr[i] ?? "");
    grid.push(dense);
  }

  return grid.filter((r) => r.some((cell) => (cell ?? "").trim() !== ""));
}
