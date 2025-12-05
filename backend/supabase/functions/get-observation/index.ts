const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_KEY')!;

Deno.serve(async (req) => {
  try {
    if (req.method !== 'GET') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    const url = new URL(req.url);
    const obsId = url.searchParams.get('observationId');
    if (!obsId) return new Response(JSON.stringify({ error: 'Missing observationId query parameter' }), { status: 400 });

    // Fetch observation
    const obsResp = await fetch(`${SUPABASE_URL}/rest/v1/observations?id=eq.${obsId}`, {
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY }
    });
    if (!obsResp.ok) return new Response(JSON.stringify({ error: 'Failed to fetch observation' }), { status: 500 });
    const obsRows = await obsResp.json();
    const observation = obsRows[0] || null;
    if (!observation) return new Response(JSON.stringify({ error: 'Observation not found' }), { status: 404 });

    // Fetch identifications for the observation
    const idsResp = await fetch(`${SUPABASE_URL}/rest/v1/identifications?observation_id=eq.${obsId}`, {
      headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY }
    });
    if (!idsResp.ok) return new Response(JSON.stringify({ error: 'Failed to fetch identifications' }), { status: 500 });
    const identifications = await idsResp.json();

    const identIds = identifications.map((i: any) => i.id).filter(Boolean);
    let votes: any[] = [];
    if (identIds.length > 0) {
      // Build in-list for identification_ids
      const inList = identIds.map((i: string) => encodeURIComponent(i)).join(',');
      const votesResp = await fetch(`${SUPABASE_URL}/rest/v1/identification_votes?identification_id=in.(${inList})`, {
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY }
      });
      if (votesResp.ok) votes = await votesResp.json();
    }

    // Count votes per identification
    const votesMap: Record<string, number> = {};
    for (const v of votes) {
      votesMap[v.identification_id] = (votesMap[v.identification_id] || 0) + 1;
    }

    // Fetch profiles for identification authors
    const userIds = Array.from(new Set(identifications.map((i: any) => i.user_id).filter(Boolean)));
    let profilesMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const inUsers = userIds.map((u: string) => encodeURIComponent(u)).join(',');
      const profResp = await fetch(`${SUPABASE_URL}/rest/v1/profiles?id=in.(${inUsers})`, {
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, apikey: SERVICE_KEY }
      });
      if (profResp.ok) {
        const profs = await profResp.json();
        for (const p of profs) profilesMap[p.id] = p;
      }
    }

    const enriched = identifications.map((i: any) => ({
      ...i,
      votes: votesMap[i.id] || 0,
      userName: profilesMap[i.user_id]?.username || profilesMap[i.user_id]?.name || null
    }));

    observation.identifications = enriched;

    return new Response(JSON.stringify({ success: true, observation }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500 });
  }
});
