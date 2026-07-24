export type SendSlackResult = { ok: true } | { ok: false; error: string };

export async function sendSlackMessage(text: string): Promise<SendSlackResult> {
  const webhookUrl = process.env.SLACK_ATTENDANCE_WEBHOOK_URL;
  if (!webhookUrl) return { error: "SLACK_ATTENDANCE_WEBHOOK_URL belum diisi di environment.", ok: false };

  try {
    const response = await fetch(webhookUrl, {
      body: JSON.stringify({ text }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });
    const body = await response.text();
    if (!response.ok) {
      return { error: `HTTP ${response.status}: ${body}`, ok: false };
    }
    return { ok: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Gagal mengirim pesan Slack.", ok: false };
  }
}
