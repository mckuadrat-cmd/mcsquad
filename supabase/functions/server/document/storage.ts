/**
 * Storage service helper for private buckets:
 * - document-templates
 * - generated-documents
 */

export const BUCKET_TEMPLATES = "document-templates";
export const BUCKET_GENERATED = "generated-documents";

export async function uploadFileToStorage(
  supabase: any,
  bucket: string,
  filePath: string,
  fileData: Uint8Array | ArrayBuffer | Blob,
  contentType: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .upload(filePath, fileData, {
      contentType,
      upsert: true
    });

  if (error) {
    throw new Error(`Storage upload error [${bucket}/${filePath}]: ${error.message}`);
  }

  return data.path;
}

export async function downloadFileFromStorage(
  supabase: any,
  bucket: string,
  filePath: string
): Promise<Uint8Array> {
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(filePath);

  if (error || !data) {
    throw new Error(`Storage download error [${bucket}/${filePath}]: ${error?.message || 'File null'}`);
  }

  const arrayBuf = await data.arrayBuffer();
  return new Uint8Array(arrayBuf);
}

export async function getSignedFileUrl(
  supabase: any,
  bucket: string,
  filePath: string,
  expiresInSeconds: number = 3600,
  downloadName?: string,
  disposition: 'inline' | 'attachment' = 'inline'
): Promise<string> {
  const options: Record<string, any> = {};
  if (disposition === 'attachment' && downloadName) {
    options.download = downloadName;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, expiresInSeconds, options);

  if (error || !data?.signedUrl) {
    throw new Error(`Signed URL error [${bucket}/${filePath}]: ${error?.message || 'Url null'}`);
  }

  return data.signedUrl;
}
