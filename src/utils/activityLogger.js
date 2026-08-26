import { invokeApi } from '../lib/supabase';

export const logActivity = async (currentUser, text, refId = '', refType = 'General', activityCategory = 'General', extraInfo = '') => {
  if (!currentUser?.uid) return;
  try {
    const activityData = {
      userId: currentUser.uid,
      userName: currentUser.displayName || currentUser.email,
      date: new Date().toISOString().split('T')[0],
      text: text,
      extraInfo: extraInfo || '',
      type: 'auto',
      refId: refId || '',
      refType: refType || 'General',
      category: activityCategory || 'General',
      isDone: true,
      createdAt: new Date().toISOString()
    };

    await invokeApi('/daily_activities', { method: 'POST', body: activityData });

    // Update Client Last Activity if relevant
    if (refId) {
      if (refType === 'Client') {
        await invokeApi(`/clients?id=eq.${refId}`, {
          method: 'PUT',
          body: {
            lastActivityDesc: text,
            lastActivityAt: new Date().toISOString()
          }
        });
      }
    }
  } catch (e) {
    console.error("Failed to log activity", e);
  }
};
