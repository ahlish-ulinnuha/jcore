function parseChatIds(value: string) {
  return value
    .split(",")
    .map((chatId) => chatId.trim())
    .filter(Boolean);
}

async function sendToChatId(token: string, chatId: string, text: string) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      body: JSON.stringify({ chat_id: chatId, text }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      console.error("[telegram] gagal mengirim pesan", { chatId, status: response.status, body: await response.text() });
    }
  } catch (error) {
    console.error("[telegram] gagal mengirim pesan", { chatId, error });
  }
}

export async function sendTelegramMessage(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatIdConfig = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatIdConfig) {
    console.info("[telegram] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID belum diisi, notifikasi dilewati.");
    return;
  }

  const chatIds = parseChatIds(chatIdConfig);
  if (chatIds.length === 0) {
    console.info("[telegram] TELEGRAM_CHAT_ID kosong, notifikasi dilewati.");
    return;
  }

  await Promise.all(chatIds.map((chatId) => sendToChatId(token, chatId, text)));
}
