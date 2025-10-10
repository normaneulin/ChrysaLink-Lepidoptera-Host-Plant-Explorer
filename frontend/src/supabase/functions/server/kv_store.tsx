// Stub to avoid Deno/Hono server code being included in the frontend TypeScript build.
// Actual KV implementation is under: supabase/functions/make-server-b55216b3/kv_store.tsx

export const set = async (_key: string, _value: any): Promise<void> => {
  // no-op stub for frontend build
};

export const get = async (_key: string): Promise<any> => {
  return null;
};

export const del = async (_key: string): Promise<void> => {
  // no-op stub
};

export const getByPrefix = async (_prefix: string): Promise<any[]> => {
  return [];
};