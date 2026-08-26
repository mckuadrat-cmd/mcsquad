import { supabase } from '../lib/supabase';

/**
 * Updates the last activity information for all client contacts associated with a school.
 * @param {string} schoolName - The exact name of the school to update.
 * @param {string} description - A brief description of the activity.
 */
export const updateClientActivity = async (schoolName, description) => {
  if (!schoolName || !description) return;

  try {
    await supabase
      .from('clients')
      .update({
        lastActivityDesc: description,
        lastActivityAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .eq('school', schoolName);
  } catch (error) {
    console.error(`Error updating last activity for school ${schoolName}:`, error);
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
      { name: 'clients', idField: 'schoolId', nameField: 'school' },
      { name: 'leads', idField: 'schoolId', nameField: 'schoolName' },
      { name: 'projects', idField: 'schoolId', nameField: 'schoolName' },
      { name: 'daily_activities', idField: 'schoolId', nameField: 'schoolName' },
      { name: 'generated_documents', idField: 'schoolId', nameField: 'client' }, 
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
