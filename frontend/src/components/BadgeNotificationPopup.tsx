import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { X, Trophy } from 'lucide-react';
import { apiClient } from '../api/client';

interface BadgeNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  related_badge_id?: string;
  created_at: string;
  is_read: boolean;
}

interface BadgeNotificationPopupProps {
  userId: string;
  accessToken: string;
}

export function BadgeNotificationPopup({ userId, accessToken }: BadgeNotificationPopupProps) {
  const [notifications, setNotifications] = useState<BadgeNotification[]>([]);
  const [displayedNotifications, setDisplayedNotifications] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (userId) {
      fetchNotifications();
      // Poll for new notifications every 5 seconds
      const interval = setInterval(fetchNotifications, 5000);
      return () => clearInterval(interval);
    }
  }, [userId]);

  const fetchNotifications = async () => {
    const response = await apiClient.getUnreadNotifications(userId);
    if (response.success && response.data) {
      const newNotifications = response.data as BadgeNotification[];
      setNotifications(newNotifications);

      // Auto-display new badge elevation notifications
      newNotifications.forEach((notif) => {
        if (notif.type === 'badge_elevation' && !displayedNotifications.has(notif.id)) {
          setDisplayedNotifications((prev) => new Set([...prev, notif.id]));
        }
      });
    }
  };

  const dismissNotification = async (notificationId: string) => {
    await apiClient.markNotificationAsRead(notificationId);
    setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
  };

  // Get badge elevation notifications that should be displayed as popups
  const badgeElevationNotifications = notifications.filter(
    (n) => n.type === 'badge_elevation' && displayedNotifications.has(n.id)
  );

  if (badgeElevationNotifications.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {badgeElevationNotifications.map((notification) => (
        <Card
          key={notification.id}
          className="w-96 border-2 border-purple-500 bg-gradient-to-br from-purple-50 to-indigo-50 shadow-lg animate-in fade-in slide-in-from-top-4"
        >
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <Trophy className="h-6 w-6 text-purple-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <CardTitle className="text-lg text-purple-900">
                    {notification.title}
                  </CardTitle>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => dismissNotification(notification.id)}
                className="h-6 w-6 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700 mb-4">{notification.message}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => dismissNotification(notification.id)}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                Awesome!
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
