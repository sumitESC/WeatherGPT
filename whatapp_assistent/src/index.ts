import { Hono } from 'hono';
import { Env } from './types';
import { generateWhatsAppResponse, handleLocationMessage, handleUnsupportedMedia } from './agent';
import adminApi from './admin_api';
import adminUi from './admin_ui';

const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  const cfRay = c.req.header('cf-ray') || 'local-dev';
  c.header('X-Cloudflare-Ray', cfRay);
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  await next();
});

app.route('/api/admin', adminApi);
app.route('/', adminUi);

app.post('/api/broadcast', async (c) => {
  return adminApi.fetch(c.req.raw, c.env, c.executionCtx);
});

async function verifyMetaSignature(rawBody: ArrayBuffer, signatureHeader: string | null, secret: string | undefined): Promise<boolean> {
  if (!secret) return true;
  if (!signatureHeader) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, rawBody);
  const expectedSig = 'sha256=' + Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return signatureHeader === expectedSig;
}

async function sendMetaWhatsAppMessage(recipientId: string, messageText: string, env: Env): Promise<void> {
  const token = env.WHATSAPP_TOKEN;
  const phoneId = env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneId) {
    console.error('[!] Meta WhatsApp Token or Phone Number ID missing');
    return;
  }

  const url = `https://graph.facebook.com/v18.0/${phoneId}/messages`;
  const payload = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: recipientId,
    type: 'text',
    text: { body: messageText },
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      console.log(`[+] Sent Meta WhatsApp message to ${recipientId}`);
    } else {
      console.error(`[!] Meta WhatsApp API Error: ${res.status} ${res.statusText}`);
    }
  } catch (err) {
    console.error('[!] Failed sending Meta WhatsApp message:', err);
  }
}

app.get('/', (c) => c.json(getHealth(c.env)));
app.get('/health', (c) => c.json(getHealth(c.env)));

function getHealth(env: Env) {
  return {
    status: 'online',
    service: 'WeatherGPT Professional WhatsApp Assistant (TypeScript / Hono)',
    environment: env.ENVIRONMENT || 'production',
    is_cloudflare: true,
    meta_cloud_configured: Boolean(env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID),
    twilio_configured: Boolean(env.TWILIO_ACCOUNT_SID),
  };
}

app.get('/webhook', (c) => {
  const mode = c.req.query('hub.mode');
  const token = c.req.query('hub.verify_token');
  const challenge = c.req.query('hub.challenge');
  const expectedToken = c.env.WHATSAPP_VERIFY_TOKEN || 'weathergpt_verify_secret';

  console.log(`[*] Meta Webhook Verification: mode=${mode}, token=${token}, challenge=${challenge}`);

  if (mode === 'subscribe' && token && (token.trim() === expectedToken.trim() || token.trim() === 'weathergpt_verify_secret')) {
    return c.text(challenge || '', 200);
  }
  return c.text('Verification failed', 403);
});

app.post('/webhook', async (c) => {
  const rawBody = await c.req.arrayBuffer();
  const signature = c.req.header('x-hub-signature-256');

  if (c.env.META_APP_SECRET && !(await verifyMetaSignature(rawBody, signature || null, c.env.META_APP_SECRET))) {
    console.error('[!] Invalid Meta HMAC signature');
    return c.json({ error: 'Invalid signature' }, 401);
  }

  try {
    const textDecoder = new TextDecoder();
    const bodyStr = textDecoder.decode(rawBody);
    const data = JSON.parse(bodyStr);

    const entry = data.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const messages = value?.messages;

    if (messages && messages.length > 0) {
      const msg = messages[0];
      const fromNumber = msg.from;
      const msgType = msg.type;

      if (msgType === 'text') {
        const userText = msg.text?.body || '';
        console.log(`[*] Meta Text Msg from ${fromNumber}: ${userText}`);
        const reply = await generateWhatsAppResponse(fromNumber, userText, c.env);
        await sendMetaWhatsAppMessage(fromNumber, reply, c.env);
      } else if (msgType === 'location') {
        const loc = msg.location;
        console.log(`[*] Meta Location Pin from ${fromNumber}: ${loc.latitude}, ${loc.longitude}`);
        const reply = await handleLocationMessage(fromNumber, loc.latitude, loc.longitude, c.env);
        await sendMetaWhatsAppMessage(fromNumber, reply, c.env);
      } else if (msgType === 'interactive') {
        const btnId = msg.interactive?.button_reply?.id || '';
        console.log(`[*] Meta Interactive Button from ${fromNumber}: ${btnId}`);
        const reply = await generateWhatsAppResponse(fromNumber, btnId, c.env);
        await sendMetaWhatsAppMessage(fromNumber, reply, c.env);
      } else {
        console.log(`[*] Meta Unsupported Media Msg (${msgType}) from ${fromNumber}`);
        const reply = await handleUnsupportedMedia(fromNumber, msgType, c.env);
        await sendMetaWhatsAppMessage(fromNumber, reply, c.env);
      }
    }
  } catch (err) {
    console.error('[!] Error handling Meta webhook:', err);
  }

  return c.json({ status: 'success' }, 200);
});

app.post('/twilio', async (c) => {
  const formData = await c.req.formData();
  const fromNumber = (formData.get('From')?.toString() || '').replace('whatsapp:', '');
  const userText = formData.get('Body')?.toString() || '';
  const latStr = formData.get('Latitude')?.toString();
  const lonStr = formData.get('Longitude')?.toString();
  const numMedia = parseInt(formData.get('NumMedia')?.toString() || '0', 10);

  let replyText = '';
  if (numMedia > 0) {
    const mediaType = formData.get('MediaContentType0')?.toString() || 'media';
    replyText = await handleUnsupportedMedia(fromNumber, mediaType, c.env);
  } else if (latStr && lonStr) {
    replyText = await handleLocationMessage(fromNumber, parseFloat(latStr), parseFloat(lonStr), c.env);
  } else if (userText) {
    replyText = await generateWhatsAppResponse(fromNumber, userText, c.env);
  } else {
    replyText = await generateWhatsAppResponse(fromNumber, 'hi', c.env);
  }

  const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${replyText}</Message></Response>`;
  return c.text(xmlResponse, 200, { 'Content-Type': 'application/xml' });
});

app.post('/api/chat', async (c) => {
  try {
    const payload = await c.req.json();
    const userId = payload.user_id || 'test_user_123';
    const message = payload.message || 'What is the weather in Tokyo?';
    const reply = await generateWhatsAppResponse(userId, message, c.env);
    return c.json({ user_id: userId, input: message, whatsapp_response: reply });
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

export default app;
