import { Hono } from 'hono';
import { Env, ChatMessage } from './types';
import * as storage from './services/storage_service';
import { sendWhatsAppMessage } from './services/whatsapp_service';

const adminApi = new Hono<{ Bindings: Env }>();

async function createToken(username: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const payload = `${username}:${Date.now()}`;
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return btoa(`${payload}:${hex}`);
}

export async function verifyAuthHeader(authHeader: string | null, env: Env): Promise<boolean> {
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return false;

  try {
    const decoded = atob(token);
    const parts = decoded.split(':');
    if (parts.length < 2) return false;

    const [username, timestampStr] = parts;
    const expectedUsername = (env.ADMIN_USERNAME || 'admin').toString().trim();
    if (username.trim().toLowerCase() !== expectedUsername.toLowerCase()) return false;

    const ageMs = Date.now() - parseInt(timestampStr, 10);
    if (isNaN(ageMs) || ageMs > 7 * 24 * 60 * 60 * 1000) return false;

    return true;
  } catch {
    return false;
  }
}

function envSecret(env: Env): string {
  return env.ADMIN_SECRET_KEY || 'weathergpt_jwt_secret_key_2026';
}

adminApi.use('*', async (c, next) => {
  const path = c.req.path;
  if (path.endsWith('/login') || path.includes('/login')) {
    return await next();
  }

  let token = c.req.header('authorization') || '';
  if (!token && c.req.header('cookie')) {
    const cookie = c.req.header('cookie') || '';
    const match = cookie.match(/admin_session=([^;]+)/);
    if (match) token = match[1];
  }
  if (!token && c.req.query('token')) {
    token = c.req.query('token') || '';
  }

  const isValid = await verifyAuthHeader(token, c.env);

  if (!isValid) {
    return c.json({ error: 'Unauthorized: Admin authentication required' }, 401);
  }

  await next();
});

adminApi.post('/login', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const username = (body.username || '').toString().trim();
    const password = (body.password || '').toString().trim();

    const expectedUsername = (c.env.ADMIN_USERNAME || 'admin').toString().trim();
    const expectedPassword = (c.env.ADMIN_PASSWORD || 'weathergpt_admin_pass').toString().trim();

    if (username === expectedUsername && password === expectedPassword) {
      const token = await createToken(username, envSecret(c.env));
      await storage.logAdminAction('LOGIN_SUCCESS', `Admin logged in successfully`, c.req.header('cf-connecting-ip'), c.env);

      c.header('Set-Cookie', `admin_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`);
      return c.json({
        status: 'success',
        success: true,
        token,
        username,
        message: 'Authenticated successfully',
      });
    }

    await storage.logAdminAction('LOGIN_FAILED', `Failed login attempt for user: ${username}`, c.req.header('cf-connecting-ip'), c.env);
    return c.json({ error: 'Invalid username or password' }, 401);
  } catch (err: any) {
    return c.json({ error: err.message }, 400);
  }
});

adminApi.post('/logout', async (c) => {
  c.header('Set-Cookie', 'admin_session=; Path=/; HttpOnly; Max-Age=0');
  return c.json({ status: 'success', message: 'Logged out successfully' });
});

adminApi.get('/stats', async (c) => {
  const stats = await storage.getSystemStats(c.env);
  const logs = await storage.getAdminLogs(c.env);
  return c.json({ stats, logs });
});

adminApi.get('/conversations', async (c) => {
  const conversations = await storage.getAllConversations(c.env);
  return c.json({ conversations });
});

adminApi.get('/messages/:phone', async (c) => {
  const phone = c.req.param('phone');
  const messages = await storage.getChatHistory(phone, c.env);
  await storage.markAsRead(phone, c.env);
  return c.json({ phone, messages });
});

adminApi.post('/send', async (c) => {
  try {
    const { phone, message } = await c.req.json();
    if (!phone || !message) {
      return c.json({ error: 'Phone number and message content are required' }, 400);
    }

    const { success: sentStatus, provider } = await sendWhatsAppMessage(phone, message, c.env);

    const adminMsg: ChatMessage = {
      id: `msg_${Date.now()}_admin`,
      role: 'admin',
      content: message,
      timestamp: new Date().toISOString(),
      senderName: 'Admin',
      msgType: 'text',
      fromAdmin: true,
      status: sentStatus ? 'delivered' : 'sent',
    };

    await storage.saveChatMessage(phone, adminMsg, c.env);
    await storage.logAdminAction('SEND_MESSAGE', `Sent admin message to ${phone} via ${provider}`, c.req.header('cf-connecting-ip'), c.env);

    return c.json({
      status: 'success',
      sent: sentStatus,
      provider,
      message: adminMsg,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

adminApi.post('/broadcast', async (c) => {
  try {
    const { message } = await c.req.json();
    if (!message || !message.trim()) {
      return c.json({ error: 'Broadcast message content is required' }, 400);
    }

    const conversations = await storage.getAllConversations(c.env);
    const now = new Date().toISOString();

    let successCount = 0;
    let failedCount = 0;

    for (const conv of conversations) {
      const phone = conv.phone;
      const { success: sent } = await sendWhatsAppMessage(phone, message, c.env);

      const bMsg: ChatMessage = {
        id: `msg_${Date.now()}_bcast_${Math.random().toString(36).substring(2, 6)}`,
        role: 'admin',
        content: `📢 [BROADCAST]\n${message}`,
        timestamp: now,
        senderName: 'Broadcast System',
        msgType: 'text',
        fromAdmin: true,
        status: sent ? 'delivered' : 'sent',
      };

      await storage.saveChatMessage(phone, bMsg, c.env);
      if (sent) successCount++;
      else failedCount++;
    }

    await storage.logAdminAction('BROADCAST_SENT', `Broadcast sent to ${conversations.length} users (${successCount} delivered)`, c.req.header('cf-connecting-ip'), c.env);

    return c.json({
      status: 'success',
      totalUsers: conversations.length,
      successCount,
      failedCount,
      message: `Broadcast dispatched to ${conversations.length} users!`,
    });
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

adminApi.delete('/messages/:phone', async (c) => {
  const phone = c.req.param('phone');
  await storage.clearChatHistory(phone, c.env);
  await storage.logAdminAction('DELETE_CONVERSATION', `Cleared history for ${phone}`, c.req.header('cf-connecting-ip'), c.env);
  return c.json({ status: 'success', message: `Cleared conversation for ${phone}` });
});

export default adminApi;
