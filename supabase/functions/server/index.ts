import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const debugUrl = new URL(req.url);
    if (debugUrl.pathname.endsWith('/debug-db')) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      const { data: tpls } = await supabase.from('wa_templates').select('*');
      const { data: steps } = await supabase.from('wa_drip_steps').select('*');
      const { data: drips } = await supabase.from('wa_client_drips').select('*');
      const { data: items } = await supabase.from('wa_broadcast_items').select('*');
      return new Response(JSON.stringify({ tpls, steps, drips, items }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      });
    }
    // 1. Verifikasi JWT token pengguna
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { 
        status: 401, 
        headers: corsHeaders 
      })
    }
    const token = authHeader.replace('Bearer ', '')

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    let userRole = 'staff'
    let user = null
    const isServiceRole = token === supabaseServiceKey

    if (isServiceRole) {
      userRole = 'owner'
    } else {
      // Verifikasi identitas pengguna menggunakan clientAuth resmi (CORS/Auth-safe)
      const clientAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      })
      const { data: { user: authUser }, error: authError } = await clientAuth.auth.getUser()

      if (authError || !authUser) {
        return new Response(JSON.stringify({ error: 'Unauthorized: ' + (authError?.message || 'Invalid user') }), { 
          status: 401, 
          headers: corsHeaders 
        })
      }
      user = authUser
    }

    // 2. Inisialisasi client sistem dengan service role key (untuk memintas RLS di sisi backend)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Ambil role pengguna dari tabel profiles jika bukan service role
    if (!isServiceRole && user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      
      userRole = profile?.role || 'staff'
    }

    const { data: debugTpls } = await supabase.from('wa_templates').select('*')
    console.log("DEBUG: wa_templates content:", JSON.stringify(debugTpls))
    const { data: debugSteps } = await supabase.from('wa_drip_steps').select('*')
    console.log("DEBUG: wa_drip_steps content:", JSON.stringify(debugSteps))

    // 3. Parse path URL & parameter query
    const url = new URL(req.url)
    // Menghilangkan prefix path default Edge Function
    const pathname = url.pathname.replace(/^\/functions\/v1\/server/, '').replace(/^\/server/, '').replace(/^\//, '')
    const pathParts = pathname.split('/')
    const table = pathParts[0]

    if (table === 'wa-all-data') {
      const [
        { data: settings },
        { data: templates },
        { data: broadcasts },
        { data: sequences },
        { data: steps },
        { data: drips }
      ] = await Promise.all([
        supabase.from('wa_settings').select('*').eq('id', 'default'),
        supabase.from('wa_templates').select('*').order('created_at', { ascending: false }),
        supabase.from('wa_broadcasts').select('*').order('created_at', { ascending: false }),
        supabase.from('wa_drip_sequences').select('*').order('created_at', { ascending: false }),
        supabase.from('wa_drip_steps').select('*').order('step_number', { ascending: true }),
        supabase.from('wa_client_drips').select('*').order('created_at', { ascending: false })
      ])
      
      return new Response(JSON.stringify({
        settings: settings || [],
        templates: templates || [],
        broadcasts: broadcasts || [],
        sequences: sequences || [],
        steps: steps || [],
        drips: drips || []
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    if (table === 'wa-dispatch' && req.method === 'POST') {
      if (userRole !== 'owner' && userRole !== 'admin') {
        return new Response(JSON.stringify({ error: 'Forbidden: Only admin/owner can trigger dispatcher' }), { 
          status: 403, 
          headers: corsHeaders 
        })
      }
      
      console.log("Running wa-dispatcher locally on same container...")
      const dispatchResult = await executeWaDispatcher(supabase)
      return new Response(JSON.stringify({ success: true, ...dispatchResult }), {
        status: 200,
        headers: corsHeaders
      })
    }



    if (!table) {
      return new Response(JSON.stringify({ error: 'Table name is required' }), { 
        status: 400, 
        headers: corsHeaders 
      })
    }

    // Batasan untuk 'viewer' (Hanya boleh GET)
    if (userRole === 'viewer' && req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Forbidden: Viewer role has read-only access' }), { 
        status: 403, 
        headers: corsHeaders 
      })
    }

    // Batasan untuk 'staff'
    if (userRole === 'staff') {
      if (table === 'settings' && req.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Forbidden: Staff cannot modify settings' }), { 
          status: 403, 
          headers: corsHeaders 
        })
      }
      if (table === 'profiles') {
        if (req.method === 'DELETE' || req.method === 'POST') {
          return new Response(JSON.stringify({ error: 'Forbidden: Staff cannot create or delete profiles' }), { 
            status: 403, 
            headers: corsHeaders 
          })
        }
        if (req.method === 'PUT' || req.method === 'PATCH') {
          const idFilter = url.searchParams.get('id')
          if (idFilter !== `eq.${user.id}`) {
            return new Response(JSON.stringify({ error: 'Forbidden: Staff can only update their own profile' }), { 
              status: 403, 
              headers: corsHeaders 
            })
          }
        }
      }
    }

    const query = supabase.from(table)

    // --- METODE GET (READ) ---
    if (req.method === 'GET') {
      const selectFields = url.searchParams.get('select') || '*'
      let dbQuery = query.select(selectFields)

      // Membaca parameter query untuk menyaring data (filtering)
      for (const [key, value] of url.searchParams.entries()) {
        if (key === 'select' || key === 'order' || key === 'single' || key === 'limit') continue
        
        if (value.startsWith('eq.')) {
          dbQuery = dbQuery.eq(key, value.substring(3))
        } else if (value.startsWith('gte.')) {
          dbQuery = dbQuery.gte(key, value.substring(4))
        } else if (value.startsWith('lte.')) {
          dbQuery = dbQuery.lte(key, value.substring(4))
        } else if (value.startsWith('in.')) {
          const listStr = value.substring(3).replace(/^\((.*)\)$/, '$1')
          const list = listStr.split(',').map(s => s.trim())
          dbQuery = dbQuery.in(key, list)
        }
      }

      // Membaca parameter query untuk sorting
      const orderParam = url.searchParams.get('order')
      if (orderParam) {
        const [col, dir] = orderParam.split('.')
        dbQuery = dbQuery.order(col, { ascending: dir === 'asc' })
      }

      // Membaca opsi single record
      const isSingle = url.searchParams.get('single') === 'true'
      if (isSingle) {
        dbQuery = dbQuery.single()
      }

      // Membaca parameter query untuk limit
      const limitParam = url.searchParams.get('limit')
      if (limitParam) {
        dbQuery = dbQuery.limit(parseInt(limitParam, 10))
      }

      const { data, error } = await dbQuery
      if (error) throw error

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // Interceptor khusus untuk wa_templates agar mensinkronkan step_number dan delay_days ke wa_drip_steps
    if (table === 'wa_templates' && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
      const body = await req.json()
      
      const stepNumber = body.step_number !== undefined && body.step_number !== null && body.step_number !== "" ? parseInt(body.step_number, 10) : null
      const delayDays = body.delay_days !== undefined && body.delay_days !== null && body.delay_days !== "" ? parseInt(body.delay_days, 10) : 1
      
      const templateBody = { ...body }
      delete templateBody.step_number
      delete templateBody.delay_days
      
      let templateId = body.id
      let resultData
      
      if (req.method === 'POST') {
        const { data, error } = await supabase.from('wa_templates').insert(templateBody).select()
        if (error) throw error
        resultData = data
        if (data && data.length > 0) {
          templateId = data[0].id
        }
      } else {
        // PUT / PATCH
        let updateQuery = supabase.from('wa_templates').update(templateBody).select()
        let hasFilter = false
        for (const [key, value] of url.searchParams.entries()) {
          if (value.startsWith('eq.')) {
            updateQuery = updateQuery.eq(key, value.substring(3))
            hasFilter = true
          }
        }
        if (!hasFilter && templateId) {
          updateQuery = updateQuery.eq('id', templateId)
        }
        const { data, error } = await updateQuery
        if (error) throw error
        resultData = data
        if (data && data.length > 0) {
          templateId = data[0].id
        }
      }
      
      // Jika stepNumber diisi, sinkronkan ke wa_drip_steps
      if (stepNumber !== null && !isNaN(stepNumber) && templateId) {
        const dripSeqId = 'd1a93e32-2415-46b7-84d4-28b9fb6c0850' // Sequence default
        
        // Hapus template ini dari relasi step lain agar tidak duplikat
        await supabase
          .from('wa_drip_steps')
          .update({ template_id: null })
          .eq('template_id', templateId)
          
        // Cari apakah step dengan step_number tersebut sudah ada
        const { data: existingStep } = await supabase
          .from('wa_drip_steps')
          .select('id')
          .eq('drip_sequence_id', dripSeqId)
          .eq('step_number', stepNumber)
          .maybeSingle()
          
        if (existingStep) {
          await supabase
            .from('wa_drip_steps')
            .update({ 
              template_id: templateId,
              delay_days: delayDays
            })
            .eq('id', existingStep.id)
        } else {
          await supabase
            .from('wa_drip_steps')
            .insert({
              drip_sequence_id: dripSeqId,
              step_number: stepNumber,
              delay_days: delayDays,
              template_id: templateId
            })
        }
      }
      
      const responseData = resultData && resultData.length === 1 ? resultData[0] : resultData
      return new Response(JSON.stringify(responseData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // --- METODE POST (INSERT) ---
    if (req.method === 'POST') {
      const body = await req.json()
      const { data, error } = await query.insert(body).select()
      if (error) throw error

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // --- METODE PUT / PATCH (UPDATE ATAU UPSERT) ---
    if (req.method === 'PUT' || req.method === 'PATCH') {
      const body = await req.json()
      let dbQuery

      // Jika ada filter di query string (misal: ?id=eq.X), lakukan update spesifik
      const hasFilters = Array.from(url.searchParams.keys()).some(k => k !== 'select')
      if (hasFilters) {
        let updateQuery = query.update(body).select()
        for (const [key, value] of url.searchParams.entries()) {
          if (value.startsWith('eq.')) {
            updateQuery = updateQuery.eq(key, value.substring(3))
          }
        }
        dbQuery = updateQuery
      } else {
        // Jika tidak ada filter, lakukan upsert (Insert or Update on conflict)
        dbQuery = query.upsert(body).select()
      }

      const { data, error } = await dbQuery
      if (error) throw error

      // Kembalikan single object jika berupa array dengan 1 item untuk kecocokan tipe data
      const responseData = data && data.length === 1 ? data[0] : data

      return new Response(JSON.stringify(responseData), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

    // --- METODE DELETE (DELETE) ---
    if (req.method === 'DELETE') {
      let deleteQuery = query.delete().select()
      let hasFilter = false

      for (const [key, value] of url.searchParams.entries()) {
        if (value.startsWith('eq.')) {
          deleteQuery = deleteQuery.eq(key, value.substring(3))
          hasFilter = true
        }
      }

      if (!hasFilter) {
        return new Response(JSON.stringify({ error: 'Delete operations require a filter (e.g. ?id=eq.X)' }), { 
          status: 400, 
          headers: corsHeaders 
        })
      }

      const { data, error } = await deleteQuery
      if (error) throw error

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      })
    }

  } catch (error) {
    console.error('API Error:', error.message)
    return new Response(JSON.stringify({ 
      error: error.message,
      details: error.details || null,
      hint: error.hint || null,
      code: error.code || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }

  return new Response('Method not allowed', { status: 405 })
})

async function executeWaDispatcher(supabase: any) {
  // 1. Fetch Gateway Settings
  let settings = null;
  const { data: settingsList, error: settingsErr } = await supabase
    .from('wa_settings')
    .select('*')
    .eq('id', 'default');

  if (settingsErr) throw settingsErr;

  if (settingsList && settingsList.length > 0) {
    settings = settingsList[0];
  } else {
    // Auto-seed default settings
    const defaultSettings = {
      id: 'default',
      provider_type: 'third_party',
      third_party_name: 'Fonnte',
      third_party_api_key: '',
      third_party_endpoint: 'https://api.fonnte.com/send',
      default_salutation: 'Bapak/Ibu',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    await supabase.from('wa_settings').insert(defaultSettings);
    settings = defaultSettings;
  }



  if (!settings || !settings.third_party_api_key) {
    return { processedCount: 0, message: "Gateway settings or API key is missing." };
  }

  // 2. Fetch Active Client Drips that are due
  const nowIso = new Date().toISOString()
  const { data: dueDrips, error: dueDripsErr } = await supabase
    .from('wa_client_drips')
    .select('*')
    .eq('status', 'active')
    .lte('next_scheduled_at', nowIso)

  if (dueDripsErr) throw dueDripsErr

  // Check daily limit of 10 messages sent today
  const todayStart = new Date()
  todayStart.setUTCHours(0,0,0,0)
  const { count: sentToday, error: countErr } = await supabase
    .from('wa_broadcast_items')
    .select('id', { count: 'exact', head: true })
    .gte('sent_at', todayStart.toISOString())
    .eq('status', 'sent')

  if (countErr) throw countErr
  
  const maxAllowed = 10 - (sentToday || 0)
  if (maxAllowed <= 0) {
    return { processedCount: 0, message: "Batas harian pengiriman (10 pesan) sudah tercapai hari ini." }
  }

  // Slice dueDrips to maxAllowed
  const dripsToProcess = dueDrips.slice(0, maxAllowed)

  const results = []

  if (dripsToProcess && dripsToProcess.length > 0) {
    for (const drip of dripsToProcess) {
      try {
        // Fetch current step details
        const { data: step, error: stepErr } = await supabase
          .from('wa_drip_steps')
          .select('*, wa_templates(*)')
          .eq('drip_sequence_id', drip.drip_sequence_id)
          .eq('step_number', drip.current_step_number)
          .single()

        if (stepErr || !step) {
          await supabase
            .from('wa_client_drips')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', drip.id)
          continue
        }

        const templateContent = step.wa_templates?.content || step.custom_message || ""
        if (!templateContent) {
          await supabase
            .from('wa_client_drips')
            .update({ 
              status: 'paused', 
              stop_reason: `Template untuk Tahap ${drip.current_step_number} belum dikonfigurasi.`, 
              updated_at: new Date().toISOString() 
            })
            .eq('id', drip.id)
          continue
        }

        // Fetch latest Client fields to merge template
        const { data: client, error: clientErr } = await supabase
          .from('clients')
          .select('*')
          .eq('id', drip.client_id)
          .single()

        if (clientErr || !client) {
          await supabase
            .from('wa_client_drips')
            .update({ status: 'paused', stop_reason: 'Client tidak ditemukan di CRM', updated_at: new Date().toISOString() })
            .eq('id', drip.id)
          continue
        }

        // Render template content helper
        const salutation = client.sapaan || client.salutation || settings.default_salutation || "Bapak/Ibu"
        const name = client.nama || client.name || "Bapak/Ibu"
        const nickname = client.panggilan || client.nickname || name
        const school = client.sekolah || client.school || "Sekolah"
        const position = client.posisi || client.position || "Pengurus"
        const email = client.email || ""

        const renderedMessage = templateContent
          .replace(/\{\{\s*salutation\s*\}\}/gi, salutation)
          .replace(/\{\{\s*sapaan\s*\}\}/gi, salutation)
          .replace(/\{\{\s*name\s*\}\}/gi, name)
          .replace(/\{\{\s*nama\s*\}\}/gi, name)
          .replace(/\{\{\s*nickname\s*\}\}/gi, nickname)
          .replace(/\{\{\s*panggilan\s*\}\}/gi, nickname)
          .replace(/\{\{\s*school\s*\}\}/gi, school)
          .replace(/\{\{\s*sekolah\s*\}\}/gi, school)
          .replace(/\{\{\s*position\s*\}\}/gi, position)
          .replace(/\{\{\s*posisi\s*\}\}/gi, position)
          .replace(/\{\{\s*email\s*\}\}/gi, email);

        // Format phone
        let cleaned = drip.phone.replace(/\D/g, "")
        if (cleaned.startsWith("0")) {
          cleaned = "62" + cleaned.substring(1)
        } else if (cleaned.startsWith("8")) {
          cleaned = "62" + cleaned
        }
        const targetPhone = cleaned

        // Dispatch HTTP request to Third Party Gateway (Fonnte/Wablas/etc)
        let responseStatus = 500
        let responseText = ""
        let success = false

        const gatewayName = settings.third_party_name || "Fonnte"
        const apiKey = settings.third_party_api_key

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
              message: renderedMessage
            })
          })
          responseStatus = apiRes.status
          responseText = await apiRes.text()
          success = apiRes.ok
        }

        // Save dispatch logs in wa_broadcast_items
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
          const nextStepNum = drip.current_step_number + 1
          const { data: nextStep } = await supabase
            .from('wa_drip_steps')
            .select('id, delay_days, template_id')
            .eq('drip_sequence_id', drip.drip_sequence_id)
            .eq('step_number', nextStepNum)
            .maybeSingle()

          if (nextStep && nextStep.template_id) {
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
            await supabase
              .from('wa_client_drips')
              .update({
                status: 'completed',
                last_sent_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', drip.id)

            // 1. Update client status in CRM to COLD
            await supabase
              .from('clients')
              .update({
                status: 'COLD',
                proses: 'COLD',
                lastActivityDesc: 'Proses Sapa selesai tanpa balasan',
                lastActivityAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              })
              .eq('id', drip.client_id)

            // 2. Log to daily_activities
            await supabase
              .from('daily_activities')
              .insert({
                userId: 'system',
                userName: 'System (WhatsApp dispatcher)',
                date: new Date().toISOString().split('T')[0],
                text: `Proses Sapa selesai tanpa balasan untuk client ${drip.client_name} (CRM otomatis status COLD)`,
                extraInfo: `Selesai setelah Tahap ${drip.current_step_number}`,
                type: 'auto',
                refId: drip.client_id,
                refType: 'Client',
                category: 'WhatsApp',
                isDone: true,
                createdAt: new Date().toISOString()
              })
          }
        }

        results.push({ clientId: drip.client_id, success, status: responseStatus })

      } catch (itemErr: any) {
        results.push({ dripId: drip.id, error: itemErr.message })
      }
    }
  }

  return { processedCount: results.length, details: results }
}
