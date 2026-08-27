-- Migration: Add AO column to clients table
ALTER TABLE IF EXISTS clients ADD COLUMN IF NOT EXISTS "ao" TEXT;
