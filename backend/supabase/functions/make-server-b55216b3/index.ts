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
  if (path === '/' || path === '') {
    return new Response(
      JSON.stringify({ status: 'ok', message: 'ChrysaLink API v17 - With Database' }),
      { status: 200, headers }
    );
  }

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

  if (path === '/notifications') {
    return new Response(
      JSON.stringify({ success: true, data: [] }),
      { status: 200, headers }
    );
  }

  if (path === '/observations') {
    if (req.method === 'GET') {
      // List observations
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Get optional userId filter
        const userId = url.searchParams.get('userId');

        let query = supabase
          .from('observations')
          .select(`
            *,
            lepidoptera:lepidoptera_taxonomy(scientific_name, common_name, family),
            plant:plant_taxonomy(scientific_name, common_name, family)
          `)
          .order('created_at', { ascending: false });

        if (userId) {
          query = query.eq('user_id', userId);
        }

        const { data: observations, error } = await query;

        if (error) {
          console.error('Fetch observations error:', error);
          return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers }
          );
        }

        // Fetch user profiles separately to avoid join issues
        const userIds = [...new Set(observations?.map(o => o.user_id).filter(Boolean))];
        let profiles = {};
        
        if (userIds.length > 0) {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, name, username, avatar_url')
            .in('id', userIds);
          
          if (profileData) {
            profiles = Object.fromEntries(profileData.map(p => [p.id, p]));
          }
        }

        // Attach user profiles to observations
        const enrichedObservations = observations?.map(obs => ({
          ...obs,
          user: profiles[obs.user_id] || null
        }));

        return new Response(
          JSON.stringify({ success: true, data: enrichedObservations || [] }),
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
            image_url: body.lepidopteraImage || body.hostPlantImage,
            lepidoptera_image_url: body.lepidopteraImage,
            plant_image_url: body.hostPlantImage,
            is_public: true,
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
