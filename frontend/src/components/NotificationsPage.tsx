import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { ObservationDetailModal } from './ObservationDetailModal';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Skeleton } from './ui/skeleton';
import { Bell, MessageSquare, CheckCircle, Award } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '../api/client';

interface Notification {
  id: string;
  userId: string;
  type: 'comment' | 'identification' | 'verification';
  message: string;
  observationId: string;
  read: boolean;
  createdAt: string;
}

interface NotificationsPageProps {
  accessToken: string;
  onNotificationRead?: (id?: string) => void;
}

export function NotificationsPage({ accessToken, onNotificationRead }: NotificationsPageProps) {
  const [, setLocation] = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedObservation, setSelectedObservation] = useState<any | null>(null);

  useEffect(() => {
    if (accessToken) fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setIsLoading(true);
    if (!accessToken) {
      // If not authenticated, avoid polling the edge function which will return 401s
      setNotifications([]);
      setIsLoading(false);
      return;
    }
    try {
      const response = await apiClient.get(
        '/notifications',
        accessToken
      );

      if (response.success) {
        setNotifications(response.data || []);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await apiClient.post(
        `/notifications/${notificationId}/read`,
        {},
        accessToken
      );

      if (response.success) {
        setNotifications(prev =>
          prev.map(notif =>
            notif.id === notificationId ? { ...notif, read: true } : notif
          )
        );
        // Inform parent (App) to decrement the badge count
        if (onNotificationRead) onNotificationRead(notificationId);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    // Mark notification as read first
    const ok = await markAsRead(notification.id);

    // Open the observation modal by fetching observation details
    try {
      const resp = await apiClient.get(`/observations/${notification.observationId}`, accessToken);
      if (resp.success && resp.data) {
        setSelectedObservation(resp.data);
      } else {
        // If we couldn't fetch details, still navigate to explore
        setLocation('/explore');
      }
    } catch (e) {
      console.error('Failed to fetch observation for notification:', e);
      setLocation('/explore');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'comment':
        return <MessageSquare className="h-5 w-5 text-blue-600" />;
      case 'identification':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'verification':
        return <Award className="h-5 w-5 text-green-600" />;
      default:
        return <Bell className="h-5 w-5 text-gray-600" />;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl">Notifications</h1>
          {unreadCount > 0 && (
            <Badge variant="secondary">
              {unreadCount} new
            </Badge>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Bell className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">No notifications yet</p>
            <p className="text-sm text-gray-400 mt-2">
              You'll see notifications here when someone interacts with your observations
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`cursor-pointer hover:shadow-md transition-shadow ${
                !notification.read ? 'border-l-4 border-l-green-600 bg-green-50' : 'bg-gray-50'
              }`}
              onClick={() => handleNotificationClick(notification)}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-900">{notification.message}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                  {!notification.read && (
                    <Badge variant="secondary" className="flex-shrink-0 self-start">
                      New
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {notifications.length > 0 && unreadCount > 0 && (
        <div className="mt-6 text-center">
          <Button
            variant="outline"
            onClick={async () => {
              const unread = notifications.filter(n => !n.read);
              for (const notif of unread) {
                await markAsRead(notif.id);
              }
              toast.success('All notifications marked as read');
            }}
          >
            Mark All as Read
          </Button>
        </div>
      )}

      {selectedObservation && (
        <ObservationDetailModal
          observation={selectedObservation}
          isOpen={!!selectedObservation}
          onClose={() => setSelectedObservation(null)}
          accessToken={accessToken}
          onUpdate={fetchNotifications}
        />
      )}
    </div>
  );
}
