export async function sendTelegramMessage(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    console.info("[telegram] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID belum diisi, notifikasi dilewati.");
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      body: JSON.stringify({ chat_id: chatId, text }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    if (!response.ok) {
      console.error("[telegram] gagal mengirim pesan", { status: response.status, body: await response.text() });
    }
  } catch (error) {
    console.error("[telegram] gagal mengirim pesan", error);
  }
}
