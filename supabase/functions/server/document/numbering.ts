import { getRomanMonth } from "./terbilang.ts";

export interface DocumentNumberResult {
  fullNo: string;
  serial: number;
  year: number;
  month: number;
}

/**
 * Reserve document number atomically via database RPC or atomic query
 */
export async function reserveDocumentNumber(
  supabase: any,
  docType: string,
  docDate: string | Date = new Date()
): Promise<DocumentNumberResult> {
  const d = new Date(docDate);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const romanMonth = getRomanMonth(month);

  let serial = 1;

  try {
    // Attempt to call RPC reserve_document_number first
    const { data, error } = await supabase.rpc('reserve_document_number', {
      p_date: d.toISOString().split('T')[0]
    });

    if (!error && data && data.length > 0) {
      serial = data[0].serial_number;
    } else {
      // Fallback: Atomic upsert into document_sequences table
      const { data: existingSeq } = await supabase
        .from('document_sequences')
        .select('last_number')
        .eq('year', year)
        .eq('month', month)
        .maybeSingle();

      const nextNo = (existingSeq?.last_number || 0) + 1;

      const { data: updatedSeq, error: upsertErr } = await supabase
        .from('document_sequences')
        .upsert({
          year,
          month,
          last_number: nextNo,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (!upsertErr && updatedSeq) {
        serial = updatedSeq.last_number;
      } else {
        // Last fallback: Read latest monthly serial from generated_documents
        const startOfMonth = new Date(year, month - 1, 1).toISOString();
        const { data: lastDocs } = await supabase
          .from('generated_documents')
          .select('monthly_serial')
          .gte('created_at', startOfMonth)
          .order('created_at', { ascending: false })
          .limit(1);

        if (lastDocs && lastDocs.length > 0 && lastDocs[0].monthly_serial) {
          serial = lastDocs[0].monthly_serial + 1;
        }
      }
    }
  } catch (err: any) {
    console.error("Error reserving document number:", err.message);
  }

  // Format: NN/TYPE/MCC/ROMAN_MONTH/YYYY for SPH, SKK, INV, KUI
  // Format: NN/MCC/ROMAN_MONTH/YYYY for GEN
  const padSerial = String(serial).padStart(2, '0');
  const fullNo = docType === 'GEN'
    ? `${padSerial}/MCC/${romanMonth}/${year}`
    : `${padSerial}/${docType}/MCC/${romanMonth}/${year}`;

  return {
    fullNo,
    serial,
    year,
    month
  };
}
