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
    const identificationId = url.searchParams.get('identificationId') || url.pathname.split('/').pop();
    if (!identificationId) return new Response(JSON.stringify({ error: 'Missing identificationId parameter' }), { status: 400 });

    const authorization = req.headers.get('Authorization');
    const userId = await getUserIdFromAuth(authorization);
    if (!userId) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    // Insert vote
    const voteResp = await fetch(`${SUPABASE_URL}/rest/v1/identification_votes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_KEY}`,
        apikey: SERVICE_KEY,
        Prefer: 'return=representation'
      },
      body: JSON.stringify([{ identification_id: identificationId, user_id: userId }])
    });

    // If conflict (duplicate) service may return 409/4xx; treat it as success
    if (voteResp.status >= 200 && voteResp.status < 300) {
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    const txt = await voteResp.text();
    // If conflict, still return success
    if (voteResp.status === 409 || txt.includes('duplicate') || txt.includes('already exists')) {
      return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Failed to insert vote', detail: txt }), { status: 500 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
