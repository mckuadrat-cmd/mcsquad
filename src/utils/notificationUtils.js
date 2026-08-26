import { invokeApi } from '../lib/supabase';

/**
 * Sends a persistent notification to a specific user or finding user by name.
 * @param {string} targetName - The name of the user (PIC) to receive the notification.
 * @param {object} notification - { title, text, type, link }
 */
export const sendNotificationByName = async (targetName, notification) => {
  if (!targetName || targetName === 'Staff' || targetName === 'System') return;

  try {
    // 1. Find user ID by name from profiles table
    const { data: users } = await invokeApi(`/profiles?name=eq.${encodeURIComponent(targetName)}&limit=1`);

    if (!users || users.length === 0) {
      console.warn(`User with name ${targetName} not found for notification.`);
      return;
    }

    const userId = users[0].id;

    // 2. Add to notification collection
    await invokeApi('/user_notifications', {
      method: 'POST',
      body: {
        id: `NOT-${Math.floor(Math.random() * 90000) + 10000}`,
        userId,
        title: notification.title,
        text: notification.text,
        type: notification.type || 'info',
        link: notification.link || '',
        read: false,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error("Error sending notification:", error);
  }
};
