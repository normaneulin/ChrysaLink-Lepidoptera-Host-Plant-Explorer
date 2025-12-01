import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
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
  // ...existing code...
  // Fetch latest observation details
  const fetchObservationDetails = async () => {
    try {
      const response = await apiClient.get(`/observations/${observation.id}`, accessToken);
      if (response.success && response.data) {
        setLocalObservation(response.data);
      }
    } catch (error) {
      // Optionally handle error
    }
  };
  // --- State ---
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localObservation, setLocalObservation] = useState(observation);
  
  // Suggestion State
  const [suggestSpecies, setSuggestSpecies] = useState('');
  const [suggestReason, setSuggestReason] = useState('');
  
  // Tab State
  const [activeTab, setActiveTab] = useState('comment'); 
  const [suggestType, setSuggestType] = useState<'lepidoptera' | 'hostPlant'>('lepidoptera');

  // --- Effects ---
  useEffect(() => {
    setLocalObservation(observation);
  }, [observation]);

  // --- Derived State: Unified Activity Feed ---
  const activityFeed = useMemo(() => {
    const comments = (localObservation.comments || []).map((c: any) => ({
      type: 'comment',
      id: c.id,
      date: new Date(c.createdAt || c.created_at),
      user: { name: c.userName, avatar: c.userAvatar },
      content: c.text
    }));
    const identifications = (localObservation.identifications || []).map((i: any) => ({
      type: 'identification',
      subtype: i.identificationType || (i.species === localObservation?.lepidoptera?.species ? 'lepidoptera' : 'hostPlant'),
      id: i.id,
      date: new Date(i.createdAt || i.created_at),
      user: { name: i.userName, avatar: i.userAvatar },
      species: i.species,
      scientificName: i.scientificName,
      verified: i.verified,
      thumb: i.taxonThumb
    }));
    return [...comments, ...identifications].sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [localObservation]);

  const handleAddComment = async () => {
    if (!comment.trim() || !accessToken) return;
    setIsSubmitting(true);
    try {
      const response = await apiClient.post(`/observations/${observation.id}/comments`, { text: comment }, accessToken);
      if (response.success) {
        toast.success('Comment added!');
        setComment('');
        fetchObservationDetails();
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
        <DialogHeader className="sr-only">
          <DialogTitle id="observation-dialog-title">Observation Details</DialogTitle>
          <DialogDescription id="observation-dialog-description">
            Detailed view of the observation including images, species identification, and user activity.
          </DialogDescription>
        </DialogHeader>

    
        
        {/* Header Title */}
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <DialogTitle className="text-lg font-bold text-center flex items-center justify-center gap-2 text-gray-800">
            <span className="text-amber-700">{lepName}</span>
            <ArrowRightLeft className="h-4 w-4 text-gray-400" />
            <span className="text-green-700">{plantName}</span>
          </DialogTitle>
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
                        <span className="font-semibold text-gray-900">{item.user.name}</span>
                        <span className="text-xs text-gray-400">{item.date.toLocaleDateString()}</span>
                      </div>
                      
                      {item.type === 'identification' ? (
                        <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100 text-gray-800">
                          <span className="text-amber-700 font-medium">Suggested ID:</span>
                          <div className="font-bold mt-1 text-lg flex items-center gap-2">
                             {item.thumb && <img src={item.thumb} className="w-8 h-8 rounded object-cover" alt="Taxon thumbnail" />}
                             {item.species} 
                          </div>
                          <div className="text-xs text-gray-500 italic">{item.scientificName}</div>
                        </div>
                      ) : (
                        <div className="text-gray-700">
                          {item.content}
                        </div>
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

                <div className="space-y-3">
                  <Input 
                    placeholder={`Species name (${suggestType === 'lepidoptera' ? 'Lepidoptera' : 'Host Plant'})...`}
                    value={suggestSpecies}
                    onChange={(e) => setSuggestSpecies(e.target.value)}
                  />
                  <Textarea 
                    placeholder="Tell us why..." 
                    value={suggestReason}
                    onChange={(e) => setSuggestReason(e.target.value)}
                  />
                  <Button 
                    className={`w-full ${suggestType === 'lepidoptera' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'}`}
                    onClick={handleSuggestID}
                    disabled={!accessToken || !suggestSpecies.trim()}
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