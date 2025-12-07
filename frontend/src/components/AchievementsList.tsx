import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Skeleton } from './ui/skeleton';
import { Trophy, Lock } from 'lucide-react';
import { apiClient } from '../api/client';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon_url?: string;
  points_reward: number;
  unlocked_at?: string;
}

interface UserAchievementData {
  id: string;
  unlocked_at: string;
  achievement: Achievement;
}

interface AchievementsListProps {
  userId: string;
  accessToken: string;
}

export function AchievementsList({ userId, accessToken }: AchievementsListProps) {
  const [achievements, setAchievements] = useState<UserAchievementData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (userId) {
      fetchAchievements();
    }
  }, [userId]);

  const fetchAchievements = async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.getUserAchievements(userId);
      if (response.success && response.data) {
        setAchievements(response.data as UserAchievementData[]);
      }
    } catch (error) {
      console.error('Error fetching achievements:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5" />
            Achievements
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5" />
          Achievements ({achievements.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {achievements.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No achievements unlocked yet. Keep contributing to earn badges!
          </p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {achievements.map((item) => (
              <div
                key={item.id}
                className="p-4 border rounded-lg hover:border-blue-400 transition-colors bg-gradient-to-br from-yellow-50 to-orange-50 border-yellow-200"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">
                      {item.achievement.name}
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">
                      {item.achievement.description}
                    </p>
                  </div>
                  <Trophy className="h-5 w-5 text-yellow-600 flex-shrink-0" />
                </div>
                <div className="flex items-center justify-between mt-3">
                  <Badge className="bg-yellow-500 text-white">
                    +{item.achievement.points_reward} pts
                  </Badge>
                  <span className="text-xs text-gray-500">
                    {new Date(item.unlocked_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
