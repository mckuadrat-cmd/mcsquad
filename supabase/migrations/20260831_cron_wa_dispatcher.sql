-- =========================================================================
-- Migration: Automated WhatsApp Drip Dispatcher Cron Job ("Proses Sapa")
-- MCKUADRAT CRM
-- =========================================================================

-- Enable required Postgres extensions for background cron scheduling
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule existing cron job if present to avoid duplication
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'wa-sapa-dispatcher-job') THEN
        PERFORM cron.unschedule('wa-sapa-dispatcher-job');
    END IF;
EXCEPTION
    WHEN OTHERS THEN NULL;
END $$;

-- Schedule wa-dispatcher Edge Function to run automatically every 15 minutes
SELECT cron.schedule(
    'wa-sapa-dispatcher-job',
    '*/15 * * * *',
    $$
    SELECT net.http_post(
        url := 'https://' || current_setting('request.headers', true)::json->>'host' || '/functions/v1/wa-dispatcher',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('request.headers', true)::json->>'authorization'
        ),
        body := '{}'::jsonb
    );
    $$
);
