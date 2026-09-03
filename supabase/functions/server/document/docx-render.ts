import PizZip from "https://esm.sh/pizzip@3.1.7";
import Docxtemplater from "https://esm.sh/docxtemplater@3.50.0";

/**
 * Scan binary DOCX buffer to extract all placeholder tags (e.g. {nomor}, {sekolah})
 */
export function scanPlaceholders(docxBuffer: Uint8Array | ArrayBuffer): string[] {
  try {
    const zip = new PizZip(docxBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true
    });
    
    // Internal document parsing to find tag keys
    const text = doc.getFullText();
    const regex = /\{([a-zA-Z0-9_]+)\}/g;
    const matches = new Set<string>();
    let match;
    while ((match = regex.exec(text)) !== null) {
      matches.add(match[1]);
    }
    return Array.from(matches);
  } catch (err: any) {
    console.error("Error scanning DOCX placeholders:", err.message);
    return [];
  }
}

/**
 * Fill placeholders inside DOCX template buffer and return generated DOCX Uint8Array
 */
export function fillDocxTemplate(
  docxBuffer: Uint8Array | ArrayBuffer,
  data: Record<string, any>
): Uint8Array {
  try {
    const zip = new PizZip(docxBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      nullGetter(element: any) {
        return "";
      }
    });

    // Render document by passing data snapshot
    doc.render(data);

    const generatedZip = doc.getZip().generate({
      type: "uint8array",
      compression: "DEFLATE"
    });

    return generatedZip;
  } catch (err: any) {
    console.error("Docxtemplater error:", err);
    throw new Error(`Gagal mengisi template DOCX: ${err.message}`);
  }
}
