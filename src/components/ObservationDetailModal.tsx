import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { MapPin, Calendar, CheckCircle, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { Separator } from './ui/separator';

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
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localObservation, setLocalObservation] = useState(observation);

  useEffect(() => {
    setLocalObservation(observation);
  }, [observation]);

  const handleAddComment = async () => {
    if (!comment.trim() || !accessToken) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b55216b3/observations/${observation.id}/comments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
          },
          body: JSON.stringify({ text: comment })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to add comment');
      }

      toast.success('Comment added!');
      setComment('');
      
      // Refresh the observation data
      fetchObservationDetails();
      onUpdate();
    } catch (error: any) {
      console.error('Error adding comment:', error);
      toast.error(error.message || 'Failed to add comment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchObservationDetails = async () => {
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b55216b3/observations/${observation.id}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      const data = await response.json();

      if (response.ok) {
        setLocalObservation(data.observation);
      }
    } catch (error) {
      console.error('Error fetching observation details:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Observation Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Images */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 mb-2">Lepidoptera</p>
              {localObservation.lepidoptera.image ? (
                <img
                  src={localObservation.lepidoptera.image}
                  alt="Lepidoptera"
                  className="w-full h-64 object-cover rounded-lg"
                />
              ) : (
                <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                  <p className="text-gray-400">No image</p>
                </div>
              )}
              <p className="mt-2 font-medium">
                {localObservation.lepidoptera.species || 'Unknown Species'}
              </p>
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-2">Host Plant</p>
              {localObservation.hostPlant.image ? (
                <img
                  src={localObservation.hostPlant.image}
                  alt="Host Plant"
                  className="w-full h-64 object-cover rounded-lg"
                />
              ) : (
                <div className="w-full h-64 bg-gray-100 rounded-lg flex items-center justify-center">
                  <p className="text-gray-400">No image</p>
                </div>
              )}
              <p className="mt-2 font-medium">
                {localObservation.hostPlant.species || 'Unknown Species'}
              </p>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-3">
            <div className="flex items-center text-gray-700">
              <MapPin className="h-4 w-4 mr-2" />
              <span>{localObservation.location || 'Unknown location'}</span>
              {localObservation.latitude && localObservation.longitude && (
                <span className="ml-2 text-sm text-gray-500">
                  ({localObservation.latitude.toFixed(4)}, {localObservation.longitude.toFixed(4)})
                </span>
              )}
            </div>

            <div className="flex items-center text-gray-700">
              <Calendar className="h-4 w-4 mr-2" />
              <span>{new Date(localObservation.date).toLocaleDateString()}</span>
            </div>

            {localObservation.user && (
              <div className="flex items-center text-gray-700">
                <Avatar className="h-6 w-6 mr-2">
                  <AvatarFallback>{localObservation.user.name[0]}</AvatarFallback>
                </Avatar>
                <span>Observed by {localObservation.user.name}</span>
              </div>
            )}

            {localObservation.notes && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500 mb-1">Notes</p>
                <p className="text-gray-700">{localObservation.notes}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Identifications */}
          {localObservation.identifications && localObservation.identifications.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3 flex items-center">
                <CheckCircle className="h-4 w-4 mr-2" />
                Community Identifications
              </h3>
              <div className="space-y-2">
                {localObservation.identifications.map((ident: any) => (
                  <div key={ident.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{ident.userName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{ident.userName}</span>
                        {ident.verified && (
                          <Badge variant="secondary" className="text-xs">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Verified
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-700">
                        suggests <span className="font-medium">{ident.species}</span> for {ident.type}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(ident.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Separator />

          {/* Comments */}
          <div>
            <h3 className="font-semibold mb-3 flex items-center">
              <MessageSquare className="h-4 w-4 mr-2" />
              Comments ({localObservation.comments?.length || 0})
            </h3>

            {localObservation.comments && localObservation.comments.length > 0 && (
              <div className="space-y-3 mb-4">
                {localObservation.comments.map((comment: any) => (
                  <div key={comment.id} className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>{comment.userName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{comment.userName}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(comment.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{comment.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {accessToken ? (
              <div className="space-y-2">
                <Textarea
                  placeholder="Add a comment..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                />
                <Button
                  onClick={handleAddComment}
                  disabled={!comment.trim() || isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? 'Adding...' : 'Add Comment'}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                Sign in to add comments
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
