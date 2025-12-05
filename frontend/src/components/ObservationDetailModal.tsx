import { useState, useEffect, useMemo } from 'react';
//import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader,
  DialogTitle,
  DialogDescription 
} from './ui/dialog';
import * as RadixDialog from '@radix-ui/react-dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { CheckCircle, ArrowRightLeft, MapPin, Calendar, Clock } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';
import { apiClient } from '../api/client';
import { supabase } from '../lib/supabase';

interface ObservationDetailModalProps {
  observation: any;
  isOpen: boolean;
  onClose: () => void;
  accessToken?: string;
  currentUserId?: string;
  onUpdate: () => void;
}

export function ObservationDetailModal({
  observation,
  isOpen,
  onClose,
  accessToken,
  currentUserId,
  onUpdate
}: ObservationDetailModalProps) {
  
  // Fetch latest observation details
  const fetchObservationDetails = async () => {
    try {
      const response = await apiClient.get(`/observations/${observation.id}`, accessToken);
      if (response.success && response.data) {
        setLocalObservation(response.data);
        // Debug: log identification objects so we can verify which taxonomy fields are present
        // eslint-disable-next-line no-console
        console.debug('Fetched observation identifications (first 5):', (response.data.identifications || []).slice(0, 5));
        // Also log a compact view of relevant name fields for quick inspection
        try {
          const compact = (response.data.identifications || []).slice(0, 5).map((it: any) => ({
            id: it.id,
            species: it.species,
            common_name: it.common_name || it.comm_name || it.commonName || it.comname || (it.species && it.species.common_name) || null,
            scientific_name: it.scientific_name || it.scientificName || (it.species && (it.species.scientific_name || it.species.sciname || it.species.name)) || null,
            keys: Object.keys(it || {})
          }));
          // eslint-disable-next-line no-console
          console.debug('Identification name-fields summary:', compact);
        } catch (e) {
          // ignore
        }
        // Enrich identifications with taxonomy common name/scientific name when possible
        try {
          const idents = response.data.identifications || [];
          if (idents.length > 0) {
            // Collect taxon ids per table
            const idsByTable: Record<string, Set<any>> = { lepidoptera_taxonomy: new Set(), plant_taxonomy: new Set() };
            for (const it of idents) {
              const taxonId = it.taxon_id || it.taxonId || (it.species && it.species.id) || null;
              if (!taxonId) continue;
              const typeRaw = (it.identificationType || it.identification_type || it.subtype || it.type || '').toString().toLowerCase();
              const table = typeRaw.includes('plant') || typeRaw.includes('host') ? 'plant_taxonomy' : 'lepidoptera_taxonomy';
              idsByTable[table].add(taxonId);
            }

            const fetchedByTableId: Record<string, Record<string, any>> = { lepidoptera_taxonomy: {}, plant_taxonomy: {} };

            // Batch fetch per table
            for (const table of Object.keys(idsByTable)) {
              const ids = Array.from(idsByTable[table]);
              if (ids.length === 0) continue;
              // Query taxonomy rows
              const { data: rows, error } = await supabase
                .from(table)
                .select('id, common_name, comm_name, display_name, scientific_name, sciname, name')
                .in('id', ids as any[]);
              if (!error && rows && rows.length > 0) {
                for (const r of rows) {
                  fetchedByTableId[table][String(r.id)] = r;
                }
              }
            }

            // Merge fetched names into identifications
            let enriched = (response.data.identifications || []).map((it: any) => {
              const taxonId = it.taxon_id || it.taxonId || (it.species && it.species.id) || null;
              if (!taxonId) return it;
              const typeRaw = (it.identificationType || it.identification_type || it.subtype || it.type || '').toString().toLowerCase();
              const table = typeRaw.includes('plant') || typeRaw.includes('host') ? 'plant_taxonomy' : 'lepidoptera_taxonomy';
              const row = fetchedByTableId[table] ? fetchedByTableId[table][String(taxonId)] : null;
              if (row) {
                return {
                  ...it,
                  common_name: it.common_name || it.comm_name || it.commonName || it.comname || it.display_name || row.common_name || row.comm_name || row.display_name || null,
                  scientific_name: it.scientific_name || it.scientificName || row.scientific_name || row.sciname || row.name || null,
                };
              }
              return it;
            });

            // For identifications without a taxon_id, attempt to look up taxonomy via the same search used by the upload popover
            const namesToLookup: Record<string, { name: string; type: 'lepidoptera' | 'plant' }> = {};
            for (const it of enriched) {
              const taxonId = it.taxon_id || it.taxonId || (it.species && it.species.id) || null;
              if (taxonId) continue;
              const speciesName = (it.species && typeof it.species === 'string') ? it.species : (it.species && it.species.name ? it.species.name : null) || it.scientific_name || it.scientificName || null;
              if (!speciesName) continue;
              const typeRaw = (it.identificationType || it.identification_type || it.subtype || it.type || '').toString().toLowerCase();
              const t: 'lepidoptera' | 'plant' = typeRaw.includes('plant') || typeRaw.includes('host') ? 'plant' : 'lepidoptera';
              const key = `${t}::${speciesName}`;
              if (!namesToLookup[key]) namesToLookup[key] = { name: speciesName, type: t };
            }

            // Perform lookups using apiClient.searchSpecies to reuse the same logic as the upload popover
            const lookupResultsByKey: Record<string, any> = {};
            for (const k of Object.keys(namesToLookup)) {
              const { name, type } = namesToLookup[k];
              try {
                const resp = await apiClient.searchSpecies(name, type);
                if (resp && resp.success && Array.isArray(resp.data) && resp.data.length > 0) {
                  lookupResultsByKey[k] = resp.data[0];
                }
              } catch (e) {
                // ignore lookup failure for this name
              }
            }

            // Merge lookup results into enriched identifications
            enriched = enriched.map((it: any) => {
              const taxonId = it.taxon_id || it.taxonId || (it.species && it.species.id) || null;
              if (taxonId) return it;
              const speciesName = (it.species && typeof it.species === 'string') ? it.species : (it.species && it.species.name ? it.species.name : null) || it.scientific_name || it.scientificName || null;
              if (!speciesName) return it;
              const typeRaw = (it.identificationType || it.identification_type || it.subtype || it.type || '').toString().toLowerCase();
              const t: 'lepidoptera' | 'plant' = typeRaw.includes('plant') || typeRaw.includes('host') ? 'plant' : 'lepidoptera';
              const key = `${t}::${speciesName}`;
              const row = lookupResultsByKey[key];
              if (row) {
                return {
                  ...it,
                  common_name: it.common_name || it.comm_name || it.commonName || it.comname || it.display_name || row.common_name || row.comm_name || row.display_name || null,
                  scientific_name: it.scientific_name || it.scientificName || row.scientific_name || row.sciname || row.name || null,
                  taxon_id: it.taxon_id || it.taxonId || row.id || null,
                };
              }
              return it;
            });

            // Update local observation with enriched identifications
            setLocalObservation((prev: any) => ({ ...(prev || {}), identifications: enriched }));
          }
        } catch (e) {
          console.warn('Failed to enrich identifications with taxonomy rows', e);
        }
      }
    } catch (error) {
      // Optionally handle error
    }
  };

  // Fetch comments from Supabase and attach to localObservation
  const fetchCommentsFromSupabase = async () => {
    if (!observation?.id) return;
    try {
      // Prefer fetching comments from our backend edge function (returns comments with user info)
      try {
        const edgeResp = await apiClient.get(`/observations/${observation.id}/comments`, accessToken);
        if (edgeResp.success && Array.isArray(edgeResp.data)) {
          setLocalObservation((prev: any) => ({ ...(prev || {}), comments: edgeResp.data }));
          return;
        }
      } catch (e) {
        // ignore and fallback to direct Supabase fetch below
      }

      // Try to fetch comments with joined profile via PostgREST relationship.
      const res = await supabase
        .from('comments')
        .select('id, text, created_at, user_id, user:profiles(id, username, name, avatar_url)')
        .eq('observation_id', observation.id)
        .order('created_at', { ascending: true });

      // If the relationship select failed because the FK relationship isn't available
      // in the PostgREST schema cache, fall back to two-step fetch: comments then profiles.
      if (res.error) {
        const msg = String(res.error.message || res.error);
        if (msg.includes('Could not find a relationship') || msg.includes('relationship')) {
          // Fallback: fetch comments without join
          const { data: commentsOnly, error: commentsError } = await supabase
            .from('comments')
            .select('id, text, created_at, user_id')
            .eq('observation_id', observation.id)
            .order('created_at', { ascending: true });

          if (commentsError) {
            console.warn('Failed to fetch comments (fallback):', commentsError.message || commentsError);
            return;
          }

          const userIds = Array.from(new Set((commentsOnly || []).map((c: any) => c.user_id).filter(Boolean)));
          let profilesMap: Record<string, any> = {};
          if (userIds.length > 0) {
            const { data: profilesData, error: profilesError } = await supabase
              .from('profiles')
              .select('id, username, name, avatar_url')
              .in('id', userIds);

            if (!profilesError && profilesData) {
              profilesMap = (profilesData || []).reduce((acc: any, p: any) => {
                acc[p.id] = p;
                return acc;
              }, {} as Record<string, any>);
            }
          }

          const comments = (commentsOnly || []).map((c: any) => ({
            id: c.id,
            text: c.text,
            created_at: c.created_at,
            createdAt: c.created_at,
            userId: c.user_id,
            userName: profilesMap[c.user_id]?.username || profilesMap[c.user_id]?.name || 'User',
            userAvatar: profilesMap[c.user_id]?.avatar_url || null,
          }));

          setLocalObservation((prev: any) => ({ ...(prev || {}), comments }));
          return;
        }

        console.warn('Failed to fetch comments from Supabase:', res.error.message || res.error);
        return;
      }

      const data = res.data;
      const comments = (data || []).map((c: any) => ({
        id: c.id,
        text: c.text,
        created_at: c.created_at,
        createdAt: c.created_at,
        userId: c.user_id,
        userName: c.user?.username || c.user?.name || 'User',
        userAvatar: c.user?.avatar_url || null,
      }));

      setLocalObservation((prev: any) => ({ ...(prev || {}), comments }));
    } catch (e) {
      console.error('Exception fetching comments:', e);
    }
  };
  // --- State ---
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localObservation, setLocalObservation] = useState(observation);
  
  // Suggestion State
  const [suggestSpecies, setSuggestSpecies] = useState('');
  const [suggestReason, setSuggestReason] = useState('');
  // Suggest search & UI helpers (like UploadObservationModal)
  const [suggestSearch, setSuggestSearch] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestPopover, setShowSuggestPopover] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<any>(null);
  
  // Tab State
  const [activeTab, setActiveTab] = useState('comment'); 
  const [suggestType, setSuggestType] = useState<'lepidoptera' | 'hostPlant'>('lepidoptera');

  // --- Effects ---
  useEffect(() => {
    setLocalObservation(observation);
  }, [observation]);

  // When modal opens or observation changes, fetch latest details and comments
  useEffect(() => {
    if (!isOpen) return;
    if (!observation?.id) return;
    // Fetch observation details then comments (sequentially) to keep comments attached
    (async () => {
      await fetchObservationDetails();
      await fetchCommentsFromSupabase();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, observation?.id]);

  // When user types in the Suggest ID search input, query species suggestions
  useEffect(() => {
    let cancelled = false;
    const doSearch = async () => {
      if (!suggestSearch || suggestSearch.length === 0) {
        setSuggestions([]);
        return;
      }
      try {
        const type = suggestType === 'lepidoptera' ? 'lepidoptera' : 'plant';
        const resp = await apiClient.get(`/species/search?q=${encodeURIComponent(suggestSearch)}&type=${type}`, accessToken);
        if (cancelled) return;
        if (resp && resp.success) {
          setSuggestions(resp.data || []);
        } else {
          setSuggestions([]);
        }
      } catch (e) {
        setSuggestions([]);
      }
    };
    doSearch();
    return () => { cancelled = true; };
  }, [suggestSearch, suggestType, accessToken]);

  // --- Derived State: Unified Activity Feed ---
  const activityFeed = useMemo(() => {
    const comments = (localObservation.comments || []).map((c: any) => ({
      type: 'comment',
      id: c.id,
      date: new Date(c.createdAt || c.created_at),
      user: { name: c.userName, avatar: c.userAvatar },
      content: c.text
    }));
    const identifications = (localObservation.identifications || []).map((i: any) => {
      const votesArr = i.votes || i.identification_votes || [];
      const voteCount = Number(i.vote_count ?? (Array.isArray(votesArr) ? votesArr.length : 0));
      const userVoted = !!(currentUserId && Array.isArray(votesArr) && votesArr.find((v: any) => String(v.user_id || v.userId || v.user || '') === String(currentUserId)));
      const subtype = i.identificationType || i.identification_type || (i.species === localObservation?.lepidoptera?.species ? 'lepidoptera' : 'hostPlant');
      return {
        type: 'identification',
        subtype,
        // include the suggester's id so the UI can hide Agree for own suggestions
        userId: i.user_id || i.user?.id || i.userId || null,
        id: i.id,
        date: new Date(i.createdAt || i.created_at),
        user: { name: i.userName || i.user_name || i.userName, avatar: i.userAvatar || i.user_avatar || null },
        species: i.species,
        // Prefer an explicit common name when available (from taxonomy table).
        // Accept several possible column names that may be returned from different extracts:
        // `common_name`, `comm_name`, `commonName`, `comname`, `display_name`.
        // Also accept `species` as an object (some responses nest taxonomy under `species`).
        commonName:
          i.common_name || i.comm_name || i.commonName || i.comname || i.display_name ||
          (i.species && typeof i.species === 'object' ? (i.species.common_name || i.species.display_name || i.species.comname || i.species.commonName) : null) || null,
        // Robust scientific name extraction: prefer dedicated fields, then look inside `species` object
        scientificName:
          i.scientificName || i.scientific_name ||
          (i.species && typeof i.species === 'object' ? (i.species.scientific_name || i.species.sciname || i.species.name) : null) || null,
        caption: i.caption || i.reason || i.explanation || null,
        verified: i.verified || i.is_verified || false,
        thumb: i.taxonThumb || i.taxon_thumb || null,
        votes: votesArr,
        voteCount,
        userVoted,
      };
    });
    return [...comments, ...identifications].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [localObservation, currentUserId]);

  // --- Derived State: Community Taxon Candidates ---
  const communityCandidates = useMemo(() => {
    const ids = localObservation.identifications || [];
    // Group by (type + species) to separate Lepidoptera vs Host Plant
    const map: Record<string, {
      type: 'lepidoptera' | 'hostPlant';
      species: string;
      scientificName?: string;
      count: number;
      identificationIds: string[];
      voters: Set<string>;
    }> = {};

    // Global voter sets per type to compute threshold
    const globalVotersByType: Record<string, Set<string>> = { lepidoptera: new Set(), hostPlant: new Set() };

    for (const i of ids) {
      const species = (i.species || i.scientific_name || i.scientificName || '').toString();
      if (!species) continue;
      // Determine identification type
      const typeRaw = (i.identificationType || i.identification_type || i.subtype || i.type || '').toString().toLowerCase();
      const type: 'lepidoptera' | 'hostPlant' = typeRaw.includes('plant') || typeRaw.includes('host') ? 'hostPlant' : 'lepidoptera';
      const key = `${type}::${species}`;

      // Collect voter ids for this identification
      let votersForId: string[] = [];
      if (Array.isArray(i.votes)) {
        votersForId = i.votes.map((v: any) => String(v.user_id || v.userId || v.user || v));
      } else if (Array.isArray(i.identification_votes)) {
        votersForId = i.identification_votes.map((v: any) => String(v.user_id || v.userId || v.user || v));
      } else if (typeof i.vote_count !== 'undefined') {
        // no per-user votes available; will fallback to counts
        votersForId = [];
      }

      const count = votersForId.length > 0 ? votersForId.length : Number(i.vote_count ?? 1);

      if (!map[key]) map[key] = { type, species, scientificName: i.scientific_name || i.scientificName || '', count: 0, identificationIds: [], voters: new Set() };
      map[key].count += Number(count) || 0;
      if (i.id) map[key].identificationIds.push(i.id);
      if (votersForId.length > 0) {
        for (const uid of votersForId) {
          if (uid) map[key].voters.add(uid);
          globalVotersByType[type].add(uid);
        }
      } else {
        // fallback: if no voter list, we approximate by adding placeholders (will affect threshold calculation)
        // add nothing to voter sets but keep count value
      }
      if (!map[key].scientificName && (i.scientific_name || i.scientificName)) map[key].scientificName = i.scientific_name || i.scientificName;
    }

    const arr = Object.values(map).map(c => ({
      ...c,
      // ensure count reflects unique voters if available
      count: c.voters.size > 0 ? c.voters.size : c.count
    })).sort((a, b) => b.count - a.count);

    // Determine community taxon following rules:
    // - Require at least 2 identifications in total for the type
    // - Check for >= 2/3 majority at species level
    // - If no 2/3 species majority, "walk up" to genus, family (if available) and check for unanimity

    // Helper to extract taxonomic ranks from an identification
    const getRanks = (it: any) => {
      const scientific = (it.scientific_name || it.scientificName || '').toString();
      const genus = it.genus || (scientific ? scientific.split(' ')[0] : '') || '';
      const family = it.family || it.family_name || '';
      return { scientific, genus, family };
    };

    // Build per-type lists of ident records (one per identification row)
    const perTypeIds: Record<string, any[]> = { lepidoptera: [], hostPlant: [] };
    for (const i of ids) {
      const typeRaw = (i.identificationType || i.identification_type || i.subtype || i.type || '').toString().toLowerCase();
      const type: 'lepidoptera' | 'hostPlant' = typeRaw.includes('plant') || typeRaw.includes('host') ? 'hostPlant' : 'lepidoptera';
      perTypeIds[type].push(i);
    }

    const communityByType: Record<string, any> = { lepidoptera: null, hostPlant: null };

    for (const t of ['lepidoptera', 'hostPlant']) {
      const list = perTypeIds[t];
      const totalIds = list.length;
      if (totalIds < 2) {
        communityByType[t] = null;
        continue;
      }

      // Species level majority (2/3)
      // Build species counts
      const speciesCounts: Record<string, number> = {};
      for (const it of list) {
        const sp = (it.species || it.scientific_name || it.scientificName || '').toString();
        if (!sp) continue;
        speciesCounts[sp] = (speciesCounts[sp] || 0) + 1;
      }
      const entries = Object.entries(speciesCounts).sort((a, b) => b[1] - a[1]);
      const topSpecies = entries.length > 0 ? entries[0][0] : null;
      const topSpeciesCount = entries.length > 0 ? entries[0][1] : 0;
      const threshold = Math.ceil((2 / 3) * totalIds);
      if (topSpecies && topSpeciesCount >= threshold) {
        communityByType[t] = { level: 'species', name: topSpecies, count: topSpeciesCount, total: totalIds };
        continue;
      }

      // No species majority: walk up to genus and family and check for unanimity
      const genera = new Set<string>();
      const families = new Set<string>();
      for (const it of list) {
        const r = getRanks(it);
        if (r.genus) genera.add(r.genus);
        if (r.family) families.add(r.family);
      }

      if (genera.size === 1) {
        const genusName = Array.from(genera)[0];
        communityByType[t] = { level: 'genus', name: genusName, count: totalIds, total: totalIds };
        continue;
      }
      if (families.size === 1) {
        const familyName = Array.from(families)[0];
        communityByType[t] = { level: 'family', name: familyName, count: totalIds, total: totalIds };
        continue;
      }

      // No community taxon found
      communityByType[t] = null;
    }

    return { candidates: arr, globalVotersByType, communityByType };
  }, [localObservation.identifications]);

  // Show top candidate filtered by selected suggestType (which is shared with Suggest ID toggle)
  const candidatesForType = communityCandidates && communityCandidates.candidates ? communityCandidates.candidates.filter((c: any) => c.type === suggestType) : [];
  const topCommunityTaxon = candidatesForType.length > 0 ? candidatesForType[0] : null;
  // total identifications for this type (sum of supporting IDs)
  const totalIdentificationsForType = candidatesForType.reduce((s: number, c: any) => s + (Number(c.count) || 0), 0);
  // threshold by 2/3 of identifications (as per iNaturalist rule)
  const thresholdByIds = totalIdentificationsForType > 0 ? Math.ceil((2 / 3) * totalIdentificationsForType) : 1;
  // Community taxon computed by rules (species 2/3 majority OR unanimous genus/family)
  const communityForType = communityCandidates?.communityByType ? communityCandidates.communityByType[suggestType] : null;
  const isTopVerified = !!communityForType; // community established according to rules
  // Prepare segments for display bar (percent widths)
  const voteSegments = candidatesForType.map((c: any, idx: number) => ({
    ...c,
    percent: totalIdentificationsForType > 0 ? ((Number(c.count || 0) / totalIdentificationsForType) * 100) : 0,
    colorIndex: idx,
  }));
  const userAlreadyVotedTop = topCommunityTaxon && currentUserId ? (topCommunityTaxon.voters ? topCommunityTaxon.voters.has(String(currentUserId)) : false) : false;

  const handleAgreeIdentification = async (identificationId: string) => {
    if (!accessToken) {
      toast.error('Please sign in to agree');
      return;
    }
    // Guard: must be a persisted identification id
    if (!identificationId || (String(identificationId).startsWith && String(identificationId).startsWith('local-'))) {
      toast.error('Cannot agree to a non-persisted identification');
      return;
    }
    try {
      const resp = await apiClient.post('/agree-identification', { identification_id: identificationId }, accessToken);
      // If edge function succeeded, verify by refreshing and checking votes
      if (resp && resp.success) {
        // Refresh observation and comments
        await fetchObservationDetails();
        await fetchCommentsFromSupabase();

        // Verify the vote is present in refreshed data
        try {
          const ident = (localObservation.identifications || []).find((it: any) => String(it.id) === String(identificationId));
          const votesArr = ident?.votes || ident?.identification_votes || [];
          const hasVote = Array.isArray(votesArr) && votesArr.find((v: any) => String(v.user_id || v.userId || v.user) === String(currentUserId));
          if (!hasVote) {
            // Sometimes backend may return success for idempotent already-voted; still re-fetch directly
            // Attempt one more refresh using apiClient.get (which has its own fallbacks)
            await fetchObservationDetails();
            const ident2 = (localObservation.identifications || []).find((it: any) => String(it.id) === String(identificationId));
            const votesArr2 = ident2?.votes || ident2?.identification_votes || [];
            const hasVote2 = Array.isArray(votesArr2) && votesArr2.find((v: any) => String(v.user_id || v.userId || v.user) === String(currentUserId));
            if (!hasVote2) {
              toast.error('Agree recorded but vote not visible; please check network or try again');
            } else {
              toast.success('Agreed!');
            }
          } else {
            toast.success('Agreed!');
          }
        } catch (vErr) {
          // Non-fatal
          toast.success('Agreed!');
        }

        // Ensure persisted identification and vote exist in Supabase (same logic as Suggest)
        try {
          await persistIdentificationAndVote(identificationId);
        } catch (e) {
          // non-fatal
          // eslint-disable-next-line no-console
          console.warn('persistIdentificationAndVote error', e);
        }

        // Also add a local identification-like activity so the agree appears in the Activity feed
        try {
          if (currentUserId) {
            // find the identification being agreed to
            const ident = (localObservation.identifications || []).find((it: any) => String(it.id) === String(identificationId));
            const speciesName = ident?.species || ident?.scientific_name || 'suggested ID';

            // fetch current user's profile to show name/avatar
            let profile: any = null;
            try {
              const { data: profileData, error: profileError } = await supabase
                .from('profiles')
                .select('id, username, name, avatar_url')
                .eq('id', currentUserId)
                .single();
              if (!profileError && profileData) profile = profileData;
            } catch (e) {
              // ignore profile fetch error
            }

            // Create a lightweight local identification object representing the agree action
            const localId = `local-agree-${Date.now()}`;
            const localIdentification: any = {
              id: localId,
              species: speciesName,
              // populate commonName and scientificName for the optimistic local agree entry
              commonName: ident?.common_name || ident?.comm_name || ident?.commonName || ident?.display_name || (ident?.species && typeof ident.species === 'object' ? (ident.species.common_name || ident.species.display_name) : null) || null,
              scientific_name: ident?.scientific_name || ident?.scientificName || (ident?.species && typeof ident.species === 'object' ? (ident.species.scientific_name || ident.species.sciname || ident.species.name) : null) || null,
              identification_type: ident?.identification_type || ident?.identificationType || (ident?.subtype === 'hostPlant' ? 'hostPlant' : 'lepidoptera'),
              user_id: currentUserId,
              userId: currentUserId,
              userName: profile?.username || profile?.name || 'You',
              userAvatar: profile?.avatar_url || null,
              created_at: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              votes: [{ id: `local-vote-${Date.now()}`, identification_id: localId, user_id: currentUserId }],
              identification_votes: [{ id: `local-vote-${Date.now()}`, identification_id: localId, user_id: currentUserId }],
              vote_count: (ident?.vote_count ? Number(ident.vote_count) + 1 : (Array.isArray(ident?.votes) ? ident.votes.length + 1 : 1)),
            };

            // Append the local identification activity
            setLocalObservation((prev: any) => ({ ...(prev || {}), identifications: [ ...(prev?.identifications || []), localIdentification ] }));

            // Also update the original identification's vote_count and votes if present so counts update visually
            try {
              setLocalObservation((prev: any) => {
                if (!prev) return prev;
                const ids = (prev.identifications || []).map((it: any) => {
                  if (String(it.id) === String(identificationId)) {
                    const existingVotes = Array.isArray(it.votes) ? it.votes.slice() : (Array.isArray(it.identification_votes) ? it.identification_votes.slice() : []);
                    // add current user to votes if not present
                    const already = existingVotes.find((v: any) => String(v.user_id || v.userId || v.user) === String(currentUserId));
                    if (!already) {
                      existingVotes.push({ id: `local-vote-${Date.now()}`, identification_id: it.id, user_id: currentUserId });
                    }
                    return {
                      ...it,
                      votes: existingVotes,
                      identification_votes: existingVotes,
                      vote_count: (Number(it.vote_count || existingVotes.length) || 0) + (already ? 0 : 1),
                      userVoted: true,
                    };
                  }
                  return it;
                });
                return { ...prev, identifications: ids };
              });
            } catch (e) {
              // ignore update failure
            }
          }
        } catch (e) {
          // non-fatal if local activity can't be appended
          console.warn('Failed to append local agree activity', e);
        }

        onUpdate();
        return;
      } else {
        // Try fallback: first attempt a direct PostgREST insert using the user's id/token
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
          const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

          // If we have the current user id and an access token, try a direct REST insert
          if (currentUserId && accessToken) {
            try {
              const restUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/identification_votes`;
              const headers: Record<string, string> = {
                'Content-Type': 'application/json',
                'apikey': supabaseAnonKey,
                'Authorization': `Bearer ${accessToken}`,
              };

              const body = JSON.stringify([{ identification_id: identificationId, user_id: currentUserId }]);
              const r = await fetch(restUrl, { method: 'POST', headers, body });
              if (r.ok) {
                // parse response; PostgREST returns an array of inserted rows
                const inserted = await r.json().catch(() => null as any);
                // Refresh and verify vote
                await fetchObservationDetails();
                await fetchCommentsFromSupabase();
                const identAfter = (localObservation.identifications || []).find((it: any) => String(it.id) === String(identificationId));
                const votesAfter = identAfter?.votes || identAfter?.identification_votes || [];
                const hasVoteAfter = Array.isArray(votesAfter) && votesAfter.find((v: any) => String(v.user_id || v.userId || v.user) === String(currentUserId));
                if (hasVoteAfter) {
                  toast.success('Agreed!');
                  onUpdate();
                  return;
                }
                // If vote still not visible, continue to anon fallback
                console.warn('Direct REST inserted but vote not visible after refresh', inserted);
              }

              // If the REST insert failed, log it and fall through to anon Supabase fallback
              const text = await r.text().catch(() => '');
              console.warn('Direct PostgREST vote insert failed', r.status, text);
            } catch (restErr) {
              console.warn('Direct PostgREST insert error; will try Supabase anon fallback', restErr);
            }
          }

          // Supabase anon fallback: use anon client to insert identification vote (older fallback path)
          const { createClient } = await import('@supabase/supabase-js');
          const sb = createClient(supabaseUrl, supabaseAnonKey);

          const { data: userData } = await sb.auth.getUser();
          const user = userData?.user;
          if (!user?.id) {
            toast.error(resp?.error || 'Failed to agree');
            return;
          }

          // Check existing vote
          const { data: existingVote } = await sb.from('identification_votes').select('*').eq('identification_id', identificationId).eq('user_id', user.id).limit(1);
          if (existingVote && existingVote.length > 0) {
            toast.success('Already voted');
            await fetchObservationDetails();
            await fetchCommentsFromSupabase();
            onUpdate();
            return;
          }

          // Insert vote (no .select() to avoid PostgREST `columns=` behavior under RLS)
          try {
            const { error: voteErr } = await sb.from('identification_votes').insert([{ identification_id: identificationId, user_id: user.id }]);
            if (voteErr) {
              console.warn('Fallback vote insert failed', voteErr);
              toast.error(resp?.error || 'Failed to agree');
              return;
            }
          } catch (ie) {
            console.warn('Fallback vote insert exception', ie);
            toast.error(resp?.error || 'Failed to agree');
            return;
          }

          toast.success('Agreed!');
          await fetchObservationDetails();
          await fetchCommentsFromSupabase();
          onUpdate();
          return;
        } catch (fallbackErr) {
          console.error('Agree fallback error', fallbackErr);
          toast.error(resp?.error || 'Failed to agree');
        }
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to agree');
    }
  };

  const handleAddComment = async () => {
    if (!comment.trim() || !accessToken) return;
    setIsSubmitting(true);
    try {
      const response = await apiClient.post(`/observations/${observation.id}/comments`, { text: comment }, accessToken);
      if (response.success) {
        toast.success('Comment added!');
        setComment('');
        await fetchObservationDetails();
        await fetchCommentsFromSupabase();
        onUpdate();
      } else {
        toast.error(response.error || 'Failed to add comment');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuggestID = async () => {
    if (!suggestSpecies.trim() || !accessToken) return;
    toast.success(`Suggested ${suggestType} ID: ${suggestSpecies}`);
    setSuggestSpecies('');
    setSuggestReason('');
  };

  // Helper to suggest an identification with fallback to direct Supabase insert
  const suggestWithFallback = async (payload: any) => {
    // Try edge function first when accessToken is present
    if (accessToken) {
      try {
        // Debug: log minimal payload info
        // eslint-disable-next-line no-console
        console.debug('SuggestWithFallback: calling edge function for', { observation_id: payload.observation_id, species: payload.species, hasCaption: !!(payload.caption || payload.reason) });
        const resp = await apiClient.post('/suggest-identification', payload, accessToken);
        if (resp && resp.success) return resp;
        // If the function call failed, fall through to Supabase fallback
        console.warn('Edge suggest-identification failed, falling back to Supabase:', resp?.error);
      } catch (err) {
        console.warn('Edge suggest-identification request error, falling back to Supabase:', err);
      }
    }

    // Supabase fallback: use anon client to insert identification and initial vote
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(supabaseUrl, supabaseAnonKey);

      // Get current user session
      const { data: userData } = await sb.auth.getUser();
      const user = userData?.user;
      if (!user?.id) {
        console.warn('No authenticated session for Supabase fallback — skipping identification insert');
        return { success: false, error: 'Not authenticated for fallback' };
      }

      const identPayload: any = {
        observation_id: payload.observation_id,
        user_id: user.id,
        species: payload.species,
        scientific_name: payload.scientific_name || payload.sciname || null,
        caption: payload.reason || payload.caption || null,
        identification_type: payload.identification_type || payload.identificationType || 'lepidoptera',
        is_auto_suggested: false,
      };

      // Insert without requesting returned representation to avoid PostgREST `columns=` behavior under RLS
      const { error: identErr } = await sb.from('identifications').insert([identPayload]);
      let identData: any = null;
      if (identErr) {
        console.warn('Supabase identifications insert error:', identErr);
        return { success: false, error: identErr?.message || 'Failed to insert identification' };
      }
      // Best-effort: fetch the newly created identification so callers can use it
      try {
        const { data: fetched, error: fetchErr } = await sb.from('identifications')
          .select('*')
          .eq('observation_id', identPayload.observation_id)
          .eq('user_id', identPayload.user_id)
          .eq('species', identPayload.species)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!fetchErr && fetched) identData = fetched;
      } catch (e) {
        // ignore
      }
      if (!identData) {
        // If we couldn't fetch the created row, still treat the insert as success (vote insertion will be best-effort)
        return { success: true, data: null };
      }

      // Add initial vote for the suggester
            try {
              console.debug('Inserting identification_vote (fallback) for ident', identData?.id, 'user', user?.id, '\nstack:', new Error().stack);
              await sb.from('identification_votes').insert([{ identification_id: identData.id, user_id: user.id }]);
            } catch (voteErr) {
              console.warn('Failed to insert initial identification vote in fallback:', voteErr);
            }

      return { success: true, data: identData };
    } catch (fallbackErr) {
      console.warn('Identification fallback failed:', fallbackErr);
      return { success: false, error: fallbackErr?.message || 'Fallback failed' };
    }
  };

  // Persist an identification (if missing) and add a vote for the current user.
  // Reuses the same Supabase anon-client fallback approach used by suggestWithFallback.
  async function persistIdentificationAndVote(identificationId: string) {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
      if (!supabaseUrl || !supabaseAnonKey) return;

      const { createClient } = await import('@supabase/supabase-js');
      const sb = createClient(supabaseUrl, supabaseAnonKey);

      // Resolve current user id (prefer prop, else supabase session)
      let sessionUserId: string | null = currentUserId || null;
      try {
        if (!sessionUserId) {
          const { data: ud } = await sb.auth.getUser();
          sessionUserId = ud?.user?.id || null;
        }
      } catch (e) {
        // ignore
      }
      if (!sessionUserId) return;

      // 1) Check if vote already exists. Prefer PostgREST GET with accessToken if available (avoids RLS surprises), else use anon client.
      let voteExists = false;
      if (accessToken) {
        try {
          const checkUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/identification_votes?identification_id=eq.${encodeURIComponent(String(identificationId))}&user_id=eq.${encodeURIComponent(String(sessionUserId))}&select=id`;
          const headers: Record<string, string> = { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${accessToken}` };
          const r = await fetch(checkUrl, { method: 'GET', headers });
          if (r.ok) {
            const j = await r.json().catch(() => null as any);
            voteExists = Array.isArray(j) && j.length > 0;
          }
        } catch (e) {
          // ignore and fallback
        }
      }

      if (!voteExists) {
        try {
          const { data: existingVote, error: existingVoteErr } = await sb.from('identification_votes').select('id').eq('identification_id', identificationId).eq('user_id', sessionUserId).limit(1);
          if (!existingVoteErr && existingVote && existingVote.length > 0) voteExists = true;
        } catch (e) {
          // ignore
        }
      }

      // 2) If vote missing, insert it (prefer PostgREST with token, else anon insert)
      if (!voteExists) {
        let insertedVote = false;
        if (accessToken) {
          try {
            const restUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/identification_votes`;
            const headers: Record<string, string> = {
              'Content-Type': 'application/json',
              'apikey': supabaseAnonKey,
              'Authorization': `Bearer ${accessToken}`,
            };
            const body = JSON.stringify([{ identification_id: identificationId, user_id: sessionUserId }]);
            const r = await fetch(restUrl, { method: 'POST', headers, body });
            if (r.ok || r.status === 409) insertedVote = true;
          } catch (e) {
            // ignore
          }
        }
        if (!insertedVote) {
            try {
              console.debug('Inserting identification_vote (persistIdentificationAndVote) for ident', identificationId, 'user', sessionUserId, '\nstack:', new Error().stack);
              const { error: verr } = await sb.from('identification_votes').insert([{ identification_id: identificationId, user_id: sessionUserId }]);
              if (!verr) insertedVote = true;
            } catch (e) {
              // ignore duplicate or permission errors
            }
        }
      }

      // 3) Ensure an `identifications` row exists for this user/species on the observation (same behavior as Suggest)
      // Find original identification to copy species/scientific name/type
      const orig = (localObservation.identifications || []).find((it: any) => String(it.id) === String(identificationId)) || {};
      const speciesVal = orig.species || orig.scientific_name || orig.scientificName || null;
      const scientificVal = orig.scientific_name || orig.scientificName || null;
      const identTypeVal = orig.identification_type || orig.identificationType || (orig.subtype || orig.type) || 'lepidoptera';

      if (speciesVal) {
        // Check for existing identification for this user/observation/species
        let identExists = false;
        if (accessToken) {
          try {
            const q = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/identifications?observation_id=eq.${encodeURIComponent(String(localObservation.id))}&user_id=eq.${encodeURIComponent(String(sessionUserId))}&species=eq.${encodeURIComponent(String(speciesVal))}&select=id`;
            const headers: Record<string, string> = { 'apikey': supabaseAnonKey, 'Authorization': `Bearer ${accessToken}` };
            const r = await fetch(q, { method: 'GET', headers });
            if (r.ok) {
              const j = await r.json().catch(() => null as any);
              identExists = Array.isArray(j) && j.length > 0;
            }
          } catch (e) {
            // ignore
          }
        }

        if (!identExists) {
          try {
            const { data: existingIdent, error: existingIdentErr } = await sb.from('identifications').select('id').eq('observation_id', localObservation.id).eq('user_id', sessionUserId).eq('species', speciesVal).limit(1);
            if (!existingIdentErr && existingIdent && existingIdent.length > 0) identExists = true;
          } catch (e) {
            // ignore
          }
        }

        if (!identExists) {
          // Insert identification: prefer server-side function `/suggest-identification` when we have an access token.
          // This uses the service-role on the server and avoids RLS issues for client-side inserts.
          let createdIdent: any = null;
          if (accessToken && sessionUserId) {
            try {
              const payload = {
                observation_id: localObservation.id,
                species: speciesVal,
                scientific_name: scientificVal || null,
                identification_type: identTypeVal,
              };
              // Use apiClient post which wraps edge functions and falls back appropriately.
              try {
                const suggestResp = await apiClient.post('/suggest-identification', payload, accessToken);
                if (suggestResp && suggestResp.success && suggestResp.data) {
                  createdIdent = suggestResp.data;
                }
              } catch (af) {
                // ignore and fallback to anon client
              }
            } catch (e) {
              // ignore and fallback
            }
          }

          if (!createdIdent) {
            // Fallback to anon client insert + fetch (best-effort)
            try {
              const { error: insErr } = await sb.from('identifications').insert([{
                observation_id: localObservation.id,
                user_id: sessionUserId,
                species: speciesVal,
                scientific_name: scientificVal,
                caption: null,
                identification_type: identTypeVal,
                is_auto_suggested: false,
              }]);
              if (!insErr) {
                try {
                  const { data: fetched, error: fetchErr } = await sb.from('identifications')
                    .select('id, observation_id, user_id, species, scientific_name, identification_type, created_at')
                    .eq('observation_id', localObservation.id)
                    .eq('user_id', sessionUserId)
                    .eq('species', speciesVal)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  if (!fetchErr && fetched) createdIdent = fetched;
                } catch (e) {
                  // ignore
                }
              }
            } catch (ie) {
              // ignore
            }
          }

          // If created, add initial vote to the new identification if not already present
          if (createdIdent && createdIdent.id) {
            try {
              // check vote existence on new ident
              const { data: ev, error: evErr } = await sb.from('identification_votes').select('id').eq('identification_id', createdIdent.id).eq('user_id', sessionUserId).limit(1);
                if (!evErr && (!ev || ev.length === 0)) {
                // Use anon client insert without .select() to avoid PostgREST `columns=` behavior that can trigger 403 under RLS
                try {
                  console.debug('Inserting identification_vote (for createdIdent) ident', createdIdent?.id, 'user', sessionUserId, '\nstack:', new Error().stack);
                  await sb.from('identification_votes').insert([{ identification_id: createdIdent.id, user_id: sessionUserId }]);
                } catch (ie) {
                  // ignore
                }
              }
            } catch (ve) {
              // ignore
            }
          }
        }
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('persistIdentificationAndVote failed', e);
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Delete this observation?')) return;
    setIsSubmitting(true);
    try {
      const response = await apiClient.delete(`/observations/${localObservation.id}`, accessToken);
      if (response.success || response.status === 404) {
        toast.success('Deleted');
        onClose();
        onUpdate();
      } else {
        const { error } = await supabase.from('observations').delete().eq('id', localObservation.id);
        if (error) throw error;
        toast.success('Deleted');
        onClose();
        onUpdate();
      }
    } catch (e: any) {
      toast.error(e.message || 'Failed to delete observation');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper values
  const lepName = localObservation.lepidoptera_current_identification || localObservation.lepidoptera?.species || 'Unknown Lepidoptera';
  const plantName = localObservation.plant_current_identification || localObservation.hostPlant?.species || 'Unknown Plant';
  
  const observationDate = localObservation.observed_at
    ? new Date(localObservation.observed_at)
    : localObservation.date_observed
      ? new Date(localObservation.date_observed)
      : localObservation.date
        ? new Date(localObservation.date)
        : localObservation.observation_date
          ? new Date(localObservation.observation_date)
          : null;
          
  const submittedDate = localObservation.created_at ? new Date(localObservation.created_at) : null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="max-w-3xl max-h-[90vh] overflow-y-auto p-0 gap-0"
        aria-labelledby="observation-dialog-title"
        aria-describedby="observation-dialog-description"
      >
        <RadixDialog.Title id="observation-dialog-title" style={{position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0}}>
          Observation Details
        </RadixDialog.Title>
        <RadixDialog.Description id="observation-dialog-description" style={{position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', border: 0}}>
          Detailed view of the observation including images, species identification, and user activity.
        </RadixDialog.Description>

    
        
        {/* Header Title */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <RadixDialog.Title className="text-lg font-bold text-center flex items-center justify-center gap-2 text-gray-800">
            <span className="text-amber-700">{lepName}</span>
            <ArrowRightLeft className="h-4 w-4 text-gray-400" />
            <span className="text-green-700">{plantName}</span>
          </RadixDialog.Title>
        </div>

        <div className="p-6 space-y-6">
          
          {/* --- 1. Images & Identifications Row --- */}
          <div className="grid grid-cols-2 gap-6">
            {/* Left: Lepidoptera */}
            <div className="flex flex-col gap-2">
              <div className="w-full h-64 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 relative shadow-sm flex items-center justify-center">
                 {localObservation.lepidoptera?.image || localObservation.image_url ? (
                   <img 
                     src={localObservation.lepidoptera?.image || localObservation.image_url} 
                     alt="Lepidoptera" 
                     className="w-full h-full object-cover"
                   />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No Image</div>
                 )}
              </div>
              <div className="text-left">
                <div className="font-bold text-gray-900 text-lg leading-tight">{lepName}</div>
                <div className="text-sm text-gray-500 font-medium mt-1">
                   {localObservation.lepidoptera?.identifications?.length || 0} identification(s)
                </div>
              </div>
            </div>

            {/* Right: Host Plant */}
            <div className="flex flex-col gap-2">
              <div className="w-full h-64 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 relative shadow-sm flex items-center justify-center">
                 {localObservation.hostPlant?.image || localObservation.plant_image_url ? (
                   <img 
                     src={localObservation.hostPlant?.image || localObservation.plant_image_url} 
                     alt="Host Plant" 
                     className="w-full h-full object-cover"
                   />
                 ) : (
                   <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">No Image</div>
                 )}
              </div>
              <div className="text-left">
                <div className="font-bold text-gray-900 text-lg leading-tight">{plantName}</div>
                <div className="text-sm text-gray-500 font-medium mt-1">
                   {localObservation.hostPlant?.identifications?.length || 0} identification(s)
                </div>
              </div>
            </div>
          </div>

          {/* --- 2. User Profile Row --- */}
          {localObservation.user && (
            <div className="flex items-center p-2">
              <Avatar className="h-12 w-12 border-2 border-white shadow-sm mr-3">
                <AvatarImage src={localObservation.user.avatar || localObservation.user.avatar_url} />
                <AvatarFallback>{localObservation.user.username?.[0] || localObservation.user.name?.[0] || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col ml-2 items-start">
                <span className="font-bold text-base text-gray-900 text-left">{localObservation.user.username || localObservation.user.name || localObservation.user.fullName || 'Unknown User'}</span>
                <span className="text-sm text-gray-500 font-medium text-left">
                  {localObservation.user.observationCount || 0} observations
                </span>
              </div>
              {/* Owner Actions */}
              {currentUserId === localObservation.user.id && (
                <Button variant="ghost" size="sm" className="ml-auto text-red-500 hover:text-red-600 hover:bg-red-50" onClick={handleDelete}>
                  Delete
                </Button>
              )}
            </div>
          )}

          {/* --- 3. Details Row (Observed, Submitted, Location) --- */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-b border-gray-100 py-4 bg-gray-50/30 rounded-lg px-4">
             {/* Observed */}
             <div className="flex flex-col">
               <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1 flex items-center gap-1">
                 <Calendar className="h-3 w-3" /> Observed
               </span>
               <span className="text-sm font-medium text-gray-900">
                 {observationDate ? observationDate.toLocaleString() : 'Unknown'}
               </span>
             </div>

             {/* Submitted */}
             <div className="flex flex-col">
               <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1 flex items-center gap-1">
                 <Clock className="h-3 w-3" /> Submitted
               </span>
               <span className="text-sm font-medium text-gray-900">
                 {submittedDate ? submittedDate.toLocaleString() : 'Unknown'}
               </span>
             </div>

             {/* Location */}
             <div className="flex flex-col">
               <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 mb-1 flex items-center gap-1">
                 <MapPin className="h-3 w-3" /> Location
               </span>
               <span className="text-sm font-medium text-gray-900 truncate" title={localObservation.location}>
                 {localObservation.location || 'Unknown Location'}
               </span>
             </div>
          </div>

          {/* --- 4. Activity Feed --- */}
          {/* --- Community Taxon (community consensus) --- */}
          {/* Community Taxon Type Toggle (same style as Suggest ID) */}
          <div className="flex justify-center mb-4">
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium border rounded-l-lg ${suggestType === 'lepidoptera' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                onClick={() => setSuggestType('lepidoptera')}
              >
                Lepidoptera
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium border rounded-r-lg ${suggestType === 'hostPlant' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                onClick={() => setSuggestType('hostPlant')}
              >
                Host Plant
              </button>
            </div>
          </div>

          <div className="mb-4 p-4 border rounded-lg bg-gray-50">
            {communityForType ? (
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-semibold text-gray-500">Community Taxon</div>
                    {isTopVerified && <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">Verified</span>}
                  </div>
                  {communityForType.level === 'species' && topCommunityTaxon ? (
                    <>
                      <div className="text-lg font-bold text-gray-900 mt-1">{topCommunityTaxon.species}</div>
                      {topCommunityTaxon.scientificName && (
                        <div className="text-xs text-gray-500 italic">{topCommunityTaxon.scientificName}</div>
                      )}
                      <div className="text-sm text-gray-600 mt-2">{topCommunityTaxon.count} vote(s)</div>
                      <div className="mt-3">
                        <div className="text-sm text-gray-600">
                          {totalIdentificationsForType} total ID(s) — consensus threshold: {thresholdByIds} vote(s) (2/3)
                        </div>
                      </div>
                    </>
                  ) : (
                    // Genus or family level consensus
                    <>
                      <div className="text-lg font-bold text-gray-900 mt-1">{communityForType.name}</div>
                      <div className="text-xs text-gray-500 italic">Consensus at {communityForType.level} level</div>
                      <div className="text-sm text-gray-600 mt-2">{communityForType.count} supporting ID(s)</div>
                    </>
                  )}
                </div>
                <div className="ml-4 flex-shrink-0">
                  {/* Accept community taxon: owner-only action that writes to observation */}
                  {localObservation.user && currentUserId === localObservation.user.id ? (
                    <div className="flex flex-col items-end gap-2">
                      <div className="text-xs text-gray-500">Owner Actions</div>
                      <Button
                        size="sm"
                        onClick={async () => {
                          if (!accessToken) {
                            toast.error('Please sign in to accept community taxon');
                            return;
                          }
                          // Determine value to write
                          const fieldName = suggestType === 'lepidoptera' ? 'lepidoptera_current_identification' : 'plant_current_identification';
                          const valueToSet = (communityForType.level === 'species' && topCommunityTaxon) ? topCommunityTaxon.species : communityForType.name;
                          if (!valueToSet) {
                            toast.error('No community taxon to accept');
                            return;
                          }
                          // Only allow clicking when there are >=3 supporting IDs
                          const supportCount = communityForType.count || 0;
                          if (supportCount < 3) {
                            toast.error('Community taxon requires 3+ supporting identifications to accept');
                            return;
                          }
                          try {
                            const payload: any = {};
                            payload[fieldName] = valueToSet;
                            const resp = await apiClient.put(`/observations/${localObservation.id}`, payload, accessToken);
                            if (resp && resp.success) {
                              toast.success('Community taxon accepted');
                              await fetchObservationDetails();
                              await fetchCommentsFromSupabase();
                              onUpdate();
                            } else {
                              toast.error(resp?.error || 'Failed to accept community taxon');
                            }
                          } catch (e: any) {
                            toast.error(e?.message || 'Failed to accept community taxon');
                          }
                        }}
                        disabled={!accessToken || !communityForType || (communityForType.count || 0) < 3}
                      >
                        Accept
                      </Button>
                      <div className="text-xs text-gray-400">Requires 3+ supporting IDs</div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : (
              <div>
                <div className="text-xs font-semibold text-gray-500">Community Taxon</div>
                <div className="text-lg font-bold text-gray-900 mt-1">Not yet identified</div>
                <div className="text-xs text-gray-500 italic">No suggestions yet for {suggestType === 'lepidoptera' ? 'Lepidoptera' : 'Host Plant'}</div>
                <div className="text-sm font-medium text-gray-700 mt-2">0 vote(s)</div>
                <div className="text-xs text-gray-500">Consensus threshold: {thresholdByIds} / {totalIdentificationsForType} (2/3)</div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-900">Activity</h3>
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {activityFeed.length === 0 ? (
                <p className="text-gray-400 text-sm italic">No activity yet. Be the first to comment!</p>
              ) : (
                activityFeed.map((item: any) => (
                  <div key={`${item.type}-${item.id}`} className="flex gap-3 text-sm group">
                    <Avatar className="h-8 w-8 mt-1">
                      <AvatarImage src={item.user.avatar} />
                      <AvatarFallback>{item.user.name?.[0]}</AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 space-y-1">
                      <div className="flex items-baseline justify-between">
                        <span className="font-semibold text-gray-900 whitespace-nowrap">
                          {(() => {
                            const displayName = item.user?.name || item.user?.username || item.userName || 'User';
                            if (item.type === 'identification') {
                              const target = item.subtype === 'hostPlant' ? 'Host Plant' : 'Lepidoptera';
                              return `${displayName} suggested an ID for ${target}`;
                            }
                            if (item.type === 'comment') {
                              return `${displayName} commented`;
                            }
                            return displayName;
                          })()}
                        </span>
                        <span className="text-xs text-gray-400">{item.date.toLocaleDateString()}</span>
                      </div>
                      
                      {item.type === 'identification' ? (
                        <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100 text-gray-800">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="text-amber-700 font-medium">Suggested ID</div>
                              <div className="font-bold mt-1 text-lg flex items-center gap-2">
                                {item.thumb && <img src={item.thumb} className="w-8 h-8 rounded object-cover" alt="Taxon thumbnail" />}
                                {item.commonName || ''}
                              </div>
                              <div className="text-xs text-gray-500 italic">{item.scientificName}</div>
                              {item.caption && (
                                <div className="text-sm text-gray-700 mt-2">{item.caption}</div>
                              )}
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-500 mb-2">{item.subtype === 'hostPlant' || item.type === 'hostPlant' ? 'Host Plant' : 'Lepidoptera'}</div>
                              {item.userId !== currentUserId && (
                                <Button
                                  size="sm"
                                  onClick={() => handleAgreeIdentification(item.id)}
                                  disabled={!accessToken || item.userVoted || !item.id || (String(item.id).startsWith && String(item.id).startsWith('local-'))}
                                  title={!item.id || (String(item.id).startsWith && String(item.id).startsWith('local-')) ? 'Identification not yet persisted' : undefined}
                                >
                                  {item.userVoted ? 'Agreed' : 'Agree'}
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-gray-700">{item.content}</div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* --- 5. Interaction Tabs --- */}
          <div className="border-t border-gray-100 pt-4">
            <Tabs defaultValue="comment" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="comment">Comment</TabsTrigger>
                <TabsTrigger value="suggest">Suggest ID</TabsTrigger>
              </TabsList>

              {/* Comment Tab Content */}
              <TabsContent value="comment" className="space-y-3">
                <Textarea 
                  placeholder="Leave a comment..." 
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="min-h-[100px]"
                />
                <Button 
                  className="w-full" 
                  onClick={handleAddComment} 
                  disabled={!accessToken || isSubmitting || !comment.trim()}
                >
                  {isSubmitting ? 'Posting...' : 'Post Comment'}
                </Button>
                {!accessToken && <p className="text-xs text-center text-gray-400">Please sign in to comment</p>}
              </TabsContent>

              {/* Suggest ID Tab Content */}
              <TabsContent value="suggest" className="space-y-4">
                <div className="flex justify-center mb-2">
                  <div className="inline-flex rounded-md shadow-sm" role="group">
                    <button 
                      type="button" 
                      className={`px-4 py-2 text-sm font-medium border rounded-l-lg ${suggestType === 'lepidoptera' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                      onClick={() => setSuggestType('lepidoptera')}
                    >
                      Lepidoptera
                    </button>
                    <button 
                      type="button" 
                      className={`px-4 py-2 text-sm font-medium border rounded-r-lg ${suggestType === 'hostPlant' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}
                      onClick={() => setSuggestType('hostPlant')}
                    >
                      Host Plant
                    </button>
                  </div>
                </div>

                <div className="space-y-3 relative">
                  <Input
                    placeholder={`Search species (${suggestType === 'lepidoptera' ? 'Lepidoptera' : 'Host Plant'})...`}
                    value={selectedSuggestion ? (selectedSuggestion.common_name || selectedSuggestion.name || suggestSearch) : suggestSearch}
                    onChange={(e) => {
                      setSuggestSearch(e.target.value);
                      setSelectedSuggestion(null);
                      setShowSuggestPopover(true);
                    }}
                    onFocus={() => setShowSuggestPopover(true)}
                  />

                  {showSuggestPopover && suggestions.length > 0 && (
                    <div className="absolute z-20 w-full bg-white border mt-1 rounded shadow max-h-60 overflow-auto">
                      {suggestions.map((s: any, i: number) => (
                        <div
                          key={s.id || `${s.name}-${i}`}
                          className="px-3 py-2 hover:bg-gray-50 cursor-pointer"
                          onClick={() => {
                            setSelectedSuggestion(s);
                            // prefer common_name or name fields
                            const name = s.common_name || s.name || s.comname || s.display_name || '';
                            setSuggestSearch(name);
                            setSuggestSpecies(name);
                            setShowSuggestPopover(false);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {s.thumbnail && <img src={s.thumbnail} alt="t" className="w-8 h-8 object-cover rounded" />}
                            <div>
                              <div className="font-medium text-sm">{s.common_name || s.name || s.comname || s.display_name}</div>
                              <div className="text-xs text-gray-500">{s.scientific_name || s.sciname || ''}</div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Textarea 
                    placeholder="Tell us why..." 
                    value={suggestReason}
                    onChange={(e) => setSuggestReason(e.target.value)}
                  />
                  <Button 
                    className={`w-full ${suggestType === 'lepidoptera' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}`}
                    onClick={async () => {
                      // Build the payload and call suggest-identification endpoint
                      if (!accessToken) {
                        toast.error('Please sign in to suggest an ID');
                        return;
                      }
                      const speciesName = selectedSuggestion ? (selectedSuggestion.common_name || selectedSuggestion.name || selectedSuggestion.display_name) : (suggestSearch || suggestSpecies);
                      if (!speciesName || speciesName.trim().length === 0) {
                        toast.error('Please choose a species or type a name');
                        return;
                      }
                      const payload: any = {
                        observation_id: localObservation.id,
                        species: speciesName,
                        identification_type: suggestType,
                        // send reason and caption to support both server expectations
                        reason: suggestReason || null,
                        caption: suggestReason || null,
                      };
                      if (selectedSuggestion) {
                        payload.scientific_name = selectedSuggestion.scientific_name || selectedSuggestion.sciname || null;
                        if (selectedSuggestion.id) payload.taxon_id = selectedSuggestion.id;
                      }

                      try {
                        // Use suggestWithFallback so suggestions persist even if edge function is unavailable
                        const resp = await suggestWithFallback(payload);
                        if (resp && resp.success) {
                          toast.success('Suggestion submitted');
                          setSuggestSearch('');
                          setSuggestSpecies('');
                          setSuggestReason('');
                          setSelectedSuggestion(null);
                          setSuggestions([]);
                          setShowSuggestPopover(false);
                          // Refresh the observation so the new identification appears in Activity
                          await fetchObservationDetails();
                          await fetchCommentsFromSupabase();
                          onUpdate();
                        } else {
                          toast.error(resp?.error || 'Failed to submit suggestion');
                        }
                      } catch (e: any) {
                        toast.error(e?.message || 'Failed to submit suggestion');
                      }
                    }}
                    disabled={!accessToken || (!suggestSearch && !selectedSuggestion && !suggestSpecies)}
                  >
                    Suggest {suggestType === 'lepidoptera' ? 'Lepidoptera' : 'Plant'} ID
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}