import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY || ''
let isSecretKey = supabaseAnonKey.startsWith('sb_secret_')
try {
  isSecretKey ||= JSON.parse(atob(supabaseAnonKey.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role'
} catch { /* Publishable keys are not JWTs. */ }

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('[REDACTED]') && 
  !supabaseAnonKey.includes('[REDACTED]') && !isSecretKey
)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null
