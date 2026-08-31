import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

function formatPhone(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.split('@')[0].replace(/\D/g, "");
  if (cleaned.startsWith("0")) {
    cleaned = "62" + cleaned.substring(1);
  } else if (cleaned.startsWith("8")) {
    cleaned = "62" + cleaned;
  }
  return cleaned;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    let fromPhone = "";
    let messageBody = "";
    let rawPayload: any = {};

    if (req.method === 'GET') {
      const url = new URL(req.url);
      fromPhone = url.searchParams.get("sender") || url.searchParams.get("from") || url.searchParams.get("phone") || url.searchParams.get("target") || url.searchParams.get("wa_number") || "";
      messageBody = url.searchParams.get("message") || url.searchParams.get("msg") || url.searchParams.get("text") || url.searchParams.get("body") || "";
      rawPayload = Object.fromEntries(url.searchParams.entries());
    } else {
      const rawText = await req.text();
      if (rawText) {
        try {
          // 1. Try parsing JSON
          const body = JSON.parse(rawText);
          fromPhone = body.sender || body.from || body.phone || body.target || body.wa_number || body.data?.sender || body.data?.from || "";
          messageBody = body.message || body.msg || body.text || body.body || body.data?.message || "";
          rawPayload = body;
        } catch {
          // 2. Try parsing URLSearchParams (form-urlencoded)
          try {
            const params = new URLSearchParams(rawText);
            fromPhone = params.get("sender") || params.get("from") || params.get("phone") || params.get("target") || "";
            messageBody = params.get("message") || params.get("msg") || params.get("text") || "";
            const obj: any = {};
            params.forEach((v, k) => { obj[k] = v; });
            rawPayload = obj;
          } catch {
            rawPayload = { raw: rawText };
          }
        }
      }
    }

    console.log("Inbound webhook parsed payload:", { fromPhone, messageBody, rawPayload });

    // Always log every incoming request to wa_inbound_logs for audit & debugging
    try {
      await supabase
        .from('wa_inbound_logs')
        .insert({
          from_phone: fromPhone || 'unknown',
          message_body: messageBody || '',
          raw_payload: rawPayload,
          processed_at: new Date().toISOString()
        });
    } catch (logErr) {
      console.error("Failed to write wa_inbound_logs:", logErr);
    }

    if (!fromPhone) {
      return new Response(JSON.stringify({ error: "Missing sender phone", receivedPayload: rawPayload }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const formattedFrom = formatPhone(fromPhone)

    // Fetch active/paused drip sequences
    const { data: activeDrips, error: dripErr } = await supabase
      .from('wa_client_drips')
      .select('*')
      .in('status', ['active', 'ACTIVE', 'paused', 'PAUSED'])

    if (dripErr) console.error("Error fetching active drips:", dripErr);

    let matchingDrip = activeDrips?.find(d => {
      const p1 = formatPhone(d.phone);
      const p2 = formattedFrom;
      if (!p1 || !p2) return false;
      if (p1 === p2) return true;
      const s1 = p1.length >= 7 ? p1.slice(-8) : p1;
      const s2 = p2.length >= 7 ? p2.slice(-8) : p2;
      return s1 === s2;
    })

    // If not found in wa_client_drips directly, fallback to search clients table by phone
    if (!matchingDrip && formattedFrom.length >= 7) {
      const { data: matchingClients } = await supabase
        .from('clients')
        .select('id, nama, whatsapp');
      
      const foundClient = matchingClients?.find(c => {
        const p1 = formatPhone(c.whatsapp || "");
        const p2 = formattedFrom;
        if (!p1 || !p2) return false;
        return p1 === p2 || (p1.length >= 7 && p2.length >= 7 && p1.slice(-8) === p2.slice(-8));
      });

      if (foundClient) {
        const { data: clientDripsForUser } = await supabase
          .from('wa_client_drips')
          .select('*')
          .eq('client_id', foundClient.id)
          .in('status', ['active', 'ACTIVE', 'paused', 'PAUSED'])
          .limit(1);

        if (clientDripsForUser && clientDripsForUser.length > 0) {
          matchingDrip = clientDripsForUser[0];
        }
      }
    }

    if (matchingDrip) {
      console.log(`Matching active drip found for client: ${matchingDrip.client_name}. Stopping drip...`)

      // 1. Update drip sequence status to stopped_replied
      await supabase
        .from('wa_client_drips')
        .update({ 
          status: 'stopped_replied', 
          stop_reason: 'Ada Balasan',
          updated_at: new Date().toISOString()
        })
        .eq('id', matchingDrip.id)

      // 2. Update client status in CRM to WARM
      await supabase
        .from('clients')
        .update({ 
          status: 'WARM', 
          proses: 'WARM',
          lastActivityDesc: 'Feedback Proses Sapa',
          lastActivityAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .eq('id', matchingDrip.client_id)

      // 3. Log to daily_activities
      await supabase
        .from('daily_activities')
        .insert({
          userId: 'system',
          userName: 'System (WhatsApp Webhook)',
          date: new Date().toISOString().split('T')[0],
          text: `Feedback Proses Sapa dari ${matchingDrip.client_name}`,
          extraInfo: messageBody,
          type: 'auto',
          refId: matchingDrip.client_id,
          refType: 'Client',
          category: 'WhatsApp',
          isDone: true,
          createdAt: new Date().toISOString()
        })

      console.log(`Client status updated to WARM and logged to daily_activities for client: ${matchingDrip.client_id}`)
    }

    // Log the inbound message in DB
    await supabase
      .from('wa_inbound_logs')
      .insert({
        from_phone: fromPhone,
        message_body: messageBody,
        raw_payload: rawPayload,
        processed_at: new Date().toISOString()
      })

    return new Response(JSON.stringify({ success: true, stoppedDrip: !!matchingDrip, matchedClient: matchingDrip?.client_name || null }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err: any) {
    console.error("Webhook processing error:", err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
