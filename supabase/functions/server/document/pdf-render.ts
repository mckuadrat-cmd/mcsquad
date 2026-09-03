/**
 * PDF Render Service Helper
 * Converts generated DOCX buffer to PDF Uint8Array.
 * Support LibreOffice headless execution or external PDF render microservice endpoint.
 */

export interface PdfConversionResult {
  success: boolean;
  pdfBuffer?: Uint8Array;
  error?: string;
}

export async function convertDocxToPdf(
  docxBuffer: Uint8Array,
  filename: string = "document.docx"
): Promise<PdfConversionResult> {
  const externalServiceUrl = Deno.env.get("PDF_RENDER_SERVICE_URL");

  // 1. Try External PDF Conversion Service if configured
  if (externalServiceUrl) {
    try {
      const formData = new FormData();
      const docxBlob = new Blob([docxBuffer], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
      // Support both Gotenberg ('files') and generic microservices ('file')
      formData.append("files", docxBlob, filename);
      formData.append("file", docxBlob, filename);

      const res = await fetch(externalServiceUrl, {
        method: "POST",
        body: formData
      });

      if (res.ok) {
        const arrayBuf = await res.arrayBuffer();
        return {
          success: true,
          pdfBuffer: new Uint8Array(arrayBuf)
        };
      } else {
        const errText = await res.text();
        console.error(`[pdf-render] External service returned HTTP ${res.status}: ${errText}`);
        return {
          success: false,
          error: `PDF conversion HTTP ${res.status}: ${errText}`
        };
      }
    } catch (err: any) {
      console.error("[pdf-render] External PDF conversion network error:", err.message);
      return {
        success: false,
        error: `Gagal terhubung ke PDF_RENDER_SERVICE_URL (${externalServiceUrl}): ${err.message}`
      };
    }
  }

  // 2. Try Local LibreOffice Command execution if Deno command permission allows
  try {
    const sofficeExecutable = Deno.env.get("LIBREOFFICE_PATH") || "soffice";
    const tempDir = await Deno.makeTempDir();
    const inputPath = `${tempDir}/${filename}`;
    const pdfFilename = filename.replace(/\.docx$/i, ".pdf");
    const outputPath = `${tempDir}/${pdfFilename}`;

    await Deno.writeFile(inputPath, docxBuffer);

    const command = new Deno.Command(sofficeExecutable, {
      args: [
        "--headless",
        "--convert-to",
        "pdf",
        "--outdir",
        tempDir,
        inputPath
      ],
      stdout: "piped",
      stderr: "piped"
    });

    const process = await command.output();

    if (process.success) {
      const pdfBytes = await Deno.readFile(outputPath);
      // Clean up temp dir
      try { await Deno.remove(tempDir, { recursive: true }); } catch {}
      return {
        success: true,
        pdfBuffer: pdfBytes
      };
    } else {
      const errStr = new TextDecoder().decode(process.stderr);
      try { await Deno.remove(tempDir, { recursive: true }); } catch {}
      return {
        success: false,
        error: `LibreOffice failed: ${errStr || 'Non-zero exit code'}`
      };
    }
  } catch (cmdErr: any) {
    return {
      success: false,
      error: `Konversi PDF cloud memerlukan konfigurasi PDF_RENDER_SERVICE_URL pada Supabase Secrets.`
    };
  }
}
