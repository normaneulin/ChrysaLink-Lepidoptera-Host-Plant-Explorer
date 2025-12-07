import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Skeleton } from './ui/skeleton';
import { User, Award, TrendingUp, Camera, Trophy, Star } from 'lucide-react';
import { apiClient } from '../api/client';
import { AchievementsList } from './AchievementsList';
import { BadgeNotificationPopup } from './BadgeNotificationPopup';

interface BadgeThreshold {
  id: string;
  level: string;
  min_points: number;
  max_points?: number;
  description: string;
  color: string;
}

interface ProfilePageProps {
  accessToken: string;
  userId?: string;
}

export function ProfilePage({ accessToken, userId }: ProfilePageProps) {
  const [profile, setProfile] = useState<any>(null);
  const [badge, setBadge] = useState<any>(null);
  const [badgeThresholds, setBadgeThresholds] = useState<BadgeThreshold[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchProfile();
      fetchBadge();
      fetchBadgeThresholds();
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
          speciesAcceptedCount: response.data?.species_accepted_count || 0,
          identificationsAgreedCount: response.data?.identifications_agreed_count || 0,
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

  const fetchBadge = async () => {
    try {
      const response = await apiClient.getUserBadge(userId || '');
      if (response.success && response.data) {
        setBadge(response.data);
      }
    } catch (error) {
      console.error('Error fetching badge:', error);
    }
  };

  const fetchBadgeThresholds = async () => {
    try {
      const response = await apiClient.getBadgeThresholds();
      if (response.success && response.data) {
        setBadgeThresholds(response.data as BadgeThreshold[]);
      }
    } catch (error) {
      console.error('Error fetching badge thresholds:', error);
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
          // name is intentionally not set - user will edit it in their profile
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
          speciesAcceptedCount: data?.species_accepted_count || 0,
          identificationsAgreedCount: data?.identifications_agreed_count || 0,
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

  const getRatingLevel = (points: number = 0): { level: string; color: string } => {
    const threshold = badgeThresholds.find(
      (t) => points >= t.min_points && (t.max_points === null || points <= t.max_points)
    );
    
    if (threshold) {
      const colorMap: { [key: string]: string } = {
        gray: 'bg-gray-500',
        yellow: 'bg-yellow-500',
        green: 'bg-green-500',
        blue: 'bg-blue-500',
        purple: 'bg-purple-500',
      };
      return {
        level: threshold.level,
        color: colorMap[threshold.color] || 'bg-gray-500',
      };
    }
    
    return { level: 'Novice', color: 'bg-gray-500' };
  };

  const ratingInfo = getRatingLevel(badge?.totalPoints || 0);

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <BadgeNotificationPopup userId={userId || ''} accessToken={accessToken} />
      
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-start gap-6">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="text-3xl">
                {profile.username?.[0]?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2 flex-wrap">
                <h1 className="text-3xl">{profile.name}</h1>
                <Badge className={`${ratingInfo.color} text-white flex items-center gap-1`}>
                  <Star className="h-4 w-4" />
                  {ratingInfo.level}
                </Badge>
                {badge?.totalPoints !== undefined && (
                  <Badge variant="outline" className="border-blue-300 bg-blue-50">
                    {badge.totalPoints} points
                  </Badge>
                )}
              </div>
              
              <p className="font-medium">{profile.username}</p>
              <p className="text-gray-600 mb-2">{profile.email}</p>
              
              {profile.bio && (
                <p className="text-gray-700 mb-3">{profile.bio}</p>
              )}
              
              <div className="flex gap-6 text-sm text-gray-600 mb-4">
                <div>
                  <span className="font-medium">Member since:</span>{' '}
                  {new Date(profile.createdAt).toLocaleDateString()}
                </div>
                {/*
                <div>
                  <span className="font-medium text-gray-900">{profile.followers}</span>{' '}
                  Followers
                </div>
                <div>
                  <span className="font-medium text-gray-900">{profile.following}</span>{' '}
                  Following
                </div>
                */}
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
            <p className="text-sm text-gray-600 mt-2">
              Total number of observations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-green-600" />
              Validated Species 
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl">{profile.speciesAcceptedCount}</p>
            <p className="text-sm text-gray-600 mt-2">
              Verified species
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Verified Identifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl">{profile.identificationsAgreedCount}</p>
            <p className="text-sm text-gray-600 mt-2">
              My community-accepted identifications
            </p>
          </CardContent>
        </Card>
      </div>

      <AchievementsList userId={userId || ''} accessToken={accessToken} />

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Badge Levels & Point Ranges
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {badgeThresholds.length > 0 ? (
                badgeThresholds.map((threshold) => {
                  const colorMap: { [key: string]: string } = {
                    gray: 'bg-gray-100 border-gray-300',
                    yellow: 'bg-yellow-100 border-yellow-300',
                    green: 'bg-green-100 border-green-300',
                    blue: 'bg-blue-100 border-blue-300',
                    purple: 'bg-purple-100 border-purple-300',
                  };
                  const badgeColorMap: { [key: string]: string } = {
                    gray: 'bg-gray-500',
                    yellow: 'bg-yellow-500',
                    green: 'bg-green-500',
                    blue: 'bg-blue-500',
                    purple: 'bg-purple-500',
                  };
                  return (
                    <div
                      key={threshold.id}
                      className={`p-4 border-2 rounded-lg ${colorMap[threshold.color]}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {threshold.level}
                          </p>
                          <p className="text-sm text-gray-600 mt-1">
                            {threshold.description}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge
                            className={`text-white`}
                          >
                            {threshold.min_points}-
                            {threshold.max_points || '∞'} pts
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-gray-500 text-center py-8">
                  Loading badge information...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>How to Increase Your Badge Level</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-gray-700">
              <li>• Upload observations to earn points</li>
              <li>• Suggest species identifications on observations</li>
              <li>• Have your identifications verified by the community</li>
              <li>• Complete achievements to earn bonus points</li>
              <li>• Higher points unlock higher badge levels and unlock achievements</li>
              <li>• Get notified when you unlock new badges and achievements!</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}