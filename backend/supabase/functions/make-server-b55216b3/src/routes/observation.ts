import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

export async function handleObservationGet(req: Request, path: string, url: URL, headers: Record<string,string>) {
  try {
    const obsId = path.split('/')[2];
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get observation
    const { data: obs, error: obsError } = await supabase
      .from('observations')
      .select(`*,
        lepidoptera:lepidoptera_taxonomy(scientific_name, common_name, family),
        plant:plant_taxonomy(scientific_name, common_name, family)
      `)
      .eq('id', obsId)
      .single();

    if (obsError || !obs) {
      return new Response(
        JSON.stringify({ success: false, error: obsError?.message || 'Not found' }),
        { status: 404, headers }
      );
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('id, name, username, avatar_url, observation_count')
      .eq('id', obs.user_id)
      .single();

    // Get images
    const { data: images } = await supabase
      .from('observation_images')
      .select('observation_id, image_url, image_type')
      .eq('observation_id', obsId);

    const lepImg = images?.find((i: any) => i.image_type === 'lepidoptera');
    const plantImg = images?.find((i: any) => i.image_type === 'plant');

    // Get comments (robust: fetch comments then batch-fetch profiles)
    const { data: commentsData } = await supabase
      .from('comments')
      .select('id, text, created_at, user_id')
      .eq('observation_id', obsId)
      .order('created_at', { ascending: true });

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

    const formattedComments = (commentsData || []).map((c: any) => ({
      id: c.id,
      text: c.text,
      createdAt: c.created_at,
      userId: c.user_id,
      userName: profilesMap[c.user_id]?.username || profilesMap[c.user_id]?.name || 'Unknown',
      userAvatar: profilesMap[c.user_id]?.avatar_url || null,
    }));

    // Get identifications for this observation
    const { data: identsData } = await supabase
      .from('identifications')
      .select('*')
      .eq('observation_id', obsId)
      .order('created_at', { ascending: true });

    const identificationIds = (identsData || []).map((i: any) => i.id).filter(Boolean);

    // Fetch votes for identifications
    let votesData: any[] = [];
    if (identificationIds.length > 0) {
      const { data: v } = await supabase
        .from('identification_votes')
        .select('id, identification_id, user_id, created_at')
        .in('identification_id', identificationIds);
      votesData = v || [];
    }

    // Fetch profiles for identification authors
    const idUserIds = Array.from(new Set((identsData || []).map((it: any) => it.user_id).filter(Boolean)));
    let idProfilesMap: Record<string, any> = {};
    if (idUserIds.length > 0) {
      const { data: idProfiles } = await supabase
        .from('profiles')
        .select('id, username, name, avatar_url')
        .in('id', idUserIds);
      if (idProfiles) for (const p of idProfiles) idProfilesMap[p.id] = p;
    }

    // Attach votes and author info to identifications
    const formattedIdentifications = (identsData || []).map((it: any) => {
      const votesForId = (votesData || []).filter(v => String(v.identification_id) === String(it.id));
      return {
        id: it.id,
        observation_id: it.observation_id,
        user_id: it.user_id,
        userName: idProfilesMap[it.user_id]?.username || idProfilesMap[it.user_id]?.name || null,
        userAvatar: idProfilesMap[it.user_id]?.avatar_url || null,
        species: it.species,
        caption: it.caption || null,
        scientific_name: it.scientific_name,
        identification_type: it.identification_type,
        is_verified: it.is_verified,
        created_at: it.created_at,
        createdAt: it.created_at,
        identification_votes: votesForId.map(v => ({ id: v.id, user_id: v.user_id, created_at: v.created_at })),
        vote_count: votesForId.length,
      };
    });

    // Compose response
    const enriched = {
      ...obs,
      user: userProfile || null,
      lepidoptera_image_url: lepImg ? lepImg.image_url : null,
      plant_image_url: plantImg ? plantImg.image_url : null,
      image_url: lepImg ? lepImg.image_url : (plantImg ? plantImg.image_url : null),
      comments: formattedComments,
      identifications: formattedIdentifications,
    };

    return new Response(
      JSON.stringify({ success: true, data: enriched }),
      { status: 200, headers }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers }
    );
  }
}
