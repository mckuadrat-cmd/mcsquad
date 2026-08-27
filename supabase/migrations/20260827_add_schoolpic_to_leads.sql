-- Migration: Add schoolPic column to leads table
ALTER TABLE IF EXISTS leads ADD COLUMN IF NOT EXISTS "schoolPic" TEXT;
