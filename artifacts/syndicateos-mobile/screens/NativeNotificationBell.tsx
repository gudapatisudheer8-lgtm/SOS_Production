import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { nativeApi } from '@/lib/native-api';
import { Banner, Btn, Card } from '@/components/ui';
import { Dialog } from '@/screens/ErpScreens';
import { errMessage } from '@/lib/session';

interface NotificationFeed {
  unread: number;
  items: { id: string; projectId: string; inventoryId?: string; title: string; message: string; createdAt: string; read: boolean }[];
}

export function NativeNotificationBell() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const feed = useQuery({
    queryKey: ['native-notifications'],
    queryFn: () => nativeApi<NotificationFeed>('/api/notifications'),
    refetchInterval: 30000,
  });
  const markRead = async (id: string) => {
    setError('');
    try {
      await nativeApi(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
      await feed.refetch();
    } catch (e) { setError(errMessage(e)); }
  };
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Notifications, ${feed.data?.unread ?? 0} unread`}
      onPress={() => setOpen(true)} style={{ padding: 11, borderRadius: 24, borderWidth: 1, borderColor: '#e5e7eb', backgroundColor: '#fff' }}>
      <Feather name="bell" size={18} color="#111827" />
      {Boolean(feed.data?.unread) && <View style={{ position: 'absolute', right: 0, top: 0, borderRadius: 10, paddingHorizontal: 4, backgroundColor: '#ffbf00' }}>
        <Text style={{ fontSize: 10, fontWeight: '700' }}>{feed.data!.unread}</Text>
      </View>}
    </Pressable>
    {open && <Dialog title="Notifications & registration reminders" onClose={() => setOpen(false)}>
      {(error || feed.isError) && <Banner tone="error" title="Notifications could not load" text={error || errMessage(feed.error)} />}
      {feed.isLoading && <Text>Loading notifications…</Text>}
      {!feed.isLoading && !feed.isError && !feed.data?.items.length && <Text>No notifications yet.</Text>}
      {feed.data?.items.map(item => <Card key={item.id}>
        <Text style={{ fontFamily: 'Inter_700Bold', color: '#111827' }}>{item.title}</Text>
        <Text style={{ fontSize: 13, color: '#4b5563', marginTop: 6 }}>{item.message}</Text>
        <Text style={{ fontSize: 11, color: '#6b7280', marginVertical: 8 }}>{new Date(item.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</Text>
        {!item.read && <Btn label="Mark as read" variant="ghost" onPress={() => void markRead(item.id)} />}
      </Card>)}
      <Text style={{ color: '#6b7280', fontSize: 11 }}>Times are shown in India time. Saved project notifications are shared with authorized partners and accountants.</Text>
    </Dialog>}
  </>;
}
