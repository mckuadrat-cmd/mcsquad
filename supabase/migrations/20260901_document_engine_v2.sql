-- Migration: Document Engine v2 (.DOCX First Architecture)
-- MCKUADRAT CRM - Clean Direct Master Template (No Versioning Overhead)

-- 1. Drop old tables if exist to avoid schema cache conflict
DROP TABLE IF EXISTS document_template_versions CASCADE;
DROP TABLE IF EXISTS document_templates CASCADE;

-- 2. Table for Document Templates (Master)
CREATE TABLE document_templates (
    id TEXT PRIMARY KEY, -- 'SPH', 'SKK', 'INV', 'KUI'
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    file_path TEXT,
    original_filename TEXT,
    placeholder_manifest JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed standard document templates
INSERT INTO document_templates (id, code, name) VALUES
('SPH', 'SPH', 'Surat Penawaran Harga'),
('SKK', 'SKK', 'Surat Kerjasama dan Konfirmasi Penjadwalan'),
('INV', 'INV', 'Invoice'),
('KUI', 'KUI', 'Kuitansi')
ON CONFLICT (id) DO UPDATE SET
code = EXCLUDED.code,
name = EXCLUDED.name,
updated_at = NOW();

-- 3. Table for Monthly Sequence Counter (Atomic Numbering)
CREATE TABLE IF NOT EXISTS document_sequences (
    year INT NOT NULL,
    month INT NOT NULL,
    last_number INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (year, month)
);

-- 4. Clean Re-create Table generated_documents (Fresh 100% Clean)
DROP TABLE IF EXISTS generated_documents CASCADE;

CREATE TABLE generated_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,                  -- 'SPH', 'SKK', 'INV', 'KUI', 'MOU', 'GEN'
    doc_no TEXT NOT NULL,                -- e.g. '01/SPH/MCC/IX/2026'
    monthly_serial INT NOT NULL,         -- Monthly counter e.g. 1, 2, 3
    client_name TEXT NOT NULL,           -- Standard school / client name
    title TEXT NOT NULL,                 -- Program name or description
    date DATE NOT NULL,                  -- Document date
    status TEXT NOT NULL DEFAULT 'DRAFT',-- 'DRAFT', 'GENERATED', 'FINALIZED', 'SENT', 'VOID'
    data_snapshot JSONB DEFAULT '{}'::jsonb, -- Form inputs & calculated snapshot
    docx_path TEXT,                      -- Storage path to .docx file
    pdf_path TEXT,                       -- Storage path to .pdf file
    linked_lead_id TEXT,                 -- Related lead ID
    school_id TEXT,                      -- Related client / school ID
    extra_notes TEXT,                    -- Additional notes
    author_id TEXT,                      -- Staff / User ID who created document
    author_name TEXT,                    -- Staff / User Name who created document
    legacy BOOLEAN DEFAULT FALSE,
    finalized_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Atomic Document Numbering RPC Function
CREATE OR REPLACE FUNCTION reserve_document_number(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
    serial_number INT,
    year_num INT,
    month_num INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_year INT;
    v_month INT;
    v_next INT;
BEGIN
    v_year := EXTRACT(YEAR FROM p_date);
    v_month := EXTRACT(MONTH FROM p_date);
    
    INSERT INTO document_sequences (year, month, last_number, updated_at)
    VALUES (v_year, v_month, 1, NOW())
    ON CONFLICT (year, month) DO UPDATE
    SET last_number = document_sequences.last_number + 1,
        updated_at = NOW()
    RETURNING document_sequences.last_number INTO v_next;
    
    RETURN QUERY SELECT v_next, v_year, v_month;
END;
$$;

-- 6. Storage Private Buckets Setup
INSERT INTO storage.buckets (id, name, public)
VALUES ('document-templates', 'document-templates', false),
       ('generated-documents', 'generated-documents', false)
ON CONFLICT (id) DO NOTHING;

-- 7. RLS Policies
ALTER TABLE document_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to authenticated users" ON document_templates;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON document_sequences;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON generated_documents;

CREATE POLICY "Allow full access to authenticated users" ON document_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to authenticated users" ON document_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to authenticated users" ON generated_documents FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 8. Notify PostgREST to reload schema cache immediately
NOTIFY pgrst, 'reload schema';
