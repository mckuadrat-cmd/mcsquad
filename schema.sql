-- Migration: WhatsApp Broadcast & Cold Outreach Drip Sequence ("Proses Sapa")
-- MCKUADRAT CRM (Compatible with RLS Enabled)

-- =========================================================================
-- PATCH EXISTING TABLES & RENAME TO INDONESIAN
-- =========================================================================
ALTER TABLE IF EXISTS clients RENAME COLUMN "salutation" TO "sapaan";
ALTER TABLE IF EXISTS clients RENAME COLUMN "name" TO "nama";
ALTER TABLE IF EXISTS clients RENAME COLUMN "nickname" TO "panggilan";
ALTER TABLE IF EXISTS clients RENAME COLUMN "school" TO "sekolah";
ALTER TABLE IF EXISTS clients RENAME COLUMN "schoolAddress" TO "alamat";
ALTER TABLE IF EXISTS clients RENAME COLUMN "position" TO "posisi";
ALTER TABLE IF EXISTS clients RENAME COLUMN "phone" TO "whatsapp";

ALTER TABLE IF EXISTS clients ADD COLUMN IF NOT EXISTS "proses" TEXT DEFAULT 'SUSPECT';
ALTER TABLE IF EXISTS clients ADD COLUMN IF NOT EXISTS "updatedBy" TEXT;
ALTER TABLE IF EXISTS clients ADD COLUMN IF NOT EXISTS "ao" TEXT;

-- 1. Table for WhatsApp Gateway Settings
CREATE TABLE IF NOT EXISTS wa_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    provider_type TEXT NOT NULL DEFAULT 'third_party', -- Only 'third_party' gateway
    phone_number_id TEXT DEFAULT '',
    waba_access_token TEXT DEFAULT '',
    third_party_name TEXT DEFAULT 'Fonnte', -- 'Fonnte', 'Wablas', 'Whacenter', 'Starsender', 'Custom'
    third_party_api_key TEXT DEFAULT '',
    third_party_endpoint TEXT DEFAULT 'https://api.fonnte.com/send',
    webhook_verify_token TEXT DEFAULT '',
    default_salutation TEXT DEFAULT 'Bapak/Ibu',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert/Update default settings row to third_party
INSERT INTO wa_settings (id, provider_type, third_party_name)
VALUES ('default', 'third_party', 'Fonnte')
ON CONFLICT (id) DO UPDATE 
SET provider_type = 'third_party', updated_at = NOW();

-- 2. Table for WhatsApp Message Templates
CREATE TABLE IF NOT EXISTS wa_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT DEFAULT 'cold_outreach', -- 'cold_outreach', 'follow_up', 'general'
    content TEXT NOT NULL,
    variables JSONB DEFAULT '["name", "school", "salutation", "position"]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sample default templates for Proses Sapa
INSERT INTO wa_templates (id, name, category, content) VALUES
('a1000000-0000-0000-0000-000000000001', 'Sapaan Cold Client - Day 1', 'cold_outreach', 'Selamat pagi {{sapaan}} {{nama}} dari {{sekolah}}. Saya dari tim MCKUADRAT mau mengonfirmasi terkait program kegiatan sekolah. Apakah ada waktu luang untuk berdiskusi sebentar hari ini? Terima kasih.'),
('a1000000-0000-0000-0000-000000000002', 'Follow Up Cold Client - Day 3', 'cold_outreach', 'Halo {{sapaan}} {{nama}}, izin menyapa kembali terkait penawaran program kegiatan untuk {{sekolah}}. Kami ada promo penawaran khusus minggu ini. Apakah bisa kami kirimkan datanya via WhatsApp?'),
('a1000000-0000-0000-0000-000000000003', 'Follow Up Cold Client - Day 7', 'cold_outreach', 'Selamat siang {{sapaan}} {{nama}}, semoga sehat selalu. Menindaklanjuti pesan kami sebelumnya untuk {{sekolah}}, apakah agenda kegiatan sekolah bulan ini masih bisa kami bantu? Salam hangat dari tim MCKUADRAT.')
ON CONFLICT (id) DO NOTHING;

