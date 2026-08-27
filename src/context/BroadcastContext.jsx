import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase, invokeApi, parseDates } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useNotification } from './NotificationContext';
import { renderTemplateContent, dispatchWaMessage } from '../utils/whatsappUtils';
import { logActivity } from '../utils/activityLogger';

const BroadcastContext = createContext();

export const BroadcastProvider = ({ children }) => {
  const { currentUser } = useAuth();
  const { showToast, showAlert } = useNotification();

  const [waSettings, setWaSettings] = useState({
    id: 'default',
    provider_type: 'meta_waba',
    phone_number_id: '',
    waba_access_token: '',
    third_party_name: 'Fonnte',
    third_party_api_key: '',
    third_party_endpoint: 'https://api.fonnte.com/send',
    default_salutation: 'Bapak/Ibu',
  });

  const [templates, setTemplates] = useState([]);
  const [broadcasts, setBroadcasts] = useState([]);
  const [dripSequences, setDripSequences] = useState([]);
  const [dripSteps, setDripSteps] = useState([]);
  const [clientDrips, setClientDrips] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all WhatsApp broadcast related data
  const refreshBroadcastData = useCallback(async () => {
    if (!currentUser) return;
    try {
      const [
        { data: settings },
        { data: templatesData },
        { data: broadcastsData },
        { data: dripSeqData },
        { data: dripStepsData },
        { data: clientDripsData }
      ] = await Promise.all([
        supabase.from('wa_settings').select('*'),
        supabase.from('wa_templates').select('*').order('created_at', { ascending: false }),
        supabase.from('wa_broadcasts').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('wa_drip_sequences').select('*').order('created_at', { ascending: false }),
        supabase.from('wa_drip_steps').select('*').order('created_at', { ascending: true }),
        supabase.from('wa_client_drips').select('*').order('updated_at', { ascending: false }).limit(300)
      ]);

      if (settings && settings.length > 0) {
        setWaSettings(settings[0]);
      }
      setTemplates(parseDates(templatesData || [], ['created_at', 'updated_at']));
      setBroadcasts(parseDates(broadcastsData || [], ['scheduled_at', 'created_at', 'updated_at']));
      setDripSequences(parseDates(dripSeqData || [], ['created_at', 'updated_at']));
      setDripSteps(parseDates(dripStepsData || [], ['created_at']));
      setClientDrips(parseDates(clientDripsData || [], ['last_sent_at', 'next_scheduled_at', 'created_at', 'updated_at']));
    } catch (err) {
      console.error('Error fetching broadcast data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    refreshBroadcastData();

    const channel = supabase.channel(`public:wa_client_drips_${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_client_drips' }, async () => {
        const { data } = await supabase.from('wa_client_drips').select('*').order('updated_at', { ascending: false }).limit(300);
        if (data) {
          setClientDrips(parseDates(data, ['last_sent_at', 'next_scheduled_at', 'created_at', 'updated_at']));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refreshBroadcastData]);

  // Update WA Gateway Settings
  const updateSettings = async (newSettings) => {
    try {
      const payload = { ...waSettings, ...newSettings, id: 'default', updated_at: new Date().toISOString() };
      await invokeApi('/wa_settings', {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      setWaSettings(payload);
      showToast('Pengaturan WhatsApp berhasil disimpan!', 'success');
      return true;
    } catch (err) {
      console.error('Failed to update WA settings:', err);
      showAlert('Gagal Menyimpan', 'Terjadi kesalahan saat menyimpan pengaturan WhatsApp.');
      return false;
    }
  };

  // CRUD Templates
  const saveTemplate = async (templateData) => {
    try {
      const isEdit = !!templateData.id;
      const path = isEdit ? `/wa_templates?id=eq.${templateData.id}` : '/wa_templates';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        name: templateData.name,
        category: 'cold_outreach',
        content: templateData.content,
        step_number: templateData.step_number ? parseInt(templateData.step_number, 10) : null,
        delay_days: templateData.delay_days ? parseInt(templateData.delay_days, 10) : null,
        updated_at: new Date().toISOString()
      };

      if (!isEdit) {
        payload.created_at = new Date().toISOString();
      }

      await invokeApi(path, {
        method,
        body: JSON.stringify(payload)
      });

      showToast(isEdit ? 'Template diperbarui!' : 'Template baru dibuat!', 'success');
      refreshBroadcastData();
      return true;
    } catch (err) {
      console.error('Save template error:', err);
      showAlert('Gagal', 'Gagal menyimpan template.');
      return false;
    }
  };

  const deleteTemplate = async (id) => {
    try {
      await invokeApi(`/wa_templates?id=eq.${id}`, { method: 'DELETE' });
      showToast('Template berhasil dihapus', 'info');
      refreshBroadcastData();
      return true;
    } catch (err) {
      console.error('Delete template error:', err);
      showAlert('Gagal', 'Tidak dapat menghapus template.');
      return false;
    }
  };

  const deleteClientDrip = async (id) => {
    try {
      await invokeApi(`/wa_client_drips?id=eq.${id}`, { method: 'DELETE' });
      showToast('Data antrean Proses Sapa berhasil dihapus', 'info');
      refreshBroadcastData();
      return true;
    } catch (err) {
      console.error('Delete client drip error:', err);
      showAlert('Gagal', 'Tidak dapat menghapus data antrean.');
      return false;
    }
  };

  // Create & Dispatch Broadcast Campaign
  const createBroadcast = async ({ title, templateId, customContent, clientsList, scheduledAt, providerType }) => {
    try {
      const selectedTemplate = templates.find(t => t.id === templateId);
      const messageBody = customContent || selectedTemplate?.content || '';
      const activeProvider = providerType || waSettings.provider_type || 'manual';

      const broadcastPayload = {
        title,
        provider_type: activeProvider,
        template_id: templateId || null,
        custom_content: messageBody,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString(),
        status: scheduledAt && new Date(scheduledAt) > new Date() ? 'scheduled' : 'processing',
        total_recipients: clientsList.length,
        sent_count: 0,
        failed_count: 0,
        created_by: currentUser?.email || 'User',
        created_at: new Date().toISOString()
      };

      const { data: createdBroadcastArr } = await invokeApi('/wa_broadcasts', {
        method: 'POST',
        body: JSON.stringify(broadcastPayload)
      });

      const createdBroadcast = Array.isArray(createdBroadcastArr) ? createdBroadcastArr[0] : createdBroadcastArr;
      const broadcastId = createdBroadcast?.id;

      // Create queue items
      const itemsPayload = clientsList.map(c => ({
        broadcast_id: broadcastId,
        client_id: c.id,
        client_name: c.nama || c.name || c.panggilan || c.nickname || 'Client',
        school_name: c.sekolah || c.school || '',
        phone: c.whatsapp || c.phone || '',
        rendered_message: renderTemplateContent(messageBody, c, waSettings),
        scheduled_at: broadcastPayload.scheduled_at,
        status: broadcastPayload.status === 'scheduled' ? 'scheduled' : 'pending',
        created_at: new Date().toISOString()
      }));

      if (itemsPayload.length > 0) {
        await invokeApi('/wa_broadcast_items', {
          method: 'POST',
          body: JSON.stringify(itemsPayload)
        });
      }

      showToast(`Broadcast "${title}" berhasil dibuat (${clientsList.length} penerima)!`, 'success');
      refreshBroadcastData();
      return createdBroadcast;
    } catch (err) {
      console.error('Create broadcast error:', err);
      showAlert('Gagal Broadcast', 'Terjadi kesalahan saat membuat broadcast.');
      return null;
    }
  };

  // Start Cold Outreach Drip Sequence ("Proses Sapa") for a client
  const startClientDrip = async (client, sequenceId) => {
    try {
      const activeSeq = dripSequences.find(s => s.id === sequenceId) || dripSequences[0];
      const seqId = activeSeq?.id || 'd1a93e32-2415-46b7-84d4-28b9fb6c0850';

      // Check if client is already in active drip
      const clientNameStr = client.nama || client.name || client.panggilan || client.nickname || 'Client';
      const existing = clientDrips.find(cd => cd.client_id === client.id && cd.status === 'active');
      if (existing) {
        showToast(`Client ${clientNameStr} sudah aktif dalam Proses Sapa.`, 'info');
        return existing;
      }

      const nextScheduled = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const payload = {
        client_id: client.id,
        client_name: clientNameStr,
        school_name: client.sekolah || client.school || '',
        phone: client.whatsapp || client.phone || '',
        drip_sequence_id: seqId,
        current_step_number: 1,
        status: 'active',
        next_scheduled_at: nextScheduled,
        created_by: currentUser?.email || 'system',
        created_at: new Date().toISOString()
      };

      const { data: created } = await invokeApi('/wa_client_drips', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      // Update client status in CRM to SAPA / COLD
      await invokeApi(`/clients?id=eq.${client.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'COLD',
          proses: 'SAPA',
          lastActivityDesc: 'Proses Sapa Tahap 1',
          lastActivityAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
      });

      // Log daily activity
      await logActivity(
        currentUser,
        `Proses Sapa diaktifkan untuk client ${clientNameStr} (Tahap 1 dijadwalkan +15 Menit)`,
        client.id,
        'Client',
        'WhatsApp'
      );

      showToast(`Proses Sapa diaktifkan untuk ${client.name}!`, 'success');
      refreshBroadcastData();
      return Array.isArray(created) ? created[0] : created;
    } catch (err) {
      console.error('Start client drip error:', err);
      showAlert('Gagal Drip', 'Gagal memulai Proses Sapa untuk client ini.');
      return null;
    }
  };

  // Stop/Pause Drip Sequence for a client
  const stopClientDrip = async (dripId, reason = 'Stopped manually') => {
    try {
      const drip = clientDrips.find(d => d.id === dripId);

      await invokeApi(`/wa_client_drips?id=eq.${dripId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'stopped_replied',
          stop_reason: reason,
          updated_at: new Date().toISOString()
        })
      });

      if (drip) {
        // Update client status in CRM to COLD
        await invokeApi(`/clients?id=eq.${drip.client_id}`, {
          method: 'PUT',
          body: JSON.stringify({
            status: 'COLD',
            proses: 'COLD',
            lastActivityDesc: `Proses Sapa dihentikan manual: "${reason}"`,
            lastActivityAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
        });

        // Log daily activity
        await logActivity(
          currentUser,
          `Proses Sapa dihentikan manual untuk client ${drip.client_name}: "${reason}"`,
          drip.client_id,
          'Client',
          'WhatsApp'
        );
      }

      showToast('Proses Sapa dihentikan', 'info');
      refreshBroadcastData();
      return true;
    } catch (err) {
      console.error('Stop drip error:', err);
      return false;
    }
  };

  // Execute a single queue item or drip step (manual or auto)
  const sendQueueItem = async (item, clientObj = {}) => {
    try {
      const message = item.rendered_message || renderTemplateContent(item.content || '', clientObj, waSettings);
      const res = await dispatchWaMessage(waSettings, item.phone, message);

      if (item.id && item.broadcast_id) {
        // Update item status in DB
        await invokeApi(`/wa_broadcast_items?id=eq.${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: res.mode === 'manual' ? 'manual_opened' : 'sent',
            sent_at: new Date().toISOString()
          })
        });
      }

      showToast(`Pesan terkirim/terbuka untuk ${item.client_name || item.phone}`, 'success');
      refreshBroadcastData();
      return res;
    } catch (err) {
      console.error('Send queue item error:', err);
      if (item.id && item.broadcast_id) {
        await invokeApi(`/wa_broadcast_items?id=eq.${item.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            status: 'failed',
            error_message: err.message
          })
        });
      }
      showAlert('Gagal Kirim', err.message || 'Pesan gagal dikirim');
      return null;
    }
  };

  // Fetch items/recipients for a specific broadcast
  const fetchBroadcastItems = async (broadcastId) => {
    try {
      const { data } = await invokeApi(`/wa_broadcast_items?broadcast_id=eq.${broadcastId}&order=created_at.asc`);
      return parseDates(data || [], ['scheduled_at', 'sent_at', 'created_at', 'updated_at']);
    } catch (err) {
      console.error('Fetch broadcast items error:', err);
      return [];
    }
  };

  return (
    <BroadcastContext.Provider value={{
      waSettings,
      templates,
      broadcasts,
      dripSequences,
      dripSteps,
      clientDrips,
      loading,
      refreshBroadcastData,
      updateSettings,
      saveTemplate,
      deleteTemplate,
      createBroadcast,
      startClientDrip,
      stopClientDrip,
      deleteClientDrip,
      sendQueueItem,
      fetchBroadcastItems
    }}>
      {children}
    </BroadcastContext.Provider>
  );
};

export const useBroadcast = () => {
  const context = useContext(BroadcastContext);
  if (!context) {
    throw new Error('useBroadcast must be used within a BroadcastProvider');
  }
  return context;
};
