export type SendWhatsappResult = { ok: true } | { ok: false; error: string };

function parseTargets(value: string) {
  return value
    .split(",")
    .map((target) => target.trim())
    .filter(Boolean);
}

async function postToFonnte(token: string, target: string, text: string): Promise<SendWhatsappResult> {
  try {
    const response = await fetch("https://api.fonnte.com/send", {
      body: new URLSearchParams({ message: text, target }),
      headers: { Authorization: token },
      method: "POST",
    });
    const body = await response.text();
    if (!response.ok) {
      return { error: `HTTP ${response.status}: ${body}`, ok: false };
    }
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Gagal mengirim pesan WhatsApp.", ok: false };
  }
}

export async function sendWhatsappMessage(text: string) {
  const token = process.env.FONNTE_TOKEN;
  const targetConfig = process.env.FONNTE_TARGET;
  if (!token || !targetConfig) {
    console.info("[whatsapp] FONNTE_TOKEN/FONNTE_TARGET belum diisi, notifikasi dilewati.");
    return;
  }

  const targets = parseTargets(targetConfig);
  if (targets.length === 0) {
    console.info("[whatsapp] FONNTE_TARGET kosong, notifikasi dilewati.");
    return;
  }

  const result = await postToFonnte(token, targets.join(","), text);
  if (!result.ok) {
    console.error("[whatsapp] gagal mengirim pesan", result.error);
  }
}

export async function sendWhatsappMessageTo(target: string, text: string): Promise<SendWhatsappResult> {
  const token = process.env.FONNTE_TOKEN;
  if (!token) return { error: "FONNTE_TOKEN belum diisi di environment.", ok: false };
  if (!target) return { error: "Nomor WhatsApp tujuan belum diisi.", ok: false };
  return postToFonnte(token, target, text);
}
