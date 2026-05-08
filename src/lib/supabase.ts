import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Verificação básica: se não é o valor padrão e parece uma URL/Chave
const isPlaceholder = (val: string | undefined) => 
  !val || 
  val.includes('sua-url') || 
  val.includes('your_') || 
  val.includes('YOUR_') ||
  val === 'placeholder' ||
  val === 'placeholder-key';

export const isSupabaseConfigured = !isPlaceholder(supabaseUrl) && !isPlaceholder(supabaseAnonKey);

if (!isSupabaseConfigured && (supabaseUrl || supabaseAnonKey)) {
  console.warn('Aviso: Chaves do Supabase não configuradas corretamente nos Secrets.');
}

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl! : 'https://placeholder-ais.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey! : 'placeholder-key'
);

export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase.from('players').select('id').limit(1);
    if (error) throw error;
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};
