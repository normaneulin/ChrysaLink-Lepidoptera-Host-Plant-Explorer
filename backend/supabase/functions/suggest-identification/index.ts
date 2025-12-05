const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY')!;

async function getUserIdFromAuth(authorization: string | null) {
  if (!authorization) return null;
  const resp = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: authorization }
  });
  if (!resp.ok) return null;
  const user = await resp.json();
  return user?.id || null;
}

Deno.serve(async (req) => {
  try {
    if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });

    const url = new URL(req.url);
    const obsId = url.searchParams.get('observationId');
    if (!obsId) return new Response(JSON.stringify({ error: 'Missing observationId query parameter' }), { status: 400 });

    const body = await req.json().catch(() => ({}));
    const { species, scientific_name = '', caption = '', identification_type = 'lepidoptera' } = body;
    if (!species) return new Response(JSON.stringify({ error: 'Missing species' }), { status: 400 });

    const authorization = req.headers.get('Authorization');
    const userId = await getUserIdFromAuth(authorization);
    if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    // Insert identification
    const insertResp = await fetch(`${SUPABASE_URL}/rest/v1/identifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        Prefer: 'return=representation'
      },
      body: JSON.stringify([{ observation_id: obsId, user_id: userId, species, scientific_name, caption, identification_type }])
    });

    if (!insertResp.ok) {
      const errText = await insertResp.text();
      return new Response(JSON.stringify({ error: 'Failed to insert identification', detail: errText }), { status: 500 });
    }

    const created = await insertResp.json();
    const ident = created[0];

    // Insert initial vote for suggester
    await fetch(`${SUPABASE_URL}/rest/v1/identification_votes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify([{ identification_id: ident.id, user_id: userId }])
    }).catch(() => {});

    return new Response(JSON.stringify({ success: true, identification: ident }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
