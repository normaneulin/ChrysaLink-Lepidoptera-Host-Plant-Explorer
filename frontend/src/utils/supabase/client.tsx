import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from './info';

// Singleton Supabase client to avoid multiple instances
let supabaseClient: any = null;

export function getSupabaseClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(
      `https://${projectId}.supabase.co`,
      publicAnonKey
    );
  }
  return supabaseClient;
}

// Ensure a profile row exists for a given user id. Upserts a basic profile record.
export async function ensureProfileForUser(user: { id: string, email?: string, user_metadata?: any }) {
  if (!user?.id) {
    return;
  }
  const supabase = getSupabaseClient();
  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: user.id, email: user.email || null, name: user.user_metadata?.name || null }, { returning: 'minimal' });
    if (error) {
      console.warn('Failed to upsert profile', error.message);
    }
  } catch (err) {
    console.error('ensureProfileForUser error', err);
  }
}
