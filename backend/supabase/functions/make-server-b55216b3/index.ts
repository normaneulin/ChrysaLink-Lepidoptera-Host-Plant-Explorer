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
  if (path === '/observations') {
    if (req.method === 'GET') {
      // List observations or get single observation with comments
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // If path is /observations/{id}, return single observation with comments
        if (path.match(/^\/observations\/[\w-]+$/)) {
          const obsId = path.split('/')[2];
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
        }

        // Otherwise, list observations
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
        if (error) {
          console.error('Fetch observations error:', error);
          throw error;
        }
        if (!observations || observations.length === 0) {
          return new Response(
            JSON.stringify({ success: true, data: [] }),
            { status: 200, headers }
          );
        }
        // Fetch user profiles separately to avoid join issues
        const userIds = [...new Set(observations.map(o => o.user_id).filter(Boolean))];
        const profilesMap = new Map();
        if (userIds.length > 0) {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, name, username, avatar_url')
            .in('id', userIds);
          if (profileError) {
            console.warn('Could not fetch profiles:', profileError.message);
          } else if (profileData) {
            for (const p of profileData) {
              profilesMap.set(p.id, p);
            }
          }
        }
        // Fetch images for all observations
        const obsIds = observations.map(o => o.id);
        let imagesMap = new Map();
        if (obsIds.length > 0) {
          const { data: imagesData, error: imagesError } = await supabase
            .from('observation_images')
            .select('observation_id, image_url, image_type')
            .in('observation_id', obsIds);
          if (!imagesError && imagesData) {
            for (const img of imagesData) {
              if (!imagesMap.has(img.observation_id)) imagesMap.set(img.observation_id, []);
              imagesMap.get(img.observation_id).push(img);
            }
          }
        }
        // Attach user profiles and image URLs to observations
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
        console.error('Observations GET error:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers }
        );
      }
    } else if (req.method === 'POST') {
      // Create observation
      try {
        const body = await req.json();
        console.log('Creating observation:', body);
        console.log('Received lepidopteraImages:', body.lepidopteraImages);
        console.log('Received hostPlantImages:', body.hostPlantImages);
        
        // Get user from auth header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
          return new Response(
            JSON.stringify({ success: false, error: 'Unauthorized' }),
            { status: 401, headers }
          );
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Parse JWT to get user ID
        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        
        if (userError || !user) {
          return new Response(
            JSON.stringify({ success: false, error: 'Invalid token' }),
            { status: 401, headers }
          );
        }

        // Look up taxonomy IDs from species names
        let lepidopteraId = null;
        let plantId = null;

        if (body.lepidopteraSpecies) {
          console.log('Looking up lepidoptera:', body.lepidopteraSpecies);
          
          // Try multiple lookups - scientific_name first, then genus, family, division
          let { data: lepResults, error: lepError } = await supabase
            .from('lepidoptera_taxonomy')
            .select('id, scientific_name')
            .eq('scientific_name', body.lepidopteraSpecies)
            .limit(1);
          
          if (!lepResults || lepResults.length === 0) {
            // Try genus
            lepResults = (await supabase
              .from('lepidoptera_taxonomy')
              .select('id, scientific_name')
              .eq('genus', body.lepidopteraSpecies)
              .limit(1)).data;
          }
          
          if (!lepResults || lepResults.length === 0) {
            // Try family
            lepResults = (await supabase
              .from('lepidoptera_taxonomy')
              .select('id, scientific_name')
              .eq('family', body.lepidopteraSpecies)
              .limit(1)).data;
          }
          
          if (!lepResults || lepResults.length === 0) {
            // Try division
            lepResults = (await supabase
              .from('lepidoptera_taxonomy')
              .select('id, scientific_name')
              .eq('division', body.lepidopteraSpecies)
              .limit(1)).data;
          }
          
          console.log('Lepidoptera lookup result:', lepResults, lepError);
          
          if (lepResults && lepResults.length > 0) {
            lepidopteraId = lepResults[0].id;
            console.log('Found lepidoptera ID:', lepidopteraId, 'for', lepResults[0].scientific_name);
          } else {
            console.log('No lepidoptera found for:', body.lepidopteraSpecies);
          }
        }

        if (body.hostPlantSpecies) {
          console.log('Looking up plant:', body.hostPlantSpecies);
          
          // Try multiple lookups
          let { data: plantResults, error: plantError } = await supabase
            .from('plant_taxonomy')
            .select('id, scientific_name')
            .eq('scientific_name', body.hostPlantSpecies)
            .limit(1);
          
          if (!plantResults || plantResults.length === 0) {
            plantResults = (await supabase
              .from('plant_taxonomy')
              .select('id, scientific_name')
              .eq('genus', body.hostPlantSpecies)
              .limit(1)).data;
          }
          
          if (!plantResults || plantResults.length === 0) {
            plantResults = (await supabase
              .from('plant_taxonomy')
              .select('id, scientific_name')
              .eq('family', body.hostPlantSpecies)
              .limit(1)).data;
          }
          
          if (!plantResults || plantResults.length === 0) {
            plantResults = (await supabase
              .from('plant_taxonomy')
              .select('id, scientific_name')
              .eq('division', body.hostPlantSpecies)
              .limit(1)).data;
          }
          
          console.log('Plant lookup result:', plantResults, plantError);
          
          if (plantResults && plantResults.length > 0) {
            plantId = plantResults[0].id;
            console.log('Found plant ID:', plantId, 'for', plantResults[0].scientific_name);
          } else {
            console.log('No plant found for:', body.hostPlantSpecies);
          }
        }

        // Create observation record
        const { data: observation, error: dbError } = await supabase
          .from('observations')
          .insert({
            user_id: user.id,
            lepidoptera_id: lepidopteraId,
            plant_id: plantId,
            observation_date: body.date,
            location: body.location || 'Unknown',
            latitude: body.latitude || 0,
            longitude: body.longitude || 0,
            notes: body.notes,
            is_public: true,
            lepidoptera_current_identification: body.lepidoptera_current_identification,
            plant_current_identification: body.plant_current_identification,
          })
          .select()
          .single();

        if (dbError) {
          console.error('Database error:', dbError);
          return new Response(
            JSON.stringify({ success: false, error: dbError.message }),
            { status: 500, headers }
          );
        }
        
        // Handle image uploads
        const uploadImage = async (base64, type) => {
          try {
            if (!base64 || !base64.startsWith('data:image')) {
              console.error(`Invalid base64 image data for ${type}`);
              return null;
            }
            const fileName = `${user.id}/${observation.id}/${type}-${Date.now()}.jpg`;
            // Deno-compatible base64 decoding
            const base64Data = base64.split(',')[1];
            const decodedImage = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('observation-images')
              .upload(fileName, decodedImage, {
                contentType: 'image/jpeg',
                upsert: true,
              });
            if (uploadError) {
              console.error(`Error uploading ${type} image:`, uploadError);
              return null;
            }
            const { data: urlData, error: urlError } = supabase.storage.from('observation-images').getPublicUrl(fileName);
            if (urlError || !urlData?.publicUrl) {
              console.error(`Error getting public URL for ${type} image:`, urlError);
              return null;
            }
            return {
              storage_path: fileName,
              image_url: urlData.publicUrl,
            };
          } catch (err) {
            console.error(`Exception during ${type} image upload:`, err);
            return null;
          }
        };

        const imageUploadPromises = [];
        if (body.lepidopteraImages) {
          for (const base64 of body.lepidopteraImages) {
            imageUploadPromises.push(uploadImage(base64, 'lepidoptera'));
          }
        }
        if (body.hostPlantImages) {
          for (const base64 of body.hostPlantImages) {
            imageUploadPromises.push(uploadImage(base64, 'plant'));
          }
        }
        
        const uploadedImages = await Promise.all(imageUploadPromises);
        
        const imageRecords = uploadedImages
          .filter(img => img !== null)
          .map((img, index) => ({
            observation_id: observation.id,
            image_url: img.image_url,
            storage_path: img.storage_path,
            image_type: index < (body.lepidopteraImages?.length || 0) ? 'lepidoptera' : 'plant',
          }));
        
        if (imageRecords.length > 0) {
          const { error: imageInsertError, data: imageInsertData } = await supabase
            .from('observation_images')
            .insert(imageRecords);
          if (imageInsertError) {
            console.error('Error inserting image records:', imageInsertError);
            console.error('Image records attempted:', JSON.stringify(imageRecords, null, 2));
            // Optionally handle this error, e.g., by deleting the observation
          } else {
            console.log('Successfully inserted image records:', imageInsertData);
          }
        }

        return new Response(
          JSON.stringify({ success: true, data: observation }),
          { status: 201, headers }
        );
      } catch (error: any) {
        console.error('Observation creation error:', error);
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers }
        );
      }
    }
    
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers }
    );
  }

  // 404 for unknown routes
  return new Response(
    JSON.stringify({ error: 'Not found', path }),
    { status: 404, headers }
  );
});
