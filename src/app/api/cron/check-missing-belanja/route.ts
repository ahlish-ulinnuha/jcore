import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendWhatsappMessageTo } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

function todayJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Jakarta",
    year: "numeric",
  }).format(new Date());
}

function displayDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}-${month}-${year}`;
}

function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) return `62${digits.slice(1)}`;
  return digits;
}

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const targetDate = todayJakarta();
  const dateLabel = displayDate(targetDate);

  const { data: records, error: recordsError } = await supabase
    .from("shopping_records")
    .select("id")
    .eq("record_date", targetDate)
    .limit(1);
  if (recordsError) {
    return NextResponse.json({ error: recordsError.message, stage: "query_records" }, { status: 500 });
  }

  if ((records ?? []).length > 0) {
    return NextResponse.json({ dateLabel, ok: true, reminded: false });
  }

  const { data: admins, error: adminsError } = await supabase.from("profiles").select("full_name, phone").eq("role", "admin");
  if (adminsError) {
    return NextResponse.json({ error: adminsError.message, stage: "query_admins" }, { status: 500 });
  }

  const targets = (admins ?? [])
    .map((admin) => admin.phone)
    .filter((phone): phone is string => Boolean(phone))
    .map(normalizePhone);

  if (targets.length === 0) {
    return NextResponse.json({ dateLabel, error: "Tidak ada nomor WhatsApp admin.", ok: false });
  }

  const message = [
    `Belanja harian tanggal ${dateLabel} belum diinput.`,
    "Mohon segera diinput melalui menu Report Belanja.",
  ].join("\n");

  const result = await sendWhatsappMessageTo(targets.join(","), message);
  if (!result.ok) {
    return NextResponse.json({ dateLabel, error: result.error, ok: false }, { status: 500 });
  }

  return NextResponse.json({ dateLabel, ok: true, reminded: true });
}
