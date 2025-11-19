import { useEffect, useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Search } from 'lucide-react';
import { ObservationDetailModal } from './ObservationDetailModal';
import { toast } from 'sonner';
import { apiClient } from '../api/client';

export function HomePage({ accessToken, userId }: { accessToken?: string | null; userId?: string | null }) {
  const [observations, setObservations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedObs, setSelectedObs] = useState<any | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [suggestText, setSuggestText] = useState('');
  const [suggestCaption, setSuggestCaption] = useState('');
  const [suggestingFor, setSuggestingFor] = useState<string | null>(null);
  const [speciesResults, setSpeciesResults] = useState<any[]>([]);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    fetchFeed();
    
    // Check if this is the user's first visit to home after signup
    const hasSeenWelcome = localStorage.getItem(`welcome_${userId}`);
    if (!hasSeenWelcome && userId) {
      setShowWelcome(true);
      // Mark that user has seen welcome
      localStorage.setItem(`welcome_${userId}`, 'true');
    }
  }, [userId]);

  const fetchFeed = async () => {
    setIsLoading(true);
    try {
      // Try backend API first, fallback to direct Supabase query
      let response = await apiClient.get('/observations?limit=20', accessToken || undefined);

      // If backend fails, use fallback Supabase query
      if (!response.success) {
        console.log('Backend unavailable, using fallback Supabase query...');
        response = await apiClient.getObservations();
      }

      if (response.success) {
        setObservations(response.data || []);
      } else {
        toast.error('Failed to load observations');
      }
    } catch (error) {
      console.error('Error fetching feed:', error);
      toast.error('Error loading observations');
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
      const response = await apiClient.searchSpecies(q, 'lepidoptera');
      
      if (response.success) {
        setSpeciesResults(response.data || []);
      }
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
      const response = await apiClient.post(
        `/observations/${obsId}/identifications`,
        { species: suggestText, caption: suggestCaption },
        accessToken
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to suggest id');
      }

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
      ) : observations.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">No observations found. Be the first to document a Lepidoptera-plant interaction!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {observations.map((obs) => (
            <Card key={obs.id} className="cursor-pointer" onClick={() => openDetails(obs)}>
              <CardContent>
                <div className="flex gap-4">
                  <div className="w-28">
                    {obs.image_url ? (
                      <img src={obs.image_url} alt="observation" className="w-full h-24 object-cover rounded" />
                    ) : (
                      <div className="w-full h-24 bg-gray-200 rounded flex items-center justify-center">No image</div>
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
                          <p className="text-xs text-gray-500">{obs.created_at ? new Date(obs.created_at).toLocaleString() : 'N/A'}</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm font-medium mt-2">📍 {obs.location || 'Unknown location'}</p>
                    <p className="text-sm text-gray-700 mt-2 line-clamp-2">{obs.notes || 'No notes'}</p>

                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); handleStartSuggest(obs.id); }}>View Details</Button>
                    </div>
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

      {/* Welcome Modal - appears only on first visit after signup */}
      {showWelcome && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardContent className="pt-8">
              <div className="flex flex-col items-center text-center">
                {/* Logo */}
                <img 
                  src="/navbar/logo.svg" 
                  alt="ChrysaLink Logo" 
                  className="h-16 w-auto mb-4"
                />
                
                {/* Welcome Text */}
                <h1 className="text-3xl font-bold mb-2">Welcome to ChrysaLink</h1>
                <p className="text-gray-600 mb-8">
                  Thank you for joining our community! Start exploring and documenting Lepidoptera and their host plants.
                </p>

                {/* Close Button */}
                <Button 
                  onClick={() => setShowWelcome(false)}
                  className="w-full bg-green-600 hover:bg-green-700"
                >
                  Let's Get Started
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default HomePage;