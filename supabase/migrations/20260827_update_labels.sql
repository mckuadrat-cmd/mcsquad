UPDATE wa_client_drips SET stop_reason = 'Ada Balasan' WHERE status = 'stopped_replied';
UPDATE clients SET "lastActivityDesc" = 'Feedback Proses Sapa' WHERE "lastActivityDesc" ILIKE '%dibalas%' OR "lastActivityDesc" ILIKE '%Balasan%';
