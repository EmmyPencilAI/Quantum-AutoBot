/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getSupabaseProfile(uid: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('uid', uid)
    .single();
  
  if (error && error.code !== 'PGRST116') {
    console.error('Error fetching Supabase profile:', error);
  }
  
  return data;
}

export async function updateSupabaseProfile(uid: string, updates: any) {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ uid, ...updates, updated_at: new Date().toISOString() })
    .select()
    .single();
  
  if (error) {
    console.error('Error updating Supabase profile:', error);
    throw error;
  }
  
  return data;
}
