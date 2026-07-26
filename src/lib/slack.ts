export type SendSlackResult = { ok: true; ts: string } | { ok: false; error: string };

export async function sendSlackMessage(text: string, channelOverride?: string): Promise<SendSlackResult> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = channelOverride ?? process.env.SLACK_ATTENDANCE_CHANNEL_ID;
  if (!token) return { error: "SLACK_BOT_TOKEN belum diisi di environment.", ok: false };
  if (!channel) return { error: "SLACK_ATTENDANCE_CHANNEL_ID belum diisi di environment.", ok: false };

  try {
    const response = await fetch("https://slack.com/api/chat.postMessage", {
      body: JSON.stringify({ channel, text }),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });
    const body = await response.json();
    if (!response.ok || !body.ok) {
      return { error: body.error ?? `HTTP ${response.status}`, ok: false };
    }
    return { ok: true, ts: body.ts };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Gagal mengirim pesan Slack.", ok: false };
  }
}
