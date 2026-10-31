// Telegram Bot API client + long-polling loop (outbound HTTPS only: no webhook, no open port).
// Only ONE process may poll a given bot token at a time — keep the real token on the server only.
const db = require("./db");

const token = () => process.env.TELEGRAM_BOT_TOKEN || "";
const apiBase = () => (process.env.TELEGRAM_API_BASE || "https://api.telegram.org").replace(/\/$/, "");
const enabled = () => Boolean(token());

let botUsername = process.env.TELEGRAM_BOT_USERNAME || null;
let stopping = false;
let pollAbort = null;
const commandHandlers = {};

class TelegramError extends Error {
  constructor(code, description) {
    super(`telegram ${code}: ${description}`);
    this.code = code;
  }
}

async function call(method, params = {}, signal) {
  const res = await fetch(`${apiBase()}/bot${token()}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(params),
    signal,
  });
  const data = await res.json().catch(() => ({ ok: false, error_code: res.status, description: res.statusText }));
  if (!data.ok) throw new TelegramError(data.error_code || res.status, data.description || "unknown error");
  return data.result;
}

const escapeHtml = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Send an HTML message. If the user blocked the bot / deleted the chat, unlink it.
async function send(chatId, html) {
  try {
    return await call("sendMessage", { chat_id: chatId, text: html, parse_mode: "HTML", disable_web_page_preview: true });
  } catch (err) {
    if (err.code === 403 || (err.code === 400 && /chat not found/i.test(err.message))) {
      await db.query("UPDATE users SET tg_chat_id = NULL WHERE tg_chat_id = $1", [chatId]);
      console.warn(`[telegram] chat ${chatId} unreachable (${err.code}), unlinked`);
    }
    throw err;
  }
}

async function getBotUsername() {
  if (botUsername || !enabled()) return botUsername;
  try {
    botUsername = (await call("getMe")).username;
  } catch (err) {
    console.error("[telegram] getMe failed:", err.message);
  }
  return botUsername;
}

const appUrl = () => (process.env.APP_URL || "").replace(/\/$/, "");

async function handleMessage(msg) {
  const chatId = msg.chat?.id;
  const text = (msg.text || "").trim();
  if (!chatId || msg.chat.type !== "private") return; // only 1:1 chats
  const [cmd, arg] = text.split(/\s+/, 2);

  if (cmd === "/start" && arg) {
    const { rows } = await db.query(
      `UPDATE users SET tg_chat_id = $2, tg_link_code = NULL, tg_link_expires = NULL
       WHERE tg_link_code = $1 AND tg_link_expires > now()
       RETURNING username`,
      [arg, chatId]
    ).catch(async (err) => {
      if (err.code === "23505") return { rows: [], taken: true }; // chat already linked to another account
      throw err;
    });
    if (rows[0]) {
      await send(chatId, `เชื่อมกับบัญชี <b>${escapeHtml(rows[0].username)}</b> แล้ว\nตั้งค่าการแจ้งเตือนได้ที่หน้าตั้งค่าของไดอารี่\n\n/today ดูสรุปวันนี้ · /stop เลิกเชื่อม`);
    } else {
      await send(chatId, "ลิงก์เชื่อมหมดอายุหรือใช้ไปแล้ว (หรือแชตนี้เชื่อมกับบัญชีอื่นอยู่) กดสร้างลิงก์ใหม่ในหน้าตั้งค่าของไดอารี่");
    }
    return;
  }
  const { rows: users } = await db.query("SELECT id, username FROM users WHERE tg_chat_id = $1", [chatId]);
  const user = users[0];
  if (cmd === "/stop") {
    if (user) await db.query("UPDATE users SET tg_chat_id = NULL WHERE id = $1", [user.id]);
    await send(chatId, user ? "เลิกเชื่อมแล้ว จะไม่มีการแจ้งเตือนส่งมาที่แชตนี้อีก" : "แชตนี้ยังไม่ได้เชื่อมกับบัญชีไหน");
    return;
  }
  if (!user) {
    await send(chatId, "แชตนี้ยังไม่ได้เชื่อมกับไดอารี่ ไปที่หน้าตั้งค่า → แจ้งเตือน Telegram แล้วกด \"เชื่อม Telegram\"");
    return;
  }
  if (cmd === "/today" && commandHandlers.today) {
    await send(chatId, await commandHandlers.today(user.id));
    return;
  }
  await send(chatId, `คำสั่งที่ใช้ได้\n/today สรุปวันนี้\n/stop เลิกเชื่อม${appUrl() ? `\n\n${appUrl()}` : ""}`);
}

async function pollLoop() {
  let offset = 0;
  while (!stopping) {
    pollAbort = new AbortController();
    try {
      const updates = await call("getUpdates", { offset, timeout: 25, allowed_updates: ["message"] }, pollAbort.signal);
      for (const u of updates) {
        offset = u.update_id + 1;
        if (u.message) await handleMessage(u.message).catch((err) => console.error("[telegram] handle:", err.message));
      }
    } catch (err) {
      if (stopping) break;
      // 409 = another process is polling the same token (e.g. laptop + server)
      console.error("[telegram] poll:", err.message);
      await new Promise((r) => setTimeout(r, err.code === 409 ? 30_000 : 5_000));
    }
  }
}

function start({ onToday } = {}) {
  if (!enabled()) {
    console.log("[telegram] TELEGRAM_BOT_TOKEN not set: reminders disabled");
    return;
  }
  commandHandlers.today = onToday;
  getBotUsername().then((u) => console.log(`[telegram] polling as @${u ?? "?"}`));
  pollLoop();
}

function stop() {
  stopping = true;
  pollAbort?.abort();
}

module.exports = { enabled, send, start, stop, getBotUsername, escapeHtml, appUrl, TelegramError };
