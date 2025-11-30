import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { MapPin, Calendar, CheckCircle, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Separator } from './ui/separator';
import { apiClient } from '../api/client';

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
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    lepidopteraSpecies: observation?.lepidoptera?.species || '',
    hostPlantSpecies: observation?.hostPlant?.species || '',
    notes: observation?.notes || '',
    location: observation?.location || '',
    date: observation?.date ? new Date(observation.date).toISOString().slice(0,10) : ''
  });

  useEffect(() => {
    setLocalObservation(observation);
    setEditValues({
      lepidopteraSpecies: observation?.lepidoptera?.species || '',
      hostPlantSpecies: observation?.hostPlant?.species || '',
      notes: observation?.notes || '',
      location: observation?.location || '',
      date: observation?.date ? new Date(observation.date).toISOString().slice(0,10) : ''
    });
  }, [observation]);

  const handleAddComment = async () => {
    if (!comment.trim() || !accessToken) return;

    setIsSubmitting(true);
    try {
      const response = await apiClient.post(
        `/observations/${observation.id}/comments`,
        { text: comment },
        accessToken
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to add comment');
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
      const response = await apiClient.get(
        `/observations/${observation.id}`,
        accessToken
      );

      if (response.success) {
        setLocalObservation(response.data);
      }
    } catch (error) {
      console.error('Error fetching observation details:', error);
    }
  };

  const isOwner = !!(currentUserId && localObservation?.user && currentUserId === localObservation.user.id);

  const handleSaveEdit = async () => {
    if (!accessToken) {
      toast.error('Sign in to edit');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: any = {
        lepidoptera: { species: editValues.lepidopteraSpecies },
        hostPlant: { species: editValues.hostPlantSpecies },
        notes: editValues.notes,
        location: editValues.location,
        date: editValues.date
      };

      const response = await apiClient.put(
        `/observations/${localObservation.id}`,
        payload,
        accessToken
      );

      if (!response.success) {
        throw new Error(response.error || 'Failed to update observation');
      }

      const text = await response.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        data = text;
      }

      if (!response.ok) {
        const msg = data && typeof data === 'object' && data.error ? data.error : (typeof data === 'string' && data.length ? data : 'Failed to update observation');
        throw new Error(msg);
      }

      toast.success('Observation updated');
      setIsEditing(false);
      // refresh details
      fetchObservationDetails();
      onUpdate();
    } catch (err: any) {
      console.error('Update error', err);
      toast.error(err.message || 'Failed to update');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!accessToken) {
      toast.error('Sign in to delete');
      return;
    }

    const ok = window.confirm('Are you sure you want to delete this observation? This cannot be undone.');
    if (!ok) {
      return;
    }

    setIsSubmitting(true);
    try {
      // Try the serverless function first
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b55216b3/observations/${localObservation.id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        toast.success('Observation deleted successfully');
        onClose();
        onUpdate();
        return;
      }

      // If serverless function fails, try direct Supabase delete
      if (response.status === 404 || response.status === 502) {
        console.log('Serverless function not available, trying direct delete...');
        
        const supabase = getSupabaseClient();
        const { error } = await supabase
          .from('kv_store_b55216b3')
          .delete()
          .eq('key', `obs:${localObservation.id}`);

        if (error) {
          throw new Error(error.message || 'Failed to delete from database');
        }

        toast.success('Observation deleted successfully');
        setIsSubmitting(false);
        onClose();
        // Add a slight delay to ensure the modal closes before refresh
        setTimeout(() => onUpdate(), 300);
        return;
      }

      // Handle other errors
      const text = await response.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        data = text;
      }

      const msg = data && typeof data === 'object' && data.error ? data.error : (typeof data === 'string' && data.length ? data : `Failed to delete (${response.status})`);
      throw new Error(msg);
    } catch (err: any) {
      console.error('Delete error:', err);
      toast.error(err.message || 'Failed to delete observation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Observation Details</DialogTitle>
        </DialogHeader>

        {/* Observation Header */}
        <div className="bg-white rounded-lg p-6 mb-6">
          <div className="mb-4">
            <h2 className="text-2xl font-bold mb-1 flex items-center">
              <span className="mr-2">{localObservation.hostPlant?.commonName || 'Unknown Plant'}</span>
              <span className="italic text-gray-600 mr-2">{localObservation.hostPlant?.species || ''}</span>
              <span className="bg-gray-200 rounded px-2 py-1 text-xs ml-2">{localObservation.quality || 'Casual'}</span>
            </h2>
          </div>

          {/* Two Image Panels Side by Side */}
          <div className="flex gap-6 mb-6">
            {/* Lepidoptera Image */}
            <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden">
              <div className="w-full h-72 bg-gray-100" style={{backgroundImage: localObservation.lepidoptera?.image ? `url('${localObservation.lepidoptera.image}')` : undefined, backgroundSize: 'cover', backgroundPosition: 'center'}}>
                {!localObservation.lepidoptera?.image && (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">No image</div>
                )}
              </div>
              <div className="p-3 bg-gray-50 border-t border-gray-200">
                <h4 className="font-semibold mb-1"><span className="italic text-gray-700">{localObservation.lepidoptera?.species || 'Unknown Lepidoptera'}</span></h4>
                <div className="text-sm text-gray-500 flex items-center"><CheckCircle className="h-4 w-4 mr-1" /> {localObservation.lepidoptera?.identifications?.length || 0} identification(s)</div>
              </div>
            </div>

            {/* Host Plant Image */}
            <div className="flex-1 border border-gray-200 rounded-lg overflow-hidden">
              <div className="w-full h-72 bg-gray-100" style={{backgroundImage: localObservation.hostPlant?.image ? `url('${localObservation.hostPlant.image}')` : undefined, backgroundSize: 'cover', backgroundPosition: 'center'}}>
                {!localObservation.hostPlant?.image && (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">No image</div>
                )}
              </div>
              <div className="p-3 bg-gray-50 border-t border-gray-200">
                <h4 className="font-semibold mb-1">Host Plant</h4>
                <div className="text-sm text-gray-500 flex items-center"><CheckCircle className="h-4 w-4 mr-1" /> {localObservation.hostPlant?.identifications?.length || 0} identification(s)</div>
              </div>
            </div>
          </div>

          {/* User Info */}
          {localObservation.user && (
            <div className="flex items-center py-4 border-b border-gray-100">
              <div className="w-12 h-12 rounded-full bg-gray-200 mr-4" style={{backgroundImage: localObservation.user.avatar ? `url('${localObservation.user.avatar}')` : undefined, backgroundSize: 'cover', backgroundPosition: 'center'}}></div>
              <div>
                <h4 className="font-semibold text-base mb-1"><a href="#" className="hover:underline">{localObservation.user.name}</a></h4>
                <div className="text-sm text-gray-500"><CheckCircle className="h-4 w-4 mr-1 inline" /> {localObservation.user.observationCount || 0} observations</div>
              </div>
            </div>
          )}

          {/* Observation Details */}
          <div className="flex gap-8 py-4 border-b border-gray-100">
            <div className="text-sm">
              <strong className="block text-gray-600 mb-1">Observed:</strong>
              {localObservation.date ? new Date(localObservation.date).toLocaleString() : 'Unknown'}
            </div>
            <div className="text-sm">
              <strong className="block text-gray-600 mb-1">Location:</strong>
              {localObservation.location || 'Unknown location'}
            </div>
          </div>

          {/* Notes */}
          {localObservation.notes && (
            <div className="py-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-1">Notes</p>
                <p className="text-gray-700">{localObservation.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Activity Section: Identifications */}
        <div className="bg-white rounded-lg p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4">Activity</h3>
          {localObservation.identifications && localObservation.identifications.length > 0 ? (
            <div>
              {localObservation.identifications.map((ident: any) => (
                <div key={ident.id} className="flex gap-4 mb-6 pb-6 border-b border-gray-100">
                  <div className="w-10 h-10 rounded-full bg-gray-200" style={{backgroundImage: ident.userAvatar ? `url('${ident.userAvatar}')` : undefined, backgroundSize: 'cover', backgroundPosition: 'center'}}></div>
                  <div className="flex-1">
                    <div className="mb-2 flex items-center">
                      <span className="font-semibold mr-2">{ident.userName}</span>
                      <span className="text-xs text-gray-500">suggested an ID</span>
                      {ident.verified && <span className="bg-green-500 text-white rounded px-2 py-1 text-xs ml-2">Verified</span>}
                      <span className="text-xs text-gray-400 ml-2">{ident.createdAt ? new Date(ident.createdAt).toLocaleString() : ''}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-gray-50 rounded p-2">
                      <div className="w-12 h-12 rounded bg-gray-200" style={{backgroundImage: ident.taxonThumb ? `url('${ident.taxonThumb}')` : undefined, backgroundSize: 'cover', backgroundPosition: 'center'}}></div>
                      <div>
                        <strong>{ident.species}</strong>
                        <span className="italic text-gray-600 ml-2">{ident.scientificName}</span>
                      </div>
                      <Button variant="success" size="sm" className="ml-2">Agree</Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-400">No identifications yet.</div>
          )}
        </div>

        {/* Comments Section */}
        <div className="bg-white rounded-lg p-6 mb-6">
          <h3 className="text-xl font-semibold mb-4">Comments ({localObservation.comments?.length || 0})</h3>
          {localObservation.comments && localObservation.comments.length > 0 ? (
            <div className="space-y-4 mb-4">
              {localObservation.comments.map((comment: any) => (
                <div key={comment.id} className="flex gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200" style={{backgroundImage: comment.userAvatar ? `url('${comment.userAvatar}')` : undefined, backgroundSize: 'cover', backgroundPosition: 'center'}}></div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm">{comment.userName}</span>
                      <span className="text-xs text-gray-500">{comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}</span>
                    </div>
                    <p className="text-sm text-gray-700">{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-400">No comments yet.</div>
          )}

          {accessToken ? (
            <div className="mt-4">
              <Textarea
                placeholder="Add a comment..."
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
              <Button
                onClick={handleAddComment}
                disabled={!comment.trim() || isSubmitting}
                className="w-full mt-2"
              >
                {isSubmitting ? 'Adding...' : 'Add Comment'}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">Sign in to add comments</p>
          )}
        </div>

        {/* Owner actions: Edit / Delete */}
        {isOwner && (
          <div className="flex items-center justify-end gap-2 mb-6">
            {!isEditing ? (
              <>
                <Button variant="ghost" onClick={() => setIsEditing(true)}>Edit</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                  {isSubmitting ? 'Deleting...' : 'Delete'}
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button onClick={handleSaveEdit} disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save'}</Button>
                <Button variant="ghost" onClick={() => { setIsEditing(false); setEditValues({
                  lepidopteraSpecies: localObservation?.lepidoptera?.species || '',
                  hostPlantSpecies: localObservation?.hostPlant?.species || '',
                  notes: localObservation?.notes || '',
                  location: localObservation?.location || '',
                  date: localObservation?.date ? new Date(localObservation.date).toISOString().slice(0,10) : ''
                }); }}>Cancel</Button>
              </div>
            )}
          </div>
        )}

        {/* If editing, show form fields to edit some attributes */}
        {isEditing && (
          <div className="bg-white rounded-lg p-6 mb-6">
            <h3 className="font-semibold mb-4">Edit Observation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-500">Lepidoptera species</label>
                <Input value={editValues.lepidopteraSpecies} onChange={(e: any) => setEditValues({...editValues, lepidopteraSpecies: e.target.value})} />
              </div>
              <div>
                <label className="text-sm text-gray-500">Host plant species</label>
                <Input value={editValues.hostPlantSpecies} onChange={(e: any) => setEditValues({...editValues, hostPlantSpecies: e.target.value})} />
              </div>
              <div>
                <label className="text-sm text-gray-500">Location</label>
                <Input value={editValues.location} onChange={(e: any) => setEditValues({...editValues, location: e.target.value})} />
              </div>
              <div>
                <label className="text-sm text-gray-500">Date</label>
                <Input type="date" value={editValues.date} onChange={(e: any) => setEditValues({...editValues, date: e.target.value})} />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm text-gray-500">Notes</label>
                <Textarea value={editValues.notes} onChange={(e: any) => setEditValues({...editValues, notes: e.target.value})} rows={4} />
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
