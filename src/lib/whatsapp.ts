function parseTargets(value: string) {
  return value
    .split(",")
    .map((target) => target.trim())
    .filter(Boolean);
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

  try {
    const response = await fetch("https://api.fonnte.com/send", {
      body: new URLSearchParams({ message: text, target: targets.join(",") }),
      headers: { Authorization: token },
      method: "POST",
    });
    if (!response.ok) {
      console.error("[whatsapp] gagal mengirim pesan", { status: response.status, body: await response.text() });
    }
  } catch (error) {
    console.error("[whatsapp] gagal mengirim pesan", error);
  }
}
