import { sendTelegramMessage } from "./telegram";
import { sendWhatsappMessage } from "./whatsapp";

export async function sendNotification(text: string) {
  await Promise.all([sendTelegramMessage(text), sendWhatsappMessage(text)]);
}
