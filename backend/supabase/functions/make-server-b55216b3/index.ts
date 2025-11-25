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
    return new Response(
      JSON.stringify({ success: true, data: [] }),
      { status: 200, headers }
    );
  }

  // 404 for unknown routes
  return new Response(
    JSON.stringify({ error: 'Not found', path }),
    { status: 404, headers }
  );
});
