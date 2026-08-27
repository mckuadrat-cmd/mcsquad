-- Migration: Rename Client columns to Indonesian
-- MCKUADRAT CRM

ALTER TABLE IF EXISTS clients RENAME COLUMN "salutation" TO "sapaan";
ALTER TABLE IF EXISTS clients RENAME COLUMN "name" TO "nama";
ALTER TABLE IF EXISTS clients RENAME COLUMN "nickname" TO "panggilan";
ALTER TABLE IF EXISTS clients RENAME COLUMN "school" TO "sekolah";
ALTER TABLE IF EXISTS clients RENAME COLUMN "schoolAddress" TO "alamat";
ALTER TABLE IF EXISTS clients RENAME COLUMN "position" TO "posisi";
ALTER TABLE IF EXISTS clients RENAME COLUMN "phone" TO "whatsapp";
-- Note: "email" column remains the same.
