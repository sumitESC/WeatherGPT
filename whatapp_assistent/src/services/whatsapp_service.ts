import { Env } from '../types';

/**
 * Send an outbound text message to a WhatsApp recipient via Meta Graph API or Twilio.
 */
export async function sendWhatsAppMessage(recipientPhone: string, messageText: string, env: Env): Promise<{ success: boolean; provider: string }> {
  let sent = false;
  let provider = 'None';

  if (env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID) {
    provider = 'Meta Cloud API';
    const url = `https://graph.facebook.com/v18.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipientPhone,
          type: 'text',
          text: { body: messageText },
        }),
      });

      if (res.ok) {
        sent = true;
        console.log(`[+] Meta WhatsApp message delivered to ${recipientPhone}`);
      } else {
        console.error(`[!] Meta WhatsApp API Error (${res.status}):`, await res.text());
      }
    } catch (err) {
      console.error('[!] Failed sending Meta WhatsApp message:', err);
    }
  }

  if (!sent && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
    provider = 'Twilio API';
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`);
    const body = new URLSearchParams();
    body.append('From', `whatsapp:+14155238886`);
    body.append('To', `whatsapp:${recipientPhone}`);
    body.append('Body', messageText);

    try {
      const res = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (res.ok) {
        sent = true;
        console.log(`[+] Twilio WhatsApp message delivered to ${recipientPhone}`);
      }
    } catch (err) {
      console.error('[!] Failed sending Twilio WhatsApp message:', err);
    }
  }

  return { success: sent, provider };
}
