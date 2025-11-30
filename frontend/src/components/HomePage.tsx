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
      let response = await apiClient.get('/observations', accessToken || undefined);

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
        <div className="space-y-6">
          {observations.map((obs) => {
            // Data accessors aligned with ExplorePage.tsx and the backend response
            const lepidopteraImage = obs.lepidoptera_image_url || obs.image_url;
            const plantImage = obs.plant_image_url;
            
            const lepidopteraName = obs.lepidoptera?.common_name || obs.lepidoptera?.scientific_name || 'Lepidoptera';
            const hostPlantName = obs.plant?.common_name || obs.plant?.scientific_name || 'Host Plant';

            const userName = obs.user?.name || obs.user?.username || 'User' + (obs.user_id?.substring(0, 8) || '');
            const observationDate = new Date(obs.observation_date || obs.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });
            const createdDate = new Date(obs.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <div 
                key={obs.id} 
                className="bg-white rounded-lg overflow-hidden shadow-sm border border-gray-200 cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => openDetails(obs)}
              >
                <div className="p-4">
                  {/* Header */}
                  <div className="text-sm text-gray-600 mb-4">
                    <span>{createdDate}</span>
                    <span className="font-semibold text-gray-800"> {userName} </span>
                    added an observation
                  </div>

                  {/* Image Section */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {/* Lepidoptera */}
                    <div>
                      <div className="w-full aspect-square relative rounded-md overflow-hidden bg-gray-100">
                        {lepidopteraImage ? (
                          <img src={lepidopteraImage} alt={lepidopteraName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-gray-800 italic truncate" title={lepidopteraName}>{lepidopteraName}</p>
                    </div>
                    {/* Host Plant */}
                    <div>
                       <div className="w-full aspect-square relative rounded-md overflow-hidden bg-gray-100">
                        {plantImage ? (
                          <img src={plantImage} alt={hostPlantName} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">No Image</div>
                        )}
                      </div>
                      <p className="mt-2 text-sm font-semibold text-gray-800 truncate" title={hostPlantName}>{hostPlantName}</p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="text-sm text-gray-600 space-y-2">
                    <div className="flex items-center flex-wrap gap-x-2">
                      <span className="font-semibold">{userName}</span>
                      <span>|</span>
                      <span>{observationDate}</span>
                      <span>|</span>
                      <Badge variant="secondary" className="text-xs">
                        {obs.quality_grade ? obs.quality_grade.replace(/_/g, ' ') : 'Needs ID'}
                      </Badge>
                    </div>
                    <div>
                      <span>{obs.location || 'Unknown location'}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
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