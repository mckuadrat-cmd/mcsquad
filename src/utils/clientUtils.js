import { supabase } from '../lib/supabase';

/**
 * Calculates dynamic client status based on inactivity duration.
 * - > 45 days inactivity: COLD
 * - > 14 days inactivity & currently HOT: WARM
 */
export const calculateDynamicClientStatus = (client) => {
  if (!client) return 'COLD';
  const currentStatus = (client.status || 'COLD').toUpperCase();

  const rawDate = client.lastActivityAt || client.updatedAt || client.createdAt;
  if (!rawDate) return currentStatus;

  const lastActivityDate = new Date(rawDate);
  if (isNaN(lastActivityDate.getTime())) return currentStatus;

  const now = new Date();
  const diffDays = (now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays > 45) {
    return 'COLD';
  } else if (diffDays > 14 && currentStatus === 'HOT') {
    return 'WARM';
  }

  return currentStatus;
};

/**
 * Normalizes Indonesian school names to catch abbreviations and typos.
 * e.g. "SMA Negeri 1 Jakarta", "SMAN 1 Jakarta", "SMA N 1 Jakarta" -> "sma1jakarta"
 */
export const normalizeSchoolName = (name) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\bnegeri\b/g, '')
    .replace(/\bsman\b/g, 'sma ')
    .replace(/\bsmkn\b/g, 'smk ')
    .replace(/\bsmpn\b/g, 'smp ')
    .replace(/\bsdn\b/g, 'sd ')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

/**
 * Calculates Levenshtein Distance between two strings for similarity score.
 */
export const getLevenshteinDistance = (a, b) => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

/**
 * Finds exact, normalized, or fuzzy similar school from an existing school list.
 */
export const findSimilarSchool = (schoolName, existingSchools) => {
  if (!schoolName || !existingSchools || existingSchools.length === 0) return null;

  const trimmed = schoolName.trim();
  // 1. Exact Name match
  const exactMatch = existingSchools.find(s => s.name.trim().toLowerCase() === trimmed.toLowerCase());
  if (exactMatch) return { school: exactMatch, matchType: 'exact', similarity: 100 };

  // 2. Normalized Name match (abbreviations like SMAN vs SMA Negeri)
  const targetNorm = normalizeSchoolName(trimmed);
  const normMatch = existingSchools.find(s => normalizeSchoolName(s.name) === targetNorm);
  if (normMatch) return { school: normMatch, matchType: 'normalized', similarity: 95 };

  // 3. Fuzzy Levenshtein match (> 80% similarity)
  if (targetNorm.length > 4) {
    for (const s of existingSchools) {
      const existingNorm = normalizeSchoolName(s.name);
      if (existingNorm.length > 4) {
        const distance = getLevenshteinDistance(targetNorm, existingNorm);
        const maxLength = Math.max(targetNorm.length, existingNorm.length);
        const similarity = (maxLength - distance) / maxLength;

        if (similarity >= 0.8) {
          return { school: s, matchType: 'fuzzy', similarity: Math.round(similarity * 100) };
        }
      }
    }
  }

  return null;
};

/**
 * Updates the last activity information and auto-upgrades COLD status to WARM.
 * @param {string} schoolName - The exact name of the school to update.
 * @param {string} description - A brief description of the activity.
 */
export const updateClientActivity = async (schoolName, description) => {
  if (!schoolName || !description) return;

  try {
    const updatePayload = {
      lastActivityDesc: description,
      lastActivityAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await supabase
      .from('clients')
      .update(updatePayload)
      .eq('sekolah', schoolName);
  } catch (error) {
    console.error(`Error updating last activity for school ${schoolName}:`, error);
  }
};

/**
 * Updates Status (COLD/WARM/HOT) and Proses (SUSPECT/PROSPEK/etc) for a client/school.
 * @param {string} schoolName - Exact school name.
 * @param {string} status - 'COLD' | 'WARM' | 'HOT'
 * @param {string} proses - 'SUSPECT' | 'PROSPEK' | 'DEAL' | 'CONFIRM' | 'BUYER' | 'CANCEL'
 */
export const updateClientStatusAndProses = async (schoolName, status, proses) => {
  if (!schoolName) return;

  const updatePayload = {
    updatedAt: new Date().toISOString()
  };
  if (status) updatePayload.status = status.toUpperCase();
  if (proses) updatePayload.proses = proses.toUpperCase();

  try {
    await supabase
      .from('clients')
      .update(updatePayload)
      .eq('sekolah', schoolName);
  } catch (error) {
    console.error(`Error updating client status/proses for ${schoolName}:`, error);
  }
};

/**
 * Cascades school name and ID changes to all related records in other collections.
 * @param {string} oldSchoolId - The current ID of the school.
 * @param {string} newSchoolId - The new ID of the school.
 * @param {string} oldName - The previous name of the school.
 * @param {string} newName - The new corrected name of the school.
 */
export const cascadeSchoolNameUpdate = async (oldSchoolId, newSchoolId, oldName, newName) => {
  if (!oldSchoolId || !oldName || !newName) return;
  
  const targetNewName = newName.trim();
  const targetOldName = oldName.trim();
  const isRenameOnly = oldSchoolId === newSchoolId;
  const isNameChanged = targetOldName.toLowerCase() !== targetNewName.toLowerCase();

  if (isRenameOnly && !isNameChanged) return;

  try {
    // 1. Update general tables (single bulk SQL update per table!)
    const collectionsToUpdate = [
      { name: 'clients', idField: 'schoolId', nameField: 'sekolah' },
      { name: 'leads', idField: 'schoolId', nameField: 'schoolName' },
      { name: 'projects', idField: 'schoolId', nameField: 'schoolName' },
      { name: 'daily_activities', idField: 'schoolId', nameField: 'schoolName' },
      { name: 'generated_documents', idField: 'school_id', nameField: 'client_name' }, 
      { name: 'event_reports', idField: 'schoolId', nameField: 'schoolName' },
    ];

    for (const colInfo of collectionsToUpdate) {
      const updateData = {
        [colInfo.nameField]: targetNewName,
        updatedAt: new Date().toISOString()
      };
      if (colInfo.idField && !isRenameOnly) {
        updateData[colInfo.idField] = newSchoolId;
      }

      await supabase
        .from(colInfo.name)
        .update(updateData)
        .eq(colInfo.idField, oldSchoolId);
    }

    // 2. Special case for calendar_events (nested JSONB update)
    const { data: calEvents, error: errCal } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('extendedProps->>schoolId', oldSchoolId);

    if (errCal) throw errCal;

    if (calEvents && calEvents.length > 0) {
      const promises = calEvents.map(event => {
        const updatedProps = {
          ...event.extendedProps,
          schoolName: targetNewName
        };
        if (!isRenameOnly) {
          updatedProps.schoolId = newSchoolId;
        }

        return supabase
          .from('calendar_events')
          .update({
            extendedProps: updatedProps,
            updatedAt: new Date().toISOString()
          })
          .eq('id', event.id);
      });

      await Promise.all(promises);
    }

    console.log(`Cascade update finished in Supabase: ${targetOldName} -> ${targetNewName}`);
  } catch (error) {
    console.error(`Error cascading school update:`, error);
  }
};
