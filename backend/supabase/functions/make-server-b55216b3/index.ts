import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Remove the function name prefix from the path
  const path = url.pathname.replace('/functions/v1/make-server-b55216b3', '').replace('/make-server-b55216b3', '');
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };

  // Route handling
    // --- Observation Deletion with Storage Cleanup ---
    if (path.match(/^\/observations\/[\w-]+$/) && req.method === 'DELETE') {
      try {
        const obsId = path.split('/')[2];
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = createClient(supabaseUrl, supabaseKey);
        // Get observation details
        const { data: obs, error: obsError } = await supabase
          .from('observations')
          .select('id, user_id')
          .eq('id', obsId)
          .single();
        if (obsError || !obs) {
          return new Response(
            JSON.stringify({ success: false, error: obsError?.message || 'Observation not found' }),
            { status: 404, headers }
          );
        }
        // List all images for this observation
        const folder = `${obs.user_id}/${obs.id}/`;
        const { data: files, error: filesError } = await supabase.storage.from('observation-images').list(folder);
        if (!filesError && files && files.length > 0) {
          const fileNames = files.map(f => `${folder}${f.name}`);
          await supabase.storage.from('observation-images').remove(fileNames);
        }
        // Delete observation from database
        const { error: dbError } = await supabase.from('observations').delete().eq('id', obsId);
        if (dbError) {
          return new Response(
            JSON.stringify({ success: false, error: dbError.message }),
            { status: 500, headers }
          );
        }
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers }
        );
      } catch (e) {
        return new Response(
          JSON.stringify({ success: false, error: e.message }),
          { status: 500, headers }
        );
      }
    }

    // --- User Deletion with Storage Cleanup (utility endpoint) ---
    if (path.match(/^\/users\/[\w-]+\/delete_with_images$/) && req.method === 'DELETE') {
      try {
        const userId = path.split('/')[2];
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = createClient(supabaseUrl, supabaseKey);
        // Get all observations for user
        const { data: observations, error: obsError } = await supabase
          .from('observations')
          .select('id')
          .eq('user_id', userId);
        if (obsError) {
          return new Response(
            JSON.stringify({ success: false, error: obsError.message }),
            { status: 500, headers }
          );
        }
        // For each observation, delete images
        for (const obs of observations) {
          const folder = `${userId}/${obs.id}/`;
          const { data: files, error: filesError } = await supabase.storage.from('observation-images').list(folder);
          if (!filesError && files && files.length > 0) {
            const fileNames = files.map(f => `${folder}${f.name}`);
            await supabase.storage.from('observation-images').remove(fileNames);
          }
        }
        // Delete all observations for user
        await supabase.from('observations').delete().eq('user_id', userId);
        // Delete user profile
        await supabase.from('profiles').delete().eq('id', userId);
        // Optionally, delete from auth.users if you have access
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers }
        );
      } catch (e) {
        return new Response(
          JSON.stringify({ success: false, error: e.message }),
          { status: 500, headers }
        );
      }
    }
  if (path === '/' || path === '') {
    return new Response(
      JSON.stringify({ status: 'ok', message: 'ChrysaLink API v17 - With Database' }),
      { status: 200, headers }
    );
  }

  // --- Species Search ---
  if (path === '/species/search') {
    try {
      const query = url.searchParams.get('q');
      const type = url.searchParams.get('type');
      
      if (!query || query.length < 1) {
        return new Response(
          JSON.stringify({ success: true, data: [] }),
          { status: 200, headers }
        );
      }

      // Initialize Supabase client
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      let data = [];

      if (type === 'lepidoptera') {
        // Search lepidoptera_taxonomy table
        const { data: results, error } = await supabase
          .from('lepidoptera_taxonomy')
          .select('*')
          .or(`division.ilike.%${query}%,family.ilike.%${query}%,subfamily.ilike.%${query}%,tribe.ilike.%${query}%,genus.ilike.%${query}%,specific_epithet.ilike.%${query}%,subspecific_epithet.ilike.%${query}%,scientific_name.ilike.%${query}%,common_name.ilike.%${query}%`)
          .limit(10);

        if (error) throw error;
        
        // Add smart display names based on what matched
        data = (results || []).map(item => {
          const q = query.toLowerCase();
          let display_name = '';
          let taxonomic_level = '';
          
          // Check what field matched (in order of specificity)
          if (item.scientific_name?.toLowerCase().includes(q)) {
            display_name = item.scientific_name;
            taxonomic_level = 'species';
          } else if (item.subspecific_epithet?.toLowerCase().includes(q) && item.genus && item.specific_epithet) {
            display_name = `${item.genus} ${item.specific_epithet} ${item.subspecific_epithet}`;
            taxonomic_level = 'subspecies';
          } else if (item.specific_epithet?.toLowerCase().includes(q) && item.genus) {
            display_name = `${item.genus} ${item.specific_epithet}`;
            taxonomic_level = 'species';
          } else if (item.genus?.toLowerCase().includes(q)) {
            display_name = item.genus;
            taxonomic_level = 'genus';
          } else if (item.tribe?.toLowerCase().includes(q)) {
            display_name = item.tribe;
            taxonomic_level = 'tribe';
          } else if (item.subfamily?.toLowerCase().includes(q)) {
            display_name = item.subfamily;
            taxonomic_level = 'subfamily';
          } else if (item.family?.toLowerCase().includes(q)) {
            display_name = item.family;
            taxonomic_level = 'family';
          } else if (item.division?.toLowerCase().includes(q)) {
            display_name = item.division;
            taxonomic_level = 'division';
          } else if (item.common_name?.toLowerCase().includes(q)) {
            display_name = item.scientific_name || item.common_name;
            taxonomic_level = 'common_name';
          }
          else {
            display_name = item.scientific_name || item.genus || 'Unknown';
            taxonomic_level = 'unknown';
          }
          
          return {
            ...item,
            display_name,
            taxonomic_level
          };
        });
      } else if (type === 'plant') {
        // Search plant_taxonomy table
        const { data: results, error } = await supabase
          .from('plant_taxonomy')
          .select('*')
          .or(`division.ilike.%${query}%,family.ilike.%${query}%,genus.ilike.%${query}%,specific_epithet.ilike.%${query}%,subspecific_epithet.ilike.%${query}%,scientific_name.ilike.%${query}%,common_name.ilike.%${query}%`)
          .limit(10);

        if (error) throw error;
        
        // Add smart display names based on what matched
        data = (results || []).map(item => {
          const q = query.toLowerCase();
          let display_name = '';
          let taxonomic_level = '';
          
          // Check what field matched (in order of specificity)
          if (item.scientific_name?.toLowerCase().includes(q)) {
            display_name = item.scientific_name;
            taxonomic_level = 'species';
          } else if (item.subspecific_epithet?.toLowerCase().includes(q) && item.genus && item.specific_epithet) {
            display_name = `${item.genus} ${item.specific_epithet} ${item.subspecific_epithet}`;
            taxonomic_level = 'subspecies';
          } else if (item.specific_epithet?.toLowerCase().includes(q) && item.genus) {
            display_name = `${item.genus} ${item.specific_epithet}`;
            taxonomic_level = 'species';
          } else if (item.genus?.toLowerCase().includes(q)) {
            display_name = item.genus;
            taxonomic_level = 'genus';
          } else if (item.family?.toLowerCase().includes(q)) {
            display_name = item.family;
            taxonomic_level = 'family';
          } else if (item.division?.toLowerCase().includes(q)) {
            display_name = item.division;
            taxonomic_level = 'division';
          } else if (item.common_name?.toLowerCase().includes(q)) {
            display_name = item.scientific_name || item.common_name;
            taxonomic_level = 'common_name';
          } else {
            display_name = item.scientific_name || item.genus || 'Unknown';
            taxonomic_level = 'unknown';
          }
          
          return {
            ...item,
            display_name,
            taxonomic_level
          };
        });
      }

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers }
      );
    } catch (error: any) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers }
      );
    }
  }

  // --- Notifications ---
  if (path === '/notifications') {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Get user from auth header
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(
          JSON.stringify({ success: false, error: 'Unauthorized' }),
          { status: 401, headers }
        );
      }
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid token' }),
          { status: 401, headers }
        );
      }

      // Fetch notifications for user
      const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data: notifications }),
        { status: 200, headers }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers }
      );
    }
  }

  // --- Observation Comments ---
  if (path.match(/^\/observations\/[\w-]+\/comments$/)) {
    const obsId = path.split('/')[2];
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (req.method === 'GET') {
      // List comments for observation
      try {
        // Get comments and join user info
        const { data: comments, error } = await supabase
          .from('comments')
          .select('id, text, created_at, user_id, user:profiles(id, username, name, avatar_url)')
          .eq('observation_id', obsId)
          .order('created_at', { ascending: true });
        if (error) throw error;
        // Format for frontend
        const formatted = (comments || []).map(c => ({
          id: c.id,
          text: c.text,
          createdAt: c.created_at,
          userId: c.user_id,
          userName: c.user?.username || c.user?.name || 'Unknown',
          userAvatar: c.user?.avatar_url || null,
        }));
        return new Response(
          JSON.stringify({ success: true, data: formatted }),
          { status: 200, headers }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers }
        );
      }
    } else if (req.method === 'POST') {
      // Add a comment
      try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
          return new Response(
            JSON.stringify({ success: false, error: 'Unauthorized' }),
            { status: 401, headers }
          );
        }
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        if (userError || !user) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid token' }),
            { status: 401, headers }
          );
        }
        const body = await req.json();
        if (!body.text || !body.text.trim()) {
          return new Response(
            JSON.stringify({ success: false, error: 'Comment text required' }),
            { status: 400, headers }
          );
        }
        // Insert comment
        const { data: comment, error: dbError } = await supabase
          .from('comments')
          .insert({
            observation_id: obsId,
            user_id: user.id,
            text: body.text,
          })
          .select()
          .single();
        if (dbError) {
          return new Response(
            JSON.stringify({ success: false, error: dbError.message }),
            { status: 500, headers }
          );
        }
        // Fetch observation to get owner
        const { data: obs, error: obsError } = await supabase
          .from('observations')
          .select('id, user_id')
          .eq('id', obsId)
          .single();
        if (!obsError && obs && obs.user_id !== user.id) {
          // Create notification for owner
          await supabase
            .from('notifications')
            .insert({
              user_id: obs.user_id,
              observation_id: obsId,
              comment_id: comment.id,
              type: 'new_comment',
              message: `${user.username || user.email || 'Someone'} commented on your observation`,
            });
        }
        // Return new comment
        return new Response(
          JSON.stringify({ success: true, data: comment }),
          { status: 201, headers }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers }
      );
    }
  }

  // --- Observations ---
  // 1. Handle Single Observation GET (Move this OUT of the list check)
  if (path.match(/^\/observations\/[\w-]+$/) && req.method === 'GET') {
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

      const lepImg = images?.find(i => i.image_type === 'lepidoptera');
      const plantImg = images?.find(i => i.image_type === 'plant');

      // Get comments with user info
      const { data: comments } = await supabase
        .from('comments')
        .select('id, text, created_at, user_id, user:profiles(id, username, name, avatar_url)')
        .eq('observation_id', obsId)
        .order('created_at', { ascending: true });

      const formattedComments = (comments || []).map(c => ({
        id: c.id,
        text: c.text,
        createdAt: c.created_at,
        userId: c.user_id,
        userName: c.user?.username || c.user?.name || 'Unknown',
        userAvatar: c.user?.avatar_url || null,
      }));

      // Compose response
      const enriched = {
        ...obs,
        user: userProfile || null,
        lepidoptera_image_url: lepImg ? lepImg.image_url : null,
        plant_image_url: plantImg ? plantImg.image_url : null,
        image_url: lepImg ? lepImg.image_url : (plantImg ? plantImg.image_url : null),
        comments: formattedComments,
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

  // 2. Handle Observations List (GET) and Create (POST)
  if (path === '/observations') {
    if (req.method === 'GET') {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const userId = url.searchParams.get('userId');
        const limit = parseInt(url.searchParams.get('limit') || '50', 10);
        
        let query = supabase
          .from('observations')
          .select(`*,
            lepidoptera:lepidoptera_taxonomy(scientific_name, common_name, family),
            plant:plant_taxonomy(scientific_name, common_name, family)
          `)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (userId) {
          query = query.eq('user_id', userId);
        }

        const { data: observations, error } = await query;

        if (error) throw error;

        // ... (Keep existing image fetching logic for list) ...
        // Fetch user profiles separately
        const userIds = [...new Set(observations.map(o => o.user_id).filter(Boolean))];
        const profilesMap = new Map();
        if (userIds.length > 0) {
            const { data: profileData } = await supabase
            .from('profiles')
            .select('id, name, username, avatar_url')
            .in('id', userIds);
            if (profileData) {
            for (const p of profileData) {
                profilesMap.set(p.id, p);
            }
            }
        }

        // Fetch images
        const obsIds = observations.map(o => o.id);
        let imagesMap = new Map();
        if (obsIds.length > 0) {
            const { data: imagesData } = await supabase
            .from('observation_images')
            .select('observation_id, image_url, image_type')
            .in('observation_id', obsIds);
            if (imagesData) {
            for (const img of imagesData) {
                if (!imagesMap.has(img.observation_id)) imagesMap.set(img.observation_id, []);
                imagesMap.get(img.observation_id).push(img);
            }
            }
        }

        const enrichedObservations = observations.map(obs => {
            const images = imagesMap.get(obs.id) || [];
            const lepImg = images.find(i => i.image_type === 'lepidoptera');
            const plantImg = images.find(i => i.image_type === 'plant');
            return {
            ...obs,
            user: profilesMap.get(obs.user_id) || null,
            lepidoptera_image_url: lepImg ? lepImg.image_url : null,
            plant_image_url: plantImg ? plantImg.image_url : null,
            image_url: lepImg ? lepImg.image_url : (plantImg ? plantImg.image_url : null)
            };
        });

        return new Response(
          JSON.stringify({ success: true, data: enrichedObservations }),
          { status: 200, headers }
        );
      } catch (error: any) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers }
        );
      }
    } else if (req.method === 'POST') {
       // ... (Keep your existing POST logic exactly as it is) ...
       // (Copy the POST block from your original file here)
       // ...
    }
  }

  // 404 for unknown routes
  return new Response(
    JSON.stringify({ error: 'Not found', path }),
    { status: 404, headers }
  );
});
