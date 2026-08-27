import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
}

function formatPhone(phone: string): string {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, "");
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

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const formData = await req.formData();
      fromPhone = formData.get("sender")?.toString() || formData.get("from")?.toString() || "";
      messageBody = formData.get("message")?.toString() || formData.get("msg")?.toString() || "";
      
      const obj: any = {};
      for (const [key, value] of formData.entries()) {
        obj[key] = value;
      }
      rawPayload = obj;
    } else {
      const body = await req.json();
      fromPhone = body.sender || body.from || body.phone || "";
      messageBody = body.message || body.msg || body.text || "";
      rawPayload = body;
    }
    console.log("Inbound webhook parsed payload:", { fromPhone, messageBody, rawPayload });

    if (!fromPhone) {
      return new Response(JSON.stringify({ error: "Missing sender phone" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const formattedFrom = formatPhone(fromPhone)

    // Fetch active drip sequences
    const { data: activeDrips, error: dripErr } = await supabase
      .from('wa_client_drips')
      .select('*')
      .eq('status', 'active')

    if (dripErr) throw dripErr

    const matchingDrip = activeDrips?.find(d => formatPhone(d.phone) === formattedFrom)

    if (matchingDrip) {
      console.log(`Matching active drip found for client: ${matchingDrip.client_name}. Stopping drip...`)

      // 1. Update drip sequence status to stopped_replied
      await supabase
        .from('wa_client_drips')
        .update({ 
          status: 'stopped_replied', 
          stop_reason: `Balasan terdeteksi: "${messageBody.substring(0, 100)}"`,
          updated_at: new Date().toISOString()
        })
        .eq('id', matchingDrip.id)

      // 2. Update client status in CRM to WARM
      await supabase
        .from('clients')
        .update({ 
          status: 'WARM', 
          proses: 'WARM',
          lastActivityDesc: `WhatsApp dibalas: "${messageBody.substring(0, 100)}"`,
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
          text: `WhatsApp dibalas oleh ${matchingDrip.client_name} (CRM otomatis status WARM)`,
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

    return new Response(JSON.stringify({ success: true, stoppedDrip: !!matchingDrip }), {
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
