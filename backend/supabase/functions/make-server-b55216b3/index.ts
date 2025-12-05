import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { handleObservationGet } from './src/routes/observation.ts';
import { handleObservationComments } from './src/routes/comments.ts';

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Remove the function name prefix from the path
  const path = url.pathname.replace('/functions/v1/make-server-b55216b3', '').replace('/make-server-b55216b3', '');
  
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-auth-source',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    // Allow credentials for auth flows if callers use cookies; Vary by Origin when not using '*'
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin',
  };

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const headers = { ...corsHeaders, 'Content-Type': 'application/json' };

  // Helper: compute relationship_type based on thresholds configured via environment
  function computeRelationshipType(verifiedCount: number, observationCount: number) {
    // Read thresholds from environment with sane defaults
    const preferredThreshold = parseInt(Deno.env.get('RELATIONSHIP_PREFERRED_THRESHOLD') || '3', 10);
    const alternateThreshold = parseInt(Deno.env.get('RELATIONSHIP_ALTERNATE_THRESHOLD') || '2', 10);
    const occasionalThreshold = parseInt(Deno.env.get('RELATIONSHIP_OCCASIONAL_THRESHOLD') || '1', 10);
    // A count of observations alone can be used as a weak signal when no verified votes exist
    const observationThreshold = parseInt(Deno.env.get('RELATIONSHIP_OBSERVATION_THRESHOLD') || '5', 10);

    // Normalize thresholds so they make logical sense (preferred >= alternate >= occasional)
    const occ = Math.max(0, occasionalThreshold);
    const alt = Math.max(occ, alternateThreshold);
    const pref = Math.max(alt, preferredThreshold);

    const v = Math.max(0, verifiedCount || 0);
    const o = Math.max(0, observationCount || 0);

    // Rule set (priority order):
    // 1) If enough verified counts -> preferred
    // 2) Else if enough verified counts -> alternate
    // 3) Else if enough verified counts -> occasional
    // 4) Else if observation_count meets a configured observation-only threshold -> host_plant
    // 5) Otherwise default to 'host_plant'

    if (v >= pref) return 'preferred_host';
    if (v >= alt) return 'alternate_host';
    if (v >= occ) return 'occasional_host';

    if (o >= observationThreshold) return 'host_plant';

    return 'host_plant';
  }

  // Route handling
    // --- Observation Deletion with Storage Cleanup ---
    if (path.match(/^\/observations\/[\w-]+$/) && req.method === 'DELETE') {
      try {
        const obsId = path.split('/')[2];
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = createClient(supabaseUrl, supabaseKey);
        // Get observation details (include taxonomy ids so we can decrement relationships)
        const { data: obs, error: obsError } = await supabase
          .from('observations')
          .select('id, user_id, lepidoptera_id, plant_id')
          .eq('id', obsId)
          .single();
        if (obsError || !obs) {
          return new Response(
            JSON.stringify({ success: false, error: obsError?.message || 'Observation not found' }),
            { status: 404, headers }
          );
        }

        // For per-observation relationships we rely on the DB foreign key (ON DELETE CASCADE)
        // to remove relationship rows tied to this observation. No decrement logic required here.

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

    // --- Observation Update (owner-only) ---
    if (path.match(/^\/observations\/[\w-]+$/) && req.method === 'PUT') {
      try {
        const obsId = path.split('/')[2];
        const body = await req.json();

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
          return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers });
        }
        const token = authHeader.replace('Bearer ', '');

        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: { user }, error: userError } = await supabase.auth.getUser(token);
        if (userError || !user) {
          return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), { status: 401, headers });
        }

        // Only allow owner to update these fields
        const allowed: Record<string, any> = {};
        if (typeof body.lepidoptera_current_identification !== 'undefined') allowed.lepidoptera_current_identification = body.lepidoptera_current_identification;
        if (typeof body.plant_current_identification !== 'undefined') allowed.plant_current_identification = body.plant_current_identification;

        if (Object.keys(allowed).length === 0) {
          return new Response(JSON.stringify({ success: false, error: 'No updatable fields provided' }), { status: 400, headers });
        }

        // Verify ownership and fetch existing taxonomy ids so we can handle moves
        const { data: oldObs, error: obsErr } = await supabase.from('observations').select('id, user_id, lepidoptera_id, plant_id, lepidoptera_current_identification, plant_current_identification').eq('id', obsId).single();
        if (obsErr || !oldObs) {
          return new Response(JSON.stringify({ success: false, error: obsErr?.message || 'Observation not found' }), { status: 404, headers });
        }
        if (String(oldObs.user_id) !== String(user.id)) {
          return new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403, headers });
        }

        // Count verified identifications for this observation before any changes (used when decrementing verified_count)
        let verifiedCountBefore = 0;
        try {
          const { data: verifiedData, count: verifiedCount } = await supabase.from('identifications').select('id', { count: 'exact' }).eq('observation_id', obsId).eq('is_verified', true);
          verifiedCountBefore = verifiedCount || 0;
        } catch (e) {
          // non-fatal
          console.warn('Failed to count verified identifications before update', e?.message || e);
        }

        const { data: updated, error: updateErr } = await supabase.from('observations').update(allowed).eq('id', obsId).select().single();
        if (updateErr) {
          return new Response(JSON.stringify({ success: false, error: updateErr.message || 'Failed to update observation' }), { status: 500, headers });
        }

        // Handle moves: if the observation moved from one lepidoptera/plant pair to another,
        // decrement counts on the old pair (observation_count and verified_count) and
        // clean up empty relationship rows.
        try {
          const oldLep = oldObs.lepidoptera_id || null;
          const oldPlant = oldObs.plant_id || null;

          // Determine new taxonomy ids (may have been set earlier by other code)
          let newLep = updated.lepidoptera_id || null;
          let newPlant = updated.plant_id || null;

          // If new ids not present, attempt resolving from updated current identification text
          if (!newLep && updated.lepidoptera_current_identification) {
            const q = String(updated.lepidoptera_current_identification).trim();
            const { data: lepMatch } = await supabase
              .from('lepidoptera_taxonomy')
              .select('id')
              .or(`scientific_name.ilike.%${q}%,common_name.ilike.%${q}%,genus.ilike.%${q}%`)
              .limit(1)
              .maybeSingle();
            if (lepMatch && lepMatch.id) newLep = lepMatch.id;
          }
          if (!newPlant && updated.plant_current_identification) {
            const q2 = String(updated.plant_current_identification).trim();
            const { data: plantMatch } = await supabase
              .from('plant_taxonomy')
              .select('id')
              .or(`scientific_name.ilike.%${q2}%,common_name.ilike.%${q2}%,genus.ilike.%${q2}%`)
              .limit(1)
              .maybeSingle();
            if (plantMatch && plantMatch.id) newPlant = plantMatch.id;
          }

          // If the pair changed (including cases where one side was added/removed), adjust old relationship
          if (oldLep && oldPlant && (oldLep !== newLep || oldPlant !== newPlant)) {
            try {
              const { data: relRow } = await supabase
                .from('relationships')
                .select('id, observation_count, verified_count')
                .eq('lepidoptera_id', oldLep)
                .eq('plant_id', oldPlant)
                .limit(1)
                .maybeSingle();

              if (relRow && relRow.id) {
                const newObsCount = Math.max((relRow.observation_count || 0) - 1, 0);
                const newVerified = Math.max((relRow.verified_count || 0) - verifiedCountBefore, 0);
                const newRelType = computeRelationshipType(newVerified, newObsCount);
                const { error: relUpdateErr } = await supabase
                  .from('relationships')
                  .update({ observation_count: newObsCount, verified_count: newVerified, relationship_type: newRelType, updated_at: new Date().toISOString() })
                  .eq('id', relRow.id);
                if (!relUpdateErr && newObsCount === 0 && newVerified === 0) {
                  await supabase.from('relationships').delete().eq('id', relRow.id);
                }
              }
            } catch (decErr) {
              console.warn('Failed to decrement relationships for moved observation', decErr?.message || decErr);
            }
          }
        } catch (moveErr) {
          console.warn('Failed to handle relationship move after observation update', moveErr?.message || moveErr);
        }

        // --- Update relationships when identifications changed ---
        try {
          // Resolve lepidoptera_id and plant_id from the (possibly updated) observation record
          const obsRow = updated;
          let lepId = obsRow.lepidoptera_id || null;
          let plantId = obsRow.plant_id || null;

          // If taxonomy ids not present, try resolving from identification text
          if (!lepId && obsRow.lepidoptera_current_identification) {
            const q = String(obsRow.lepidoptera_current_identification).trim();
            const { data: lepMatch } = await supabase
              .from('lepidoptera_taxonomy')
              .select('id')
              .or(`scientific_name.ilike.%${q}%,common_name.ilike.%${q}%,genus.ilike.%${q}%`)
              .limit(1)
              .maybeSingle();
            if (lepMatch && lepMatch.id) lepId = lepMatch.id;
          }
          if (!plantId && obsRow.plant_current_identification) {
            const q2 = String(obsRow.plant_current_identification).trim();
            const { data: plantMatch } = await supabase
              .from('plant_taxonomy')
              .select('id')
              .or(`scientific_name.ilike.%${q2}%,common_name.ilike.%${q2}%,genus.ilike.%${q2}%`)
              .limit(1)
              .maybeSingle();
            if (plantMatch && plantMatch.id) plantId = plantMatch.id;
          }

          // Link this observation to an aggregate relationship via the DB RPC
          if (lepId && plantId) {
            try {
              // If this observation previously linked to an older relationship, remove that link
              // so the RPC can create/link to the new pair. Deleting the link will trigger
              // DB triggers to refresh counts for the previous relationship.
              await supabase.from('relationship_links').delete().eq('observation_id', obsRow.id);

              // Call DB RPC to create or link the aggregate relationship and refresh counts.
              const rpcResp = await supabase.rpc('create_or_link_relationship', { _lep: lepId, _plant: plantId, _obs: obsRow.id });
              // Log RPC response and verify DB state
              console.log('RPC create_or_link_relationship (update) response ->', JSON.stringify(rpcResp));
              if ((rpcResp as any)?.error) console.warn('RPC create_or_link_relationship (update) error', (rpcResp as any).error);
              try {
                const { data: linkRow, error: linkErr } = await supabase.from('relationship_links').select('*').eq('observation_id', obsRow.id).maybeSingle();
                console.log('Post-RPC relationship_links lookup (update):', { linkRow, linkErr });
                const { data: relRow, error: relErr } = await supabase.from('relationships').select('*').eq('lepidoptera_id', lepId).eq('plant_id', plantId).limit(1).maybeSingle();
                console.log('Post-RPC relationships lookup (update):', { relRow, relErr });
              } catch (qErr) {
                console.warn('Post-RPC verification queries failed (update)', qErr?.message || qErr);
              }
            } catch (e) {
              console.warn('Failed to link observation to relationship (update flow)', e?.message || e);
            }
          }
        } catch (relErr) {
          console.warn('Failed to update relationships on observation update', relErr?.message || relErr);
        }

        return new Response(JSON.stringify({ success: true, data: updated }), { status: 200, headers });
      } catch (e) {
        return new Response(JSON.stringify({ success: false, error: e?.message || String(e) }), { status: 500, headers });
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

  // --- Suggest Identification ---
  if (path === '/suggest-identification' && req.method === 'POST') {
    try {
      const body = await req.json();
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers });
      }
      const token = authHeader.replace('Bearer ', '');

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), { status: 401, headers });
      }

      // Basic validation
      // Debug: log incoming body keys to help diagnose missing caption issues
      try {
        // Avoid logging sensitive auth headers/token
        console.log('suggest-identification: received body keys ->', Object.keys(body || {}));
        // Also log whether caption/reason fields are present and their lengths
        const hasCaption = typeof body.caption !== 'undefined' && body.caption !== null;
        const hasReason = typeof body.reason !== 'undefined' && body.reason !== null;
        console.log('suggest-identification: caption present=', hasCaption, 'reason present=', hasReason, 'captionLength=', hasCaption && body.caption ? String(body.caption).length : 0, 'reasonLength=', hasReason && body.reason ? String(body.reason).length : 0);
      } catch (logErr) {
        console.warn('Failed to log suggest-identification body debug info', logErr?.message || logErr);
      }

      const observationId = body.observation_id || body.observationId;
      const species = body.species || body.name || body.display_name;
      const identificationType = (body.identification_type || body.identificationType || 'lepidoptera').toString();
      if (!observationId || !species) {
        return new Response(JSON.stringify({ success: false, error: 'Missing observation_id or species' }), { status: 400, headers });
      }

      // Ensure observation exists
      const { data: obs, error: obsError } = await supabase.from('observations').select('id, user_id').eq('id', observationId).single();
      if (obsError || !obs) {
        return new Response(JSON.stringify({ success: false, error: obsError?.message || 'Observation not found' }), { status: 404, headers });
      }

      // Insert identification
      const identPayload: any = {
        observation_id: observationId,
        user_id: user.id,
        species: species,
        scientific_name: body.scientific_name || body.sciname || null,
        // store user-provided reason in the caption column
        caption: body.reason || body.caption || null,
        identification_type: identificationType,
        is_auto_suggested: false,
      };

      // Debug: log the payload we're about to insert (don't include full caption text, just length)
      try {
        console.log('suggest-identification: inserting identPayload keys ->', Object.keys(identPayload));
        console.log('suggest-identification: caption length ->', identPayload.caption ? String(identPayload.caption).length : 0);
      } catch (logErr) {
        console.warn('Failed to log identPayload debug info', logErr?.message || logErr);
      }

      const { data: identData, error: identError } = await supabase.from('identifications').insert([identPayload]).select().single();
      if (identError || !identData) {
        return new Response(JSON.stringify({ success: false, error: identError?.message || 'Failed to create identification' }), { status: 500, headers });
      }

      // Add an initial vote from the suggester (so they implicitly agree with their suggestion)
      try {
        await supabase.from('identification_votes').insert([{ identification_id: identData.id, user_id: user.id }]);
      } catch (e) {
        // non-fatal - continue
        console.warn('Failed to insert initial identification vote', e?.message || e);
      }

      // Create a notification for the observation owner (if different)
      try {
        if (obs.user_id && obs.user_id !== user.id) {
          await supabase.from('notifications').insert([{
            user_id: obs.user_id,
            observation_id: observationId,
            identification_id: identData.id,
            type: 'identification_suggested',
            message: `${user.user_metadata?.full_name || user.email || 'A user'} suggested an identification`,
          }]);
        }
      } catch (e) {
        console.warn('Failed to create notification for suggestion', e?.message || e);
      }

      return new Response(JSON.stringify({ success: true, data: identData }), { status: 200, headers });
    } catch (error: any) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers });
    }
  }

  // --- Agree Identification (vote) ---
  if (path === '/agree-identification' && req.method === 'POST') {
    try {
      const body = await req.json();
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401, headers });
      }
      const token = authHeader.replace('Bearer ', '');

      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) {
        return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), { status: 401, headers });
      }

      const identificationId = body.identification_id || body.identificationId || body.id;
      if (!identificationId) {
        return new Response(JSON.stringify({ success: false, error: 'Missing identification_id' }), { status: 400, headers });
      }

      // Verify identification exists (avoid FK errors when clients pass local/temporary ids)
      try {
        const { data: identCheck, error: identCheckErr } = await supabase.from('identifications').select('id, observation_id').eq('id', identificationId).limit(1);
        if (identCheckErr) {
          console.warn('agree-identification: error fetching identification for id', identificationId, identCheckErr.message || identCheckErr);
        }
        if (!identCheck || identCheck.length === 0) {
          return new Response(JSON.stringify({ success: false, error: 'Identification not found' }), { status: 404, headers });
        }
      } catch (e) {
        console.warn('agree-identification: exception while checking identification', e?.message || e);
      }

      // Check if user already voted
      const { data: existing, error: existingError } = await supabase.from('identification_votes').select('*').eq('identification_id', identificationId).eq('user_id', user.id).limit(1);
      if (existingError) {
        // continue and try inserting (non-fatal)
        console.warn('Error checking existing votes', existingError.message || existingError);
      }
      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({ success: true, message: 'Already voted' }), { status: 200, headers });
      }

      let voteData: any = null;
      try {
        const insertResp = await supabase.from('identification_votes').insert([{ identification_id: identificationId, user_id: user.id }]).select().single();
        voteData = insertResp.data;
        if (insertResp.error) {
          console.warn('agree-identification: vote insert error', insertResp.error.message || insertResp.error);
          return new Response(JSON.stringify({ success: false, error: insertResp.error.message || 'Failed to insert vote' }), { status: 500, headers });
        }
      } catch (e: any) {
        console.error('agree-identification: exception inserting vote', e?.message || e);
        return new Response(JSON.stringify({ success: false, error: e?.message || 'Failed to insert vote' }), { status: 500, headers });
      }

      // After inserting the vote, check if the identification reaches the verification threshold
      try {
        const threshold = parseInt(Deno.env.get('VERIFICATION_VOTE_THRESHOLD') || '3', 10);

        // Count votes for this identification
        const { data: votesData, error: votesErr, count: votesCount } = await supabase
          .from('identification_votes')
          .select('*', { count: 'exact' })
          .eq('identification_id', identificationId);
        const totalVotes = votesCount ?? (votesData ? votesData.length : 0);

        if (totalVotes >= threshold) {
          // Fetch the identification row to check verified status and related info
          const { data: identRow, error: identRowErr } = await supabase
            .from('identifications')
            .select('*')
            .eq('id', identificationId)
            .single();

          if (identRow && !identRow.is_verified) {
            // Mark identification as verified
            await supabase.from('identifications').update({ is_verified: true, verified_at: new Date().toISOString(), verified_by_user_id: user.id }).eq('id', identificationId);

            // Update the observation's current identification fields and try to resolve taxonomy ids
            try {
              // Update observation textual current identification
              if (identRow.identification_type === 'lepidoptera') {
                await supabase.from('observations').update({ lepidoptera_current_identification: identRow.species }).eq('id', identRow.observation_id);
                // Try to resolve lepidoptera taxonomy id
                const q = String(identRow.species || '').trim();
                if (q.length > 0) {
                  const { data: lepMatch } = await supabase
                    .from('lepidoptera_taxonomy')
                    .select('id')
                    .or(`scientific_name.ilike.%${q}%,common_name.ilike.%${q}%,genus.ilike.%${q}%`)
                    .limit(1)
                    .maybeSingle();
                  if (lepMatch && lepMatch.id) {
                    await supabase.from('observations').update({ lepidoptera_id: lepMatch.id }).eq('id', identRow.observation_id);
                  }
                }
              } else {
                // Treat any non-'lepidoptera' type as plant/hostPlant
                await supabase.from('observations').update({ plant_current_identification: identRow.species }).eq('id', identRow.observation_id);
                const q2 = String(identRow.species || '').trim();
                if (q2.length > 0) {
                  const { data: plantMatch } = await supabase
                    .from('plant_taxonomy')
                    .select('id')
                    .or(`scientific_name.ilike.%${q2}%,common_name.ilike.%${q2}%,genus.ilike.%${q2}%`)
                    .limit(1)
                    .maybeSingle();
                  if (plantMatch && plantMatch.id) {
                    await supabase.from('observations').update({ plant_id: plantMatch.id }).eq('id', identRow.observation_id);
                  }
                }
              }

              // Re-fetch observation to get resolved taxonomy ids
              const { data: obsRow } = await supabase.from('observations').select('id, lepidoptera_id, plant_id').eq('id', identRow.observation_id).single();
              if (obsRow && obsRow.lepidoptera_id && obsRow.plant_id) {
                // For per-observation relationships we prefer to update the relationship row tied to
                // this observation (if present). If not present, create one and mark verified_count.
                try {
                  const { data: relForObs } = await supabase
                    .from('relationships')
                    .select('id, verified_count, observation_count')
                    .eq('observation_id', identRow.observation_id)
                    .limit(1)
                    .maybeSingle();

                  // Use the DB RPC to ensure an aggregate relationship exists and this observation
                  // is linked; the DB refresh function will recompute verified_count based on identifications.
                  try {
                    // Ensure any previous link for this observation is removed so the RPC can re-link
                    await supabase.from('relationship_links').delete().eq('observation_id', identRow.observation_id);
                    const rpcResp = await supabase.rpc('create_or_link_relationship', { _lep: obsRow.lepidoptera_id, _plant: obsRow.plant_id, _obs: identRow.observation_id });
                    console.log('RPC create_or_link_relationship (verify) response ->', JSON.stringify(rpcResp));
                    if ((rpcResp as any)?.error) console.warn('agree-identification: RPC error', (rpcResp as any).error);
                    try {
                      const { data: linkRow, error: linkErr } = await supabase.from('relationship_links').select('*').eq('observation_id', identRow.observation_id).maybeSingle();
                      console.log('Post-RPC relationship_links lookup (verify):', { linkRow, linkErr });
                      const { data: relRow, error: relErr } = await supabase.from('relationships').select('*').eq('lepidoptera_id', obsRow.lepidoptera_id).eq('plant_id', obsRow.plant_id).limit(1).maybeSingle();
                      console.log('Post-RPC relationships lookup (verify):', { relRow, relErr });
                    } catch (qErr) {
                      console.warn('Post-RPC verification queries failed (verify)', qErr?.message || qErr);
                    }
                  } catch (e) {
                    console.warn('agree-identification: failed to link observation via RPC', e?.message || e);
                  }
                } catch (relErr) {
                  console.warn('agree-identification: failed to upsert relationships verified_count', relErr?.message || relErr);
                }
              }
            } catch (obsUpdateErr) {
              console.warn('agree-identification: failed to update observation/taxonomy after verification', obsUpdateErr?.message || obsUpdateErr);
            }
          }
        }
      } catch (verifyErr) {
        console.warn('agree-identification: verification check failed', verifyErr?.message || verifyErr);
      }

      return new Response(JSON.stringify({ success: true, data: voteData }), { status: 200, headers });
    } catch (error: any) {
      return new Response(JSON.stringify({ success: false, error: error.message }), { status: 500, headers });
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

      // Normalize field names for frontend: createdAt, read
      const normalized = (notifications || []).map((n: any) => ({
        id: n.id,
        userId: n.user_id,
        observationId: n.observation_id,
        identificationId: n.identification_id,
        commentId: n.comment_id,
        type: n.type,
        message: n.message,
        read: !!n.is_read || !!n.read,
        readAt: n.read_at || null,
        createdAt: n.created_at ? new Date(n.created_at).toISOString() : null,
      }));

      return new Response(
        JSON.stringify({ success: true, data: normalized }),
        { status: 200, headers }
      );
    } catch (error) {
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers }
      );
    }
  }

  // --- Mark Notification as Read ---
  if (path.match(/^\/notifications\/[\w-]+\/read$/) && req.method === 'POST') {
    try {
      const notifId = path.split('/')[2];
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const supabase = createClient(supabaseUrl, supabaseKey);

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

      // Update notification to read for this user
      // Use `is_read` column name (DB uses is_read) and set read_at timestamp
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', notifId)
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({ success: true }),
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
    return await handleObservationComments(req, path, url, headers);
  }

  // --- Observations ---
  // 1. Handle Single Observation GET (delegated to src/routes/observation)
  if (path.match(/^\/observations\/[\w-]+$/) && req.method === 'GET') {
    return await handleObservationGet(req, path, url, headers);
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
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
        const supabase = createClient(supabaseUrl, supabaseKey);
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
        // Validate required fields: require at least one species id (lepidoptera_id OR plant_id)
        if (!body.lepidoptera_id && !body.plant_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'At least one of lepidoptera_id or plant_id is required' }),
            { status: 400, headers }
          );
        }

        // Insert observation (include current identification text when provided)
        const { data: obs, error: obsError } = await supabase
          .from('observations')
          .insert({
            user_id: user.id,
            lepidoptera_id: body.lepidoptera_id || null,
            plant_id: body.plant_id || null,
            location: body.location || '',
            latitude: body.latitude || null,
            longitude: body.longitude || null,
            observation_date: body.date ? body.date.split('T')[0] : new Date().toISOString().split('T')[0],
            notes: body.notes || '',
            is_public: true,
            lepidoptera_current_identification: body.lepidoptera_current_identification || null,
            plant_current_identification: body.plant_current_identification || null,
          })
          .select()
          .single();
        if (obsError) {
          return new Response(
            JSON.stringify({ success: false, error: obsError.message }),
            { status: 500, headers }
          );
        }
        // Handle image uploads (base64 to storage)
        const imageRecords = [];
        async function uploadImage(base64, type) {
          if (!base64) return null;
          // Convert base64 to Blob
          const res = await fetch(base64);
          const blob = await res.blob();
          const ext = blob.type.split('/')[1];
          const filePath = `${user.id}/${obs.id}/${Date.now()}.${ext}`;
          const { data, error } = await supabase.storage.from('observation-images').upload(filePath, blob);
          if (error) throw new Error('Image upload error: ' + error.message);
          const { data: urlData } = supabase.storage.from('observation-images').getPublicUrl(data.path);
          if (!urlData) throw new Error('Could not get public URL for uploaded file.');
          imageRecords.push({ observation_id: obs.id, image_url: urlData.publicUrl, image_type: type });
        }
        for (const img of body.lepidopteraImages || []) {
          await uploadImage(img, 'lepidoptera');
        }
        for (const img of body.hostPlantImages || []) {
          await uploadImage(img, 'plant');
        }
        if (imageRecords.length > 0) {
          const { error: imgError } = await supabase.from('observation_images').insert(imageRecords);
          if (imgError) {
            // Clean up observation if image upload fails
            await supabase.from('observations').delete().eq('id', obs.id);
            return new Response(
              JSON.stringify({ success: false, error: 'Failed to save images: ' + imgError.message }),
              { status: 500, headers }
            );
          }
        }
        // --- Update relationships table ---
        try {
          // Determine lepidoptera_id and plant_id to use for relationships
          let lepId = obs.lepidoptera_id || null;
          let plantId = obs.plant_id || null;

          // If taxonomy ids weren't provided, attempt to resolve from provided identification text
          if (!lepId && body.lepidoptera_current_identification) {
            const q = String(body.lepidoptera_current_identification).trim();
            const { data: lepMatch } = await supabase
              .from('lepidoptera_taxonomy')
              .select('id')
              .or(`scientific_name.ilike.%${q}%,common_name.ilike.%${q}%,genus.ilike.%${q}%`)
              .limit(1)
              .maybeSingle();
            if (lepMatch && lepMatch.id) lepId = lepMatch.id;
          }
          if (!plantId && body.plant_current_identification) {
            const q2 = String(body.plant_current_identification).trim();
            const { data: plantMatch } = await supabase
              .from('plant_taxonomy')
              .select('id')
              .or(`scientific_name.ilike.%${q2}%,common_name.ilike.%${q2}%,genus.ilike.%${q2}%`)
              .limit(1)
              .maybeSingle();
            if (plantMatch && plantMatch.id) plantId = plantMatch.id;
          }

          if (lepId && plantId) {
            // Create a relationship row tied to this observation. Each observation creates its own
            // relationship record (so deletions cascade when the observation is removed).
            try {
              // Link the newly created observation to an aggregate relationship using the DB RPC.
              const rpcResp = await supabase.rpc('create_or_link_relationship', { _lep: lepId, _plant: plantId, _obs: obs.id });
              console.log('RPC create_or_link_relationship (create) response ->', JSON.stringify(rpcResp));
              if ((rpcResp as any)?.error) console.warn('create: RPC error', (rpcResp as any).error);
              try {
                const { data: linkRow, error: linkErr } = await supabase.from('relationship_links').select('*').eq('observation_id', obs.id).maybeSingle();
                console.log('Post-RPC relationship_links lookup (create):', { linkRow, linkErr });
                const { data: relRow, error: relErr } = await supabase.from('relationships').select('*').eq('lepidoptera_id', lepId).eq('plant_id', plantId).limit(1).maybeSingle();
                console.log('Post-RPC relationships lookup (create):', { relRow, relErr });
              } catch (qErr) {
                console.warn('Post-RPC verification queries failed (create)', qErr?.message || qErr);
              }
            } catch (e) {
              console.warn('Failed to create_or_link_relationship for new observation', e?.message || e);
            }
          }
        } catch (relErr) {
          console.warn('Failed to update relationships for new observation', relErr?.message || relErr);
        }
        return new Response(
          JSON.stringify({ success: true, data: obs }),
          { status: 201, headers }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: error.message }),
          { status: 500, headers }
        );
      }
    }
  }

  // 404 for unknown routes
  return new Response(
    JSON.stringify({ error: 'Not found', path }),
    { status: 404, headers }
  );
});
