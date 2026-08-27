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

function renderTemplate(templateStr: string, client: any, defaultSalutation: string): string {
  if (!templateStr) return "";
  const salutation = client.sapaan || client.salutation || defaultSalutation || "Bapak/Ibu";
  const name = client.nama || client.name || client.panggilan || client.nickname || "Bapak/Ibu";
  const school = client.sekolah || client.school || "Sekolah";
  const position = client.posisi || client.position || "Pengurus";
  const email = client.email || "";

  return templateStr
    .replace(/\{\{\s*salutation\s*\}\}/gi, salutation)
    .replace(/\{\{\s*sapaan\s*\}\}/gi, salutation)
    .replace(/\{\{\s*name\s*\}\}/gi, name)
    .replace(/\{\{\s*nama\s*\}\}/gi, name)
    .replace(/\{\{\s*school\s*\}\}/gi, school)
    .replace(/\{\{\s*sekolah\s*\}\}/gi, school)
    .replace(/\{\{\s*position\s*\}\}/gi, position)
    .replace(/\{\{\s*posisi\s*\}\}/gi, position)
    .replace(/\{\{\s*email\s*\}\}/gi, email);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    
    // Verify client is authorized using service role key
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace('Bearer ', '')
    if (token !== supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Unauthorized: Invalid credentials' }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. Fetch Gateway Settings
    const { data: settings, error: settingsErr } = await supabase
      .from('wa_settings')
      .select('*')
      .eq('id', 'default')
      .single()

    if (settingsErr) throw settingsErr
    if (!settings || !settings.third_party_api_key) {
      return new Response(JSON.stringify({ message: "Gateway settings or API key is missing. Skipping dispatcher." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      })
    }

    // 2. Fetch Active Client Drips that are due
    const nowIso = new Date().toISOString()
    const { data: dueDrips, error: dueDripsErr } = await supabase
      .from('wa_client_drips')
      .select('*')
      .eq('status', 'active')
      .lte('next_scheduled_at', nowIso)

    if (dueDripsErr) throw dueDripsErr

    console.log(`Found ${dueDrips?.length || 0} client drips due for dispatch.`);

    const results = []

    if (dueDrips && dueDrips.length > 0) {
      for (const drip of dueDrips) {
        try {
          // Fetch current step details
          const { data: step, error: stepErr } = await supabase
            .from('wa_drip_steps')
            .select('*, wa_templates(*)')
            .eq('drip_sequence_id', drip.drip_sequence_id)
            .eq('step_number', drip.current_step_number)
            .single()

          if (stepErr || !step) {
            console.error(`Step ${drip.current_step_number} not found for drip ID ${drip.id}. Completing drip sequence.`);
            await supabase
              .from('wa_client_drips')
              .update({ status: 'completed', updated_at: new Date().toISOString() })
              .eq('id', drip.id)
            continue
          }

          const templateContent = step.wa_templates?.content || step.custom_message || ""
          if (!templateContent) {
            console.error(`Empty message template content for step ${drip.current_step_number}. Skipping.`);
            continue
          }

          // Fetch latest Client fields to merge template
          const { data: client, error: clientErr } = await supabase
            .from('clients')
            .select('*')
            .eq('id', drip.client_id)
            .single()

          if (clientErr || !client) {
            console.error(`Client not found for ID: ${drip.client_id}. Pausing drip sequence.`);
            await supabase
              .from('wa_client_drips')
              .update({ status: 'paused', stop_reason: 'Client tidak ditemukan di CRM', updated_at: new Date().toISOString() })
              .eq('id', drip.id)
            continue
          }

          const renderedMessage = renderTemplate(templateContent, client, settings.default_salutation)
          const targetPhone = formatPhone(drip.phone)

          // 3. Dispatch HTTP request to Third Party Gateway (Fonnte/Wablas/etc)
          let responseStatus = 500
          let responseText = ""
          let success = false

          const gatewayName = settings.third_party_name || "Fonnte"
          const apiKey = settings.third_party_api_key

          console.log(`Sending drip step ${drip.current_step_number} to ${client.nama || client.name} (${targetPhone}) via ${gatewayName}`)

          if (gatewayName === "Fonnte") {
            const formData = new URLSearchParams()
            formData.append("target", targetPhone)
            formData.append("message", renderedMessage)

            const apiRes = await fetch("https://api.fonnte.com/send", {
              method: "POST",
              headers: {
                "Authorization": apiKey,
                "Content-Type": "application/x-www-form-urlencoded"
              },
              body: formData
            })
            responseStatus = apiRes.status
            responseText = await apiRes.text()
            success = apiRes.ok && responseText.includes('"status":true')
          } else if (gatewayName === "Wablas") {
            const apiRes = await fetch("https://api.wablas.com/api/send-message", {
              method: "POST",
              headers: {
                "Authorization": apiKey,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                phone: targetPhone,
                message: renderedMessage
              })
            })
            responseStatus = apiRes.status
            responseText = await apiRes.text()
            success = apiRes.ok
          } else if (gatewayName === "Dripsender") {
            const endpoint = settings.third_party_endpoint || "https://api.dripsender.id/send-data"
            const apiRes = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                api_key: apiKey,
                phone: targetPhone,
                message: renderedMessage
              })
            })
            responseStatus = apiRes.status
            responseText = await apiRes.text()
            success = apiRes.ok
          } else {
            // General REST API dispatcher fallback
            const endpoint = settings.third_party_endpoint || "https://api.fonnte.com/send"
            const apiRes = await fetch(endpoint, {
              method: "POST",
              headers: {
                "Authorization": apiKey,
                "Content-Type": "application/json"
              },
              body: JSON.stringify({
                to: targetPhone,
                target: targetPhone,
                message: renderedMessage,
                text: renderedMessage
              })
            })
            responseStatus = apiRes.status
            responseText = await apiRes.text()
            success = apiRes.ok
          }

          // 4. Save dispatch logs in wa_broadcast_items
          await supabase
            .from('wa_broadcast_items')
            .insert({
              client_id: drip.client_id,
              client_name: drip.client_name,
              school_name: drip.school_name,
              phone: drip.phone,
              rendered_message: renderedMessage,
              status: success ? 'sent' : 'failed',
              sent_at: new Date().toISOString(),
              error_message: success ? null : `HTTP ${responseStatus}: ${responseText}`
            })

          if (success) {
            // Update client last activity in CRM
            await supabase
              .from('clients')
              .update({
                lastActivityDesc: `Proses Sapa Tahap ${drip.current_step_number} terkirim`,
                lastActivityAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              })
              .eq('id', drip.client_id)

            // Check if there is a next step
            const nextStepNum = drip.current_step_number + 1
            const { data: nextStep } = await supabase
              .from('wa_drip_steps')
              .select('id, delay_days')
              .eq('drip_sequence_id', drip.drip_sequence_id)
              .eq('step_number', nextStepNum)
              .single()

            if (nextStep) {
              // Schedule next step
              const delayDays = nextStep.delay_days || 1
              const nextScheduleDate = new Date()
              nextScheduleDate.setDate(nextScheduleDate.getDate() + delayDays)

              await supabase
                .from('wa_client_drips')
                .update({
                  current_step_number: nextStepNum,
                  next_scheduled_at: nextScheduleDate.toISOString(),
                  last_sent_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', drip.id)
            } else {
              // No more steps: complete sequence
              await supabase
                .from('wa_client_drips')
                .update({
                  status: 'completed',
                  last_sent_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', drip.id)
            }
          }

          results.push({ clientId: drip.client_id, success, status: responseStatus })

        } catch (itemErr: any) {
          console.error(`Error processing drip item ${drip.id}:`, itemErr)
          results.push({ dripId: drip.id, error: itemErr.message })
        }
      }
    }

    return new Response(JSON.stringify({ success: true, processedCount: results.length, details: results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (err: any) {
    console.error("Dispatcher global error:", err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
