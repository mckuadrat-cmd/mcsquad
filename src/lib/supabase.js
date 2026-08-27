import { createClient } from '@supabase/supabase-js';

// Extend Date prototype so that any JS Date object has a .toDate() method returning itself.
// Also define a 'seconds' property getter to mimic Firestore's Timestamp.seconds behavior,
// and a 'toMillis' method to mimic Firestore's Timestamp.toMillis().
if (!Date.prototype.toDate) {
  Date.prototype.toDate = function() {
    return this;
  };
}

if (!Date.prototype.hasOwnProperty('seconds')) {
  Object.defineProperty(Date.prototype, 'seconds', {
    get() {
      return Math.floor(this.getTime() / 1000);
    },
    configurable: true
  });
}

if (!Date.prototype.toMillis) {
  Date.prototype.toMillis = function() {
    return this.getTime();
  };
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing. Check your .env file.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Helper to convert ISO date strings from Supabase to JS Date objects,
 * ensuring compatibility with frontend components expecting Firestore Timestamps.
 */
export const parseDates = (obj, fields = ['createdAt', 'updatedAt', 'lastSeen', 'lastActivityAt', 'timestamp', 'created_at', 'updated_at', 'last_sent_at', 'next_scheduled_at']) => {
  if (!obj) return obj;
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const item = obj[i];
      if (item && typeof item === 'object') {
        for (let j = 0; j < fields.length; j++) {
          const field = fields[j];
          if (item[field] && typeof item[field] === 'string') {
            item[field] = new Date(item[field]);
          }
        }
      }
    }
    return obj;
  }
  if (typeof obj === 'object') {
    for (let j = 0; j < fields.length; j++) {
      const field = fields[j];
      if (obj[field] && typeof obj[field] === 'string') {
        obj[field] = new Date(obj[field]);
      }
    }
  }
  return obj;
};

export const invokeApi = async (path, options = {}) => {
  const method = options.method || 'GET';
  let body = options.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {}
  }

  const cleanedPath = path.startsWith('/') ? path : `/${path}`;
  const [urlPath, queryString] = cleanedPath.split('?');
  const tableName = urlPath.replace('/', '');

  // 1. Direct PostgREST fast-path for standard database tables (Instant <50ms response, 0 cold starts)
  const knownTables = ['clients', 'leads', 'projects', 'profiles', 'daily_activities', 'calendar_events', 'wa_settings', 'wa_templates', 'wa_broadcasts', 'wa_client_drips', 'wa_inbound_logs', 'event_reports', 'generated_documents'];

  if (knownTables.includes(tableName)) {
    try {
      const searchParams = new URLSearchParams(queryString || '');
      const single = searchParams.get('single') === 'true';
      searchParams.delete('single');

      let query = supabase.from(tableName);

      if (method === 'GET') {
        let selectQuery = query.select('*');
        searchParams.forEach((val, key) => {
          if (key === 'order') {
            const [col, dir] = val.split('.');
            selectQuery = selectQuery.order(col, { ascending: dir !== 'desc' });
          } else if (val.startsWith('eq.')) {
            selectQuery = selectQuery.eq(key, val.replace('eq.', ''));
          } else if (val.startsWith('ilike.')) {
            selectQuery = selectQuery.ilike(key, val.replace('ilike.', ''));
          }
        });

        if (single) {
          const { data, error } = await selectQuery.single();
          if (error && error.code !== 'PGRST116') throw error;
          return { data, error: null };
        } else {
          const { data, error } = await selectQuery;
          if (error) throw error;
          return { data, error: null };
        }
      } else if (method === 'POST') {
        const { data, error } = await query.insert(body).select();
        if (error) throw error;
        return { data: Array.isArray(body) ? data : (data?.[0] || data), error: null };
      } else if (method === 'PUT' || method === 'PATCH') {
        let updateQuery = query.update(body);
        let idVal = body?.id;
        searchParams.forEach((val, key) => {
          if (val.startsWith('eq.')) {
            idVal = val.replace('eq.', '');
            updateQuery = updateQuery.eq(key, idVal);
          }
        });
        if (idVal && !searchParams.has('id')) {
          updateQuery = updateQuery.eq('id', idVal);
        }
        const { data, error } = await updateQuery.select();
        if (error) throw error;
        return { data, error: null };
      } else if (method === 'DELETE') {
        let deleteQuery = query.delete();
        searchParams.forEach((val, key) => {
          if (val.startsWith('eq.')) {
            deleteQuery = deleteQuery.eq(key, val.replace('eq.', ''));
          }
        });
        const { data, error } = await deleteQuery;
        if (error) throw error;
        return { data, error: null };
      }
    } catch (directErr) {
      console.warn(`Direct PostgREST notice [${cleanedPath}], delegating to Edge Function:`, directErr.message);
    }
  }

  // 2. Edge Function fallback for custom server logic endpoints
  const headers = { ...options.headers };
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const { data, error } = await supabase.functions.invoke(`server${cleanedPath}`, {
    method,
    headers,
    body: typeof body === 'object' ? JSON.stringify(body) : body
  });

  if (error) {
    let detailMsg = error.message;
    try {
      if (error.context && typeof error.context.json === 'function') {
        const bodyJson = await error.context.json();
        if (bodyJson?.error) {
          detailMsg = bodyJson.error;
        }
      }
    } catch (e) {}
    console.error(`API Gateway Error [${method} ${cleanedPath}]:`, detailMsg, error);
    throw new Error(detailMsg);
  }

  return { data, error };
};
