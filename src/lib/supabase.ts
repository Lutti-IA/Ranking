import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;NEXT_PUBLIC_SUPABASE_URL=https://mvstjyagqsblcjeytodj.supabase.co
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;sb_publishable_VOpSApififBt97pzkFNkPg_gwnfyYMm

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase URL or Anon Key is missing. Please check your environment variables in the Settings menu.'
  );
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || ''
);
