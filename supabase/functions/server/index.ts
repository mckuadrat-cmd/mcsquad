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

    // Verifikasi identitas pengguna menggunakan clientAuth resmi (CORS/Auth-safe)
    const clientAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    })
    const { data: { user }, error: authError } = await clientAuth.auth.getUser()

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized: ' + (authError?.message || 'Invalid user') }), { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    // 2. Inisialisasi client sistem dengan service role key (untuk memintas RLS di sisi backend)
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Ambil role pengguna dari tabel profiles
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = profile?.role || 'staff'

    // 3. Parse path URL & parameter query
    const url = new URL(req.url)
    // Menghilangkan prefix path default Edge Function
    const pathname = url.pathname.replace(/^\/functions\/v1\/server/, '').replace(/^\/server/, '').replace(/^\//, '')
    const pathParts = pathname.split('/')
    const table = pathParts[0]

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
