/**
 * WhatsApp Helper Utilities for MCKUADRAT
 * Handles phone formatting, template placeholder rendering,
 * deep-linking (wa.me), and API dispatch (Meta WABA & 3rd party gateways).
 */

/**
 * Format phone number to international 62 format without spaces/symbols
 * @param {string} phone
 * @returns {string} e.g. "628123456789"
 */
export const formatPhoneNumber = (phone) => {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.substring(1);
  } else if (cleaned.startsWith('8')) {
    cleaned = '62' + cleaned;
  }
  return cleaned;
};

/**
 * Replace placeholders like {{name}}, {{school}}, {{salutation}}, {{position}} with client data
 * @param {string} templateStr
 * @param {object} client
 * @param {object} defaultSettings
 * @returns {string}
 */
export const renderTemplateContent = (templateStr, client = {}, defaultSettings = {}) => {
  if (!templateStr) return '';
  const salutation = client.sapaan || client.salutation || defaultSettings.default_salutation || 'Bapak/Ibu';
  const name = client.nama || client.name || 'Bapak/Ibu';
  const nickname = client.panggilan || client.nickname || name;
  const school = client.sekolah || client.school || 'Sekolah';
  const position = client.posisi || client.position || 'Pengurus';
  const email = client.email || '';

  return templateStr
    .replace(/\{\{\s*salutation\s*\}\}/gi, salutation)
    .replace(/\{\{\s*sapaan\s*\}\}/gi, salutation)
    .replace(/\{\{\s*name\s*\}\}/gi, name)
    .replace(/\{\{\s*nama\s*\}\}/gi, name)
    .replace(/\{\{\s*nickname\s*\}\}/gi, nickname)
    .replace(/\{\{\s*panggilan\s*\}\}/gi, nickname)
    .replace(/\{\{\s*school\s*\}\}/gi, school)
    .replace(/\{\{\s*sekolah\s*\}\}/gi, school)
    .replace(/\{\{\s*position\s*\}\}/gi, position)
    .replace(/\{\{\s*posisi\s*\}\}/gi, position)
    .replace(/\{\{\s*email\s*\}\}/gi, email);
};

/**
 * Generate click-to-chat wa.me link for manual mode
 * @param {string} phone 
 * @param {string} message 
 * @returns {string}
 */
export const generateWaMeLink = (phone, message) => {
  const formattedPhone = formatPhoneNumber(phone);
  const encodedText = encodeURIComponent(message || '');
  return `https://wa.me/${formattedPhone}?text=${encodedText}`;
};

/**
 * Open manual WhatsApp chat link in a new browser tab
 * @param {string} phone 
 * @param {string} message 
 */
export const openManualWaChat = (phone, message, client = null) => {
  let text = message;
  if (!text || text.trim() === '') {
    const salutation = client?.sapaan || client?.salutation || 'Bapak/Ibu';
    const nickname = client?.panggilan || client?.nickname || (client?.nama || client?.name || '').split(' ')[0] || 'Bapak/Ibu';
    text = `Assalamualaikum, ${nickname}, bagaimana kabar ${salutation} hari ini ?`;
  }
  const link = generateWaMeLink(phone, text);
  window.open(link, '_blank');
};

/**
 * Send WhatsApp message via 3rd party Gateway API (Fonnte, Wablas, Whacenter, Custom)
 * @param {object} settings 
 * @param {string} phone 
 * @param {string} message 
 */
export const sendViaThirdPartyApi = async (settings, phone, message) => {
  const formattedPhone = formatPhoneNumber(phone);
  const endpoint = settings.third_party_endpoint || 'https://api.fonnte.com/send';
  const apiKey = settings.third_party_api_key || '';

  if (!apiKey) {
    throw new Error('API Key untuk 3rd party WhatsApp Gateway belum diatur.');
  }

  // Support Fonnte standard format
  const formData = new FormData();
  formData.append('target', formattedPhone);
  formData.append('message', message);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': apiKey,
    },
    body: formData,
  });

  const resJson = await response.json();
  if (!response.ok || (resJson.status === false && !resJson.id)) {
    throw new Error(resJson.reason || resJson.message || 'Gagal mengirim via 3rd party API');
  }

  return resJson;
};

/**
 * Send WhatsApp message via Meta WABA Cloud API
 * @param {object} settings 
 * @param {string} phone 
 * @param {string} message 
 */
export const sendViaMetaWaba = async (settings, phone, message) => {
  const formattedPhone = formatPhoneNumber(phone);
  const phoneNumberId = settings.phone_number_id;
  const accessToken = settings.waba_access_token;

  if (!phoneNumberId || !accessToken) {
    throw new Error('Phone Number ID atau Access Token Meta WABA belum diatur.');
  }

  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: formattedPhone,
    type: 'text',
    text: { body: message },
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const resJson = await response.json();
  if (!response.ok || resJson.error) {
    throw new Error(resJson.error?.message || 'Gagal mengirim via Meta WABA');
  }

  return resJson;
};

/**
 * Unified dispatch function depending on gateway provider setting
 * @param {object} settings 
 * @param {string} phone 
 * @param {string} message 
 * @returns {Promise<{ mode: string, result?: any, manualUrl?: string }>}
 */
export const dispatchWaMessage = async (settings = {}, phone, message) => {
  const provider = settings.provider_type || 'manual';

  if (provider === 'meta_waba') {
    const result = await sendViaMetaWaba(settings, phone, message);
    return { mode: 'meta_waba', result };
  } else if (provider === 'third_party') {
    const result = await sendViaThirdPartyApi(settings, phone, message);
    return { mode: 'third_party', result };
  } else {
    // Manual mode
    const manualUrl = generateWaMeLink(phone, message);
    window.open(manualUrl, '_blank');
    return { mode: 'manual', manualUrl };
  }
};
