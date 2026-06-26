import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = url && key ? createClient(url, key) : null;

export const STORAGE_BUCKET = 'market-images';

// Upload a File to Supabase Storage and return its public URL.
export async function uploadImage(file) {
  if (!supabase) throw new Error('Supabase не настроен');
  if (!file.type.startsWith('image/')) throw new Error('Выберите изображение');
  if (file.size > 5 * 1024 * 1024) throw new Error('Файл больше 5 МБ');

  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false });
  if (error) throw error;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