-- 3. Table for Broadcast Campaigns (kept for background logs of Proses Sapa)
CREATE TABLE IF NOT EXISTS wa_broadcasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    provider_type TEXT NOT NULL DEFAULT 'third_party',
    template_id UUID REFERENCES wa_templates(id) ON DELETE SET NULL,
    custom_content TEXT,
    filter_criteria JSONB DEFAULT '{}'::jsonb,
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'scheduled', 'processing', 'completed', 'cancelled'
    total_recipients INT DEFAULT 0,
    sent_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Table for Broadcast Dispatch Queue Items (Recipients Detail/Logs)
CREATE TABLE IF NOT EXISTS wa_broadcast_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    broadcast_id UUID REFERENCES wa_broadcasts(id) ON DELETE CASCADE,
    client_id TEXT,
    client_name TEXT NOT NULL,
    school_name TEXT,
    phone TEXT NOT NULL,
    rendered_message TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'scheduled', 'sent', 'delivered', 'failed'
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Table for Cold Outreach Drip Sequence Configurations
CREATE TABLE IF NOT EXISTS wa_drip_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default sequence
INSERT INTO wa_drip_sequences (id, name, description) VALUES
('d1a93e32-2415-46b7-84d4-28b9fb6c0850', 'Proses Sapa Client Cold (Standard)', 'Drip sequence otomatis 3 tahap untuk mendatangi client berkategori cold hingga ada balasan.')
ON CONFLICT (id) DO NOTHING;

-- 6. Table for Drip Sequence Steps
CREATE TABLE IF NOT EXISTS wa_drip_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    drip_sequence_id UUID REFERENCES wa_drip_sequences(id) ON DELETE CASCADE,
    step_number INT NOT NULL,
    delay_days INT NOT NULL DEFAULT 1,
    template_id UUID REFERENCES wa_templates(id) ON DELETE SET NULL,
    custom_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(drip_sequence_id, step_number)
);

-- Insert Default Steps for Proses Sapa
INSERT INTO wa_drip_steps (drip_sequence_id, step_number, delay_days, template_id) VALUES
('d1a93e32-2415-46b7-84d4-28b9fb6c0850', 1, 1, 'a1000000-0000-0000-0000-000000000001'),
('d1a93e32-2415-46b7-84d4-28b9fb6c0850', 2, 3, 'a1000000-0000-0000-0000-000000000002'),
('d1a93e32-2415-46b7-84d4-28b9fb6c0850', 3, 7, 'a1000000-0000-0000-0000-000000000003')
ON CONFLICT (drip_sequence_id, step_number) DO NOTHING;

-- 7. Table for Tracking Active Client Drips ("Proses Sapa")
CREATE TABLE IF NOT EXISTS wa_client_drips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id TEXT NOT NULL,
    client_name TEXT NOT NULL,
    school_name TEXT,
    phone TEXT NOT NULL,
    drip_sequence_id UUID REFERENCES wa_drip_sequences(id) ON DELETE CASCADE,
    current_step_number INT DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active', -- 'active', 'paused', 'stopped_replied', 'completed'
    last_sent_at TIMESTAMPTZ,
    next_scheduled_at TIMESTAMPTZ DEFAULT NOW(),
    stop_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Table for Inbound Message Logs (for Webhook Auto-stop)
CREATE TABLE IF NOT EXISTS wa_inbound_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_phone TEXT NOT NULL,
    message_body TEXT,
    raw_payload JSONB,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =========================================================================
ALTER TABLE wa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_broadcast_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_drip_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_drip_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_client_drips ENABLE ROW LEVEL SECURITY;
ALTER TABLE wa_inbound_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow full access to authenticated users" ON wa_settings;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON wa_templates;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON wa_broadcasts;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON wa_broadcast_items;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON wa_drip_sequences;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON wa_drip_steps;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON wa_client_drips;
DROP POLICY IF EXISTS "Allow full access to authenticated users" ON wa_inbound_logs;

CREATE POLICY "Allow full access to authenticated users" ON wa_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to authenticated users" ON wa_templates FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to authenticated users" ON wa_broadcasts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to authenticated users" ON wa_broadcast_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to authenticated users" ON wa_drip_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to authenticated users" ON wa_drip_steps FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to authenticated users" ON wa_client_drips FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to authenticated users" ON wa_inbound_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
