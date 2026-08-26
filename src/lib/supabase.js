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
export const parseDates = (obj, fields = ['createdAt', 'updatedAt', 'lastSeen', 'lastActivityAt', 'timestamp']) => {
  if (!obj) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => parseDates(item, fields));
  }
  const newObj = { ...obj };
  fields.forEach(field => {
    if (newObj[field]) {
      newObj[field] = new Date(newObj[field]);
    }
  });
  return newObj;
};

/**
 * Helper untuk memanggil Edge Function terpusat 'api' sebagai REST API Gateway.
 * @param {string} path - Jalur endpoint, misal: '/clients' atau '/leads?id=eq.X'
 * @param {object} options - Opsi HTTP request (method, body, headers)
 */
export const invokeApi = async (path, options = {}) => {
  const method = options.method || 'GET';
  const body = options.body;
  const headers = { ...options.headers };

  // Ambil session secara eksplisit dan pasang token di header Authorization untuk memastikan autentikasi stabil
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }

  const cleanedPath = path.startsWith('/') ? path : `/${path}`;

  const { data, error } = await supabase.functions.invoke(`server${cleanedPath}`, {
    method,
    headers,
    body
  });

  if (error) {
    console.error(`API Gateway Error [${method} ${cleanedPath}]:`, error);
    throw error;
  }

  return { data, error };
};
