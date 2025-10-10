import { useEffect, useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Search } from 'lucide-react';
import { ObservationDetailModal } from './ObservationDetailModal';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { toast } from 'sonner';

export function HomePage({ accessToken, userId }: { accessToken?: string | null; userId?: string | null }) {
  const [observations, setObservations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedObs, setSelectedObs] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [suggestText, setSuggestText] = useState('');
  const [suggestCaption, setSuggestCaption] = useState('');
  const [suggestingFor, setSuggestingFor] = useState<string | null>(null);
  const [speciesResults, setSpeciesResults] = useState<any[]>([]);

  useEffect(() => {
    fetchFeed();
  }, []);

  const fetchFeed = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b55216b3/observations?limit=20`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      const data = await response.json();
      if (response.ok) {
        setObservations(data.observations || []);
      }
    } catch (error) {
      console.error('Error fetching feed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openDetails = (obs: any) => {
    setSelectedObs(obs);
    setShowModal(true);
  };

  const handleStartSuggest = (obsId: string) => {
    setSuggestingFor(obsId);
    setSuggestText('');
    setSuggestCaption('');
    setSpeciesResults([]);
  };

  const searchSpecies = async (q: string) => {
    if (q.length < 2) {
      setSpeciesResults([]);
      return;
    }
    try {
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b55216b3/species/search?q=${encodeURIComponent(q)}&type=lepidoptera`,
        { headers: { 'Authorization': `Bearer ${publicAnonKey}` } }
      );
      const d = await res.json();
      setSpeciesResults(d.species || []);
    } catch (err) {
      console.error('Species search error', err);
    }
  };

  const submitSuggestion = async (obsId: string) => {
    if (!suggestText.trim()) {
      toast.error('Please pick or type a species name');
      return;
    }
    if (!accessToken) {
      toast.error('Sign in to suggest an identification');
      return;
    }

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b55216b3/observations/${obsId}/identifications`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ species: suggestText, caption: suggestCaption })
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to suggest id');
      toast.success('Suggestion sent');
      setSuggestingFor(null);
      // refresh feed
      fetchFeed();
    } catch (err: any) {
      console.error('Suggest error', err);
      toast.error(err.message || 'Failed');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl mb-4">Home Feed</h1>

      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <div className="space-y-4">
          {observations.map((obs) => (
            <Card key={obs.id} className="cursor-pointer" onClick={() => openDetails(obs)}>
              <CardContent>
                <div className="flex gap-4">
                  <div className="w-28">
                    <img src={obs.lepidoptera.image} alt="lep" className="w-full h-24 object-cover rounded" />
                    {obs.hostPlant.image && (
                      <img src={obs.hostPlant.image} alt="plant" className="w-full h-24 object-cover rounded mt-2" />
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>{obs.user?.name?.[0] || 'U'}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{obs.user?.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{new Date(obs.createdAt).toLocaleString()}</p>
                        </div>
                      </div>
                      <div>
                        <Badge className="text-sm">{obs.lepidoptera.species || 'Unknown'}</Badge>
                      </div>
                    </div>

                    <p className="text-sm text-gray-700 mt-2 line-clamp-2">{obs.notes}</p>

                    <div className="flex gap-2 mt-3">
                      {/* Card click opens details; buttons below must stop propagation so they don't trigger the card click */}
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleStartSuggest(obs.id); }}>Suggest ID</Button>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setSelectedObs(obs); setShowModal(true); }}>Comment</Button>
                    </div>

                    {suggestingFor === obs.id && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Search species or type scientific name"
                            value={suggestText}
                            onChange={(e: any) => { setSuggestText(e.target.value); searchSpecies(e.target.value); }}
                          />
                          <Button size="sm" onClick={() => submitSuggestion(obs.id)}>Send</Button>
                          <Button size="sm" variant="outline" onClick={() => setSuggestingFor(null)}>Cancel</Button>
                        </div>
                        {speciesResults.length > 0 && (
                          <div className="grid grid-cols-2 gap-2">
                            {speciesResults.slice(0, 6).map((s: any) => (
                              <button
                                key={s.id}
                                className="text-left p-2 bg-gray-50 rounded"
                                onClick={() => setSuggestText(s.name)}
                              >
                                <div className="font-medium">{s.name}</div>
                                {s.commonName && <div className="text-xs text-gray-500">{s.commonName}</div>}
                              </button>
                            ))}
                          </div>
                        )}

                        <Textarea placeholder="Add caption for your suggestion (optional)" value={suggestCaption} onChange={(e: any) => setSuggestCaption(e.target.value)} rows={2} />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedObs && (
        <ObservationDetailModal
          observation={selectedObs}
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          accessToken={accessToken || undefined}
          currentUserId={userId || undefined}
          onUpdate={() => fetchFeed()}
        />
      )}
    </div>
  );
}

export default HomePage;