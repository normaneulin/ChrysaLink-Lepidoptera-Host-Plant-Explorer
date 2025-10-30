import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Avatar, AvatarFallback } from './ui/avatar';
import { Skeleton } from './ui/skeleton';
import { User, Award, TrendingUp, Camera } from 'lucide-react';
import { projectId, publicAnonKey } from '../utils/supabase/info';
import { getSupabaseClient } from '../utils/supabase/client';

const supabase = getSupabaseClient();

interface ProfilePageProps {
  accessToken: string;
}

export function ProfilePage({ accessToken }: ProfilePageProps) {
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setIsLoading(true);
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser(accessToken);
      
      if (!user) {
        throw new Error('User not found');
      }

      // Fetch user profile
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-b55216b3/users/${user.id}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );

      const data = await response.json();

      if (response.ok) {
        setProfile(data.user);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
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
          <CardContent className="py-12 text-center">
            <p className="text-gray-500">Profile not found</p>
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
              <p className="text-gray-600 mb-4">{profile.email}</p>
              <div className="flex gap-4 text-sm text-gray-600">
                <div>
                  <span className="font-medium">Member since:</span>{' '}
                  {new Date(profile.createdAt).toLocaleDateString()}
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
              <Award className="h-5 w-5 text-green-600" />
              Rating Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl">{profile.rating || 0}</p>
            <p className="text-sm text-gray-600 mt-2">
              Earn points by having your identifications verified
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Camera className="h-5 w-5 text-blue-600" />
              Observations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl">{profile.observationCount || 0}</p>
            <p className="text-sm text-gray-600 mt-2">
              Total observations uploaded
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Contributions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl">{profile.contributions || 0}</p>
            <p className="text-sm text-gray-600 mt-2">
              Total community contributions
            </p>
          </CardContent>
        </Card>
      </div>

      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Rating System
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
