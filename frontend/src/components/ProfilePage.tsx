import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Skeleton } from './ui/skeleton';
import { User, Award, TrendingUp, Camera } from 'lucide-react';
import { apiClient } from '../api/client';

interface ProfilePageProps {
  accessToken: string;
  userId?: string;
}

export function ProfilePage({ accessToken, userId }: ProfilePageProps) {
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchProfile();
    }
  }, [userId]);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      // Fetch user profile directly from Supabase
      const response = await apiClient.getProfile(userId || '');

      if (response.success && response.data) {
        setProfile({
          ...response.data,
          bio: response.data?.bio || '',
          followers: response.data?.followers || 0,
          following: response.data?.following || 0,
          observationCount: response.data?.observation_count || 0,
          validatedSpecies: response.data?.validated_species || 0,
          validatedIdentifications: response.data?.validated_identifications || 0,
          createdAt: response.data?.created_at
        });
      } else if (response.error && userId) {
        console.error('Profile fetch failed:', response.error);
        // Try to create profile if it doesn't exist
        await createProfileIfNotExists();
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const createProfileIfNotExists = async () => {
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        import.meta.env.VITE_SUPABASE_URL || `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co`,
        import.meta.env.VITE_SUPABASE_ANON_KEY || ''
      );

      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          name: 'User',
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating profile:', error);
      } else {
        console.log('Profile created:', data);
        setProfile({
          ...data,
          bio: data?.bio || '',
          followers: data?.followers || 0,
          following: data?.following || 0,
          observationCount: data?.observation_count || 0,
          validatedSpecies: data?.validated_species || 0,
          validatedIdentifications: data?.validated_identifications || 0,
          createdAt: data?.created_at
        });
      }
    } catch (error) {
      console.error('Exception creating profile:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <div className="grid md:grid-cols-3 gap-4">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardContent className="py-12">
            <div className="text-center space-y-4">
              <p className="text-gray-500">Profile not found</p>
              <p className="text-sm text-gray-400">UserId: {userId}</p>
              <Button onClick={fetchProfile} variant="outline">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getRatingLevel = (rating: number) => {
    if (rating >= 100) return { level: 'Expert', color: 'bg-purple-500' };
    if (rating >= 50) return { level: 'Advanced', color: 'bg-blue-500' };
    if (rating >= 20) return { level: 'Intermediate', color: 'bg-green-500' };
    if (rating >= 5) return { level: 'Beginner', color: 'bg-yellow-500' };
    return { level: 'Novice', color: 'bg-gray-500' };
  };

  const ratingInfo = getRatingLevel(profile.rating || 0);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="text-3xl">
                {profile.name?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl">{profile.name}</h1>
                <Badge className={`${ratingInfo.color} text-white`}>
                  {ratingInfo.level}
                </Badge>
              </div>
              <p className="text-gray-600 mb-2">{profile.email}</p>
              
              {profile.bio && (
                <p className="text-gray-700 mb-3">{profile.bio}</p>
              )}
              
              <div className="flex gap-6 text-sm text-gray-600 mb-4">
                <div>
                  <span className="font-medium">Member since:</span>{' '}
                  {new Date(profile.createdAt).toLocaleDateString()}
                </div>
                <div>
                  <span className="font-medium text-gray-900">{profile.followers}</span>{' '}
                  Followers
                </div>
                <div>
                  <span className="font-medium text-gray-900">{profile.following}</span>{' '}
                  Following
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="h-5 w-5 text-blue-600" />
              Observations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl">{profile.observationCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-green-600" />
              Species
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl">{profile.validatedSpecies}</p>
            <p className="text-sm text-gray-600 mt-2">
              Validated observation entries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Identifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl">{profile.validatedIdentifications}</p>
            <p className="text-sm text-gray-600 mt-2">
              Validated suggested IDs
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Expertise Level & Rating System
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <p className="font-medium">Novice</p>
                <p className="text-sm text-gray-600">Starting out</p>
              </div>
              <Badge className="bg-gray-500 text-white">0-4 points</Badge>
            </div>
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <p className="font-medium">Beginner</p>
                <p className="text-sm text-gray-600">Learning the basics</p>
              </div>
              <Badge className="bg-yellow-500 text-white">5-19 points</Badge>
            </div>
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <p className="font-medium">Intermediate</p>
                <p className="text-sm text-gray-600">Developing expertise</p>
              </div>
              <Badge className="bg-green-500 text-white">20-49 points</Badge>
            </div>
            <div className="flex items-center justify-between pb-3 border-b">
              <div>
                <p className="font-medium">Advanced</p>
                <p className="text-sm text-gray-600">Reliable identifier</p>
              </div>
              <Badge className="bg-blue-500 text-white">50-99 points</Badge>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Expert</p>
                <p className="text-sm text-gray-600">Community expert</p>
              </div>
              <Badge className="bg-purple-500 text-white">100+ points</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 p-6 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold mb-2">How to Increase Your Rating</h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li>• Suggest species identifications on observations</li>
          <li>• Have your identifications verified by the community</li>
          <li>• Each verified identification earns you 1 rating point</li>
          <li>• Higher ratings increase your credibility in the community</li>
        </ul>
      </div>
    </div>
  );
}
