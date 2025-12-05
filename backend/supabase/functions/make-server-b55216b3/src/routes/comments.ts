import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export async function handleObservationComments(req: Request, path: string, url: URL, headers: Record<string,string>) {
  const obsId = path.split('/')[2];
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  if (req.method === 'GET') {
    try {
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('id, text, created_at, user_id')
        .eq('observation_id', obsId)
        .order('created_at', { ascending: true });
      if (commentsError) throw commentsError;

      const userIds = Array.from(new Set((commentsData || []).map((c: any) => c.user_id).filter(Boolean)));
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, username, name, avatar_url')
          .in('id', userIds);
        if (profilesData) {
          for (const p of profilesData) profilesMap[p.id] = p;
        }
      }

      const formatted = (commentsData || []).map((c: any) => ({
        id: c.id,
        text: c.text,
        createdAt: c.created_at,
        userId: c.user_id,
        userName: profilesMap[c.user_id]?.username || profilesMap[c.user_id]?.name || 'Unknown',
        userAvatar: profilesMap[c.user_id]?.avatar_url || null,
      }));

      return new Response(JSON.stringify({ success: true, data: formatted }), { status: 200, headers });
    } catch (error: any) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers });
    }
  } else if (req.method === 'POST') {
    try {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers });
      }
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), { status: 401, headers });
      }
      const body = await req.json();
      if (!body.text || !body.text.trim()) {
        return new Response(JSON.stringify({ success: false, error: 'Comment text required' }), { status: 400, headers });
      }
      const { data: comment, error: dbError } = await supabase
        .from('comments')
        .insert({ observation_id: obsId, user_id: user.id, text: body.text })
        .select()
        .single();
      if (dbError) {
        return new Response(JSON.stringify({ success: false, error: dbError.message }), { status: 500, headers });
      }

      // Fetch observation to get owner
      const { data: obs, error: obsError } = await supabase
        .from('observations')
        .select('id, user_id')
        .eq('id', obsId)
        .single();
      if (!obsError && obs && obs.user_id !== user.id) {
        const { data: commenterProfile } = await supabase
          .from('profiles')
          .select('username, name')
          .eq('id', user.id)
          .single();

        const actorName = commenterProfile?.username || commenterProfile?.name || user.email || 'Someone';

        await supabase.from('notifications').insert({
          user_id: obs.user_id,
          observation_id: obsId,
          comment_id: comment.id,
          type: 'new_comment',
          message: `${actorName} commented on your observation`,
        });
      }

      return new Response(JSON.stringify({ success: true, data: comment }), { status: 201, headers });
    } catch (error: any) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers });
    }
  } else {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  }
}
