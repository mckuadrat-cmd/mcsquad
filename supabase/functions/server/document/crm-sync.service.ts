/**
 * Centralized CRM Sync Service for Document Engine V2
 * Handles safe status transitions (SUSPECT -> PROSPEK -> CONFIRM -> DEAL -> BUYER)
 * and bidirectional sync between Document, Lead, Client, and Calendar.
 */

export const STATUS_RANKS: Record<string, number> = {
  suspect: 1,
  SUSPECT: 1,
  prospek: 2,
  PROSPEK: 2,
  confirm: 3,
  CONFIRM: 3,
  deal: 4,
  DEAL: 4,
  buyer: 5,
  BUYER: 5
};

/**
 * Safely advance Lead & Client status (never downgrade status rank automatically)
 */
export async function advanceLeadAndClientStatus(
  supabase: any,
  leadId: string | null,
  schoolId: string | null,
  targetStatus: string,
  activityText?: string
): Promise<{ leadUpdated: boolean; clientUpdated: boolean; finalStatus: string }> {
  const normTarget = targetStatus.toLowerCase();
  const targetRank = STATUS_RANKS[normTarget] || 1;
  let finalStatus = targetStatus;
  let leadUpdated = false;
  let clientUpdated = false;

  // 1. Update Lead status if leadId is provided
  if (leadId) {
    const { data: existingLead } = await supabase
      .from('leads')
      .select('id, status, schoolId, schoolName')
      .eq('id', leadId)
      .maybeSingle();

    if (existingLead) {
      const currentRank = STATUS_RANKS[existingLead.status?.toLowerCase()] || 0;
      if (targetRank > currentRank) {
        const leadUpdateBody: Record<string, any> = {
          status: normTarget,
          updatedAt: new Date().toISOString()
        };
        if (activityText) {
          leadUpdateBody.lastActivity = activityText;
        }

        await supabase
          .from('leads')
          .update(leadUpdateBody)
          .eq('id', leadId);

        leadUpdated = true;
      }
      finalStatus = existingLead.status;
      if (!schoolId && existingLead.schoolId) {
        schoolId = existingLead.schoolId;
      }
    }
  }

  // 2. Sync Client status & proses
  if (schoolId) {
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id, proses, status, sekolah')
      .or(`id.eq.${schoolId},schoolId.eq.${schoolId}`)
      .limit(1)
      .maybeSingle();

    if (existingClient) {
      const clientCurrentRank = STATUS_RANKS[existingClient.proses?.toLowerCase() || existingClient.status?.toLowerCase()] || 0;
      if (targetRank > clientCurrentRank) {
        const clientUpdateBody: Record<string, any> = {
          proses: targetStatus.toUpperCase(),
          updatedAt: new Date().toISOString()
        };
        if (activityText) {
          clientUpdateBody.lastActivityDesc = activityText;
          clientUpdateBody.lastActivityAt = new Date().toISOString();
        }

        await supabase
          .from('clients')
          .update(clientUpdateBody)
          .eq('id', existingClient.id);

        clientUpdated = true;
      }
    }
  }

  return { leadUpdated, clientUpdated, finalStatus };
}

/**
 * Determine whether SKK confirmation results in CONFIRM or DEAL status
 * based on paymentDate vs current date month/year
 */
export function determineStatusFromPaymentDate(paymentDateStr?: string | Date | null): 'CONFIRM' | 'DEAL' {
  if (!paymentDateStr) return 'CONFIRM';

  const payDate = new Date(paymentDateStr);
  if (isNaN(payDate.getTime())) return 'CONFIRM';

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const payYear = payDate.getFullYear();
  const payMonth = payDate.getMonth();

  // If payment is in current month/year or in past -> DEAL
  if (payYear < currentYear || (payYear === currentYear && payMonth <= currentMonth)) {
    return 'DEAL';
  }

  // If payment is in future month -> CONFIRM
  return 'CONFIRM';
}

/**
 * Create or Update Calendar Event linked to Lead & Document
 */
export async function syncCalendarEvent(
  supabase: any,
  leadId: string,
  schoolId: string | null,
  schoolName: string,
  programTitle: string,
  startDateStr?: string | null,
  endDateStr?: string | null,
  startTimeStr: string = "08:00",
  endTimeStr: string = "16:00",
  existingEventId?: string | null
): Promise<string | null> {
  if (!startDateStr) return null;

  const eventId = existingEventId || `EVL-${leadId}`;

  // Format ISO Datetime
  const startIso = `${startDateStr}T${startTimeStr}:00`;
  const endIso = `${endDateStr || startDateStr}T${endTimeStr}:00`;

  const eventPayload = {
    id: eventId,
    title: `${schoolName} - ${programTitle}`,
    start: startIso,
    end: endIso,
    allDay: false,
    backgroundColor: '#E5EFFF',
    borderColor: '#4680FF',
    textColor: '#4680FF',
    extendedProps: {
      leadId,
      schoolId: schoolId || '',
      schoolName,
      program: programTitle,
      isEstimasi: true
    },
    updatedAt: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('calendar_events')
    .upsert(eventPayload)
    .select()
    .single();

  if (error) {
    console.error("Error upserting calendar event:", error.message);
    return null;
  }

  // Also update lead's date & calendarEventId
  await supabase
    .from('leads')
    .update({
      date: startDateStr,
      calendarEventId: eventId,
      updatedAt: new Date().toISOString()
    })
    .eq('id', leadId);

  return eventId;
}

/**
 * Explicitly remove calendar schedule without deleting Lead or Document
 */
export async function removeCalendarSchedule(
  supabase: any,
  leadId: string,
  calendarEventId?: string | null
): Promise<boolean> {
  const targetId = calendarEventId || `EVL-${leadId}`;

  try {
    // Delete calendar event
    await supabase
      .from('calendar_events')
      .delete()
      .eq('id', targetId);

    // Clear date & calendarEventId on Lead
    await supabase
      .from('leads')
      .update({
        date: 'TBD',
        calendarEventId: null,
        updatedAt: new Date().toISOString()
      })
      .eq('id', leadId);

    return true;
  } catch (err: any) {
    console.error("Error removing calendar schedule:", err.message);
    return false;
  }
}
