"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { allowedMenuKeysForRole, hasMenuAccess } from "@/lib/menu-access";
import { createClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/telegram";
import type { Profile, ProfileMenuAccess, ShiftType, Store, StoreScheduleMonth, StoreStaffSchedule } from "@/lib/types";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function values(formData: FormData, key: string) {
  return formData.getAll(key).map((value) => String(value));
}

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  return { supabase, user };
}

async function requireStaffOrAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role === "vendor") redirect("/dashboard");

  return { profile, supabase, user };
}

export async function requireScheduleInputAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role === "vendor") redirect("/dashboard");

  if (profile.role === "admin") return { canPickAnyStore: true, profile, supabase, user };

  const { data: menuAccessRows } = await supabase
    .from("profile_menu_access")
    .select("*")
    .eq("profile_id", profile.id)
    .returns<ProfileMenuAccess[]>();
  const allowedMenuKeys = allowedMenuKeysForRole(profile.role, menuAccessRows ?? []);
  const canPickAnyStore = hasMenuAccess("input_schedule_all_store", allowedMenuKeys);
  const canInputOwnStore = hasMenuAccess("input_schedule", allowedMenuKeys);
  if (!canPickAnyStore && !canInputOwnStore) redirect("/dashboard");

  return { canPickAnyStore, profile, supabase, user };
}

export async function requireScheduleRequestApprover() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single<Profile>();
  if (!profile || profile.role === "vendor") redirect("/dashboard");

  if (profile.role === "admin") return { profile, supabase, user };

  const { data: menuAccessRows } = await supabase
    .from("profile_menu_access")
    .select("*")
    .eq("profile_id", profile.id)
    .returns<ProfileMenuAccess[]>();
  const allowedMenuKeys = allowedMenuKeysForRole(profile.role, menuAccessRows ?? []);
  if (!hasMenuAccess("schedule_requests", allowedMenuKeys)) redirect("/dashboard");

  return { profile, supabase, user };
}

async function getOrCreateScheduleMonth(
  supabase: Awaited<ReturnType<typeof createClient>>,
  storeId: string,
  scheduleMonth: string,
  userId: string,
) {
  const { data: existing } = await supabase
    .from("store_schedule_months")
    .select("*")
    .eq("store_id", storeId)
    .eq("schedule_month", scheduleMonth)
    .maybeSingle<StoreScheduleMonth>();

  if (existing) return existing;

  const { data: created, error } = await supabase
    .from("store_schedule_months")
    .insert({
      created_by: userId,
      schedule_month: scheduleMonth,
      status: "draft",
      store_id: storeId,
      updated_by: userId,
    })
    .select("*")
    .single<StoreScheduleMonth>();

  if (error || !created) throw new Error(error?.message ?? "Gagal membuat schedule bulan.");
  return created;
}

export async function saveMonthlySchedule(formData: FormData) {
  const { canPickAnyStore, profile, supabase, user } = await requireScheduleInputAccess();
  const storeId = text(formData, "store_id");
  const scheduleMonth = text(formData, "schedule_month");
  const intent = text(formData, "intent");
  const weekNo = Number(text(formData, "week_no")) || null;
  const staffIds = values(formData, "staff_id");
  const dates = values(formData, "work_date");

  if (!storeId || !scheduleMonth) redirect("/schedules?error=missing-filter");
  if (!canPickAnyStore && storeId !== profile.store_id) redirect("/dashboard");

  const schedule = await getOrCreateScheduleMonth(supabase, storeId, scheduleMonth, user.id);
  const upserts: Record<string, unknown>[] = [];
  const emptyCells: { staffId: string; workDate: string }[] = [];
  const { data: existingRows } = await supabase
    .from("store_staff_schedules")
    .select("*")
    .eq("store_id", storeId)
    .in("staff_id", staffIds)
    .in("work_date", dates)
    .returns<StoreStaffSchedule[]>();
  const { data: staffRows } = await supabase
    .from("profiles")
    .select("id, full_name")
    .in("id", staffIds)
    .returns<Pick<Profile, "id" | "full_name">[]>();
  const existingMap = new Map((existingRows ?? []).map((row) => [`${row.staff_id}:${row.work_date}`, row]));
  const staffNameMap = new Map((staffRows ?? []).map((row) => [row.id, row.full_name]));
  const changeLogs: Record<string, unknown>[] = [];

  for (const staffId of staffIds) {
    for (const workDate of dates) {
      const shiftCode = text(formData, `shift_${staffId}_${workDate}`);
      const notes = text(formData, `notes_${staffId}_${workDate}`);
      const existing = existingMap.get(`${staffId}:${workDate}`);
      const normalizedOldShift = existing?.shift_code ?? "";
      const normalizedNewShift = shiftCode || "";
      const normalizedOldNotes = existing?.notes ?? "";
      const normalizedNewNotes = notes || "";
      if (!shiftCode && !notes) {
        emptyCells.push({ staffId, workDate });
        if (existing) {
          changeLogs.push({
            action: "delete",
            actor_id: user.id,
            actor_name: user.email ?? null,
            new_notes: null,
            new_shift_code: null,
            old_notes: existing.notes,
            old_shift_code: existing.shift_code,
            schedule_month_id: schedule.id,
            staff_id: staffId,
            staff_name: staffNameMap.get(staffId) ?? null,
            store_id: storeId,
            work_date: workDate,
          });
        }
        continue;
      }

      if (normalizedOldShift !== normalizedNewShift || normalizedOldNotes !== normalizedNewNotes) {
        changeLogs.push({
          action: existing ? "update" : "create",
          actor_id: user.id,
          actor_name: user.email ?? null,
          new_notes: notes || null,
          new_shift_code: shiftCode || null,
          old_notes: existing?.notes ?? null,
          old_shift_code: existing?.shift_code ?? null,
          schedule_month_id: schedule.id,
          staff_id: staffId,
          staff_name: staffNameMap.get(staffId) ?? null,
          store_id: storeId,
          work_date: workDate,
        });
      }

      upserts.push({
        created_by: user.id,
        notes: notes || null,
        schedule_month_id: schedule.id,
        shift_code: shiftCode || null,
        staff_id: staffId,
        store_id: storeId,
        updated_by: user.id,
        work_date: workDate,
      });
    }
  }

  if (upserts.length) {
    await supabase.from("store_staff_schedules").upsert(upserts, { onConflict: "store_id,staff_id,work_date" });
  }

  for (const cell of emptyCells) {
    await supabase
      .from("store_staff_schedules")
      .delete()
      .eq("store_id", storeId)
      .eq("staff_id", cell.staffId)
      .eq("work_date", cell.workDate);
  }

  const statusPayload = intent === "submit"
    ? { status: "pending_approval", submitted_at: new Date().toISOString(), submitted_by: user.id, updated_by: user.id }
    : { status: "draft", updated_by: user.id };

  await supabase.from("store_schedule_months").update(statusPayload).eq("id", schedule.id);
  if (changeLogs.length) {
    await supabase.from("store_schedule_change_logs").insert(changeLogs);
  }
  await supabase.from("store_schedule_activity_logs").insert({
    action: intent === "submit" ? "submit" : "save_draft",
    actor_id: user.id,
    actor_name: user.email ?? null,
    date_from: dates[0] ?? null,
    date_to: dates[dates.length - 1] ?? null,
    schedule_month_id: schedule.id,
    store_id: storeId,
    summary: `${intent === "submit" ? "Submit approval" : "Simpan draft"} dengan ${changeLogs.length} perubahan schedule.`,
    week_no: weekNo,
  });

  revalidatePath("/schedules");
  redirect(`/schedules?store=${storeId}&month=${scheduleMonth.slice(0, 7)}${weekNo ? `&week=${weekNo}` : ""}&saved=1`);
}

export async function approveMonthlySchedule(formData: FormData) {
  const { supabase, user } = await requireAdmin();
  const scheduleId = text(formData, "schedule_id");
  const storeId = text(formData, "store_id");
  const month = text(formData, "month");
  const weekNo = Number(text(formData, "week_no")) || null;
  const dateFrom = text(formData, "date_from") || null;
  const dateTo = text(formData, "date_to") || null;

  if (scheduleId) {
    await supabase
      .from("store_schedule_months")
      .update({
        approved_at: new Date().toISOString(),
        approved_by: user.id,
        status: "approved",
        updated_by: user.id,
      })
      .eq("id", scheduleId);

    await supabase.from("store_schedule_activity_logs").insert({
      action: "approve",
      actor_id: user.id,
      actor_name: user.email ?? null,
      date_from: dateFrom,
      date_to: dateTo,
      schedule_month_id: scheduleId,
      store_id: storeId,
      summary: "Schedule bulanan diapprove admin.",
      week_no: weekNo,
    });
  }

  revalidatePath("/schedules");
  redirect(`/schedules?store=${storeId}&month=${month}${weekNo ? `&week=${weekNo}` : ""}&approved=1`);
}

export async function createStaffScheduleRequest(formData: FormData) {
  const { profile, supabase, user } = await requireStaffOrAdmin();
  if (profile.role !== "staff" || !profile.store_id) redirect("/schedules?error=missing-filter");

  const requestDate = text(formData, "request_date");
  const shiftCode = text(formData, "shift_code");
  const notes = text(formData, "notes");
  const month = requestDate ? requestDate.slice(0, 7) : text(formData, "month");
  if (!requestDate || !shiftCode) redirect(`/schedules?month=${month}&error=missing-filter`);

  await supabase.from("staff_schedule_requests").insert({
    notes: notes || null,
    request_date: requestDate,
    shift_code: shiftCode,
    staff_id: user.id,
    status: "pending",
    store_id: profile.store_id,
  });

  const [{ data: store }, { data: shiftType }] = await Promise.all([
    supabase.from("stores").select("*").eq("id", profile.store_id).maybeSingle<Store>(),
    supabase.from("shift_types").select("*").eq("code", shiftCode).maybeSingle<ShiftType>(),
  ]);

  await sendTelegramMessage(
    [
      "🗓️ Request Schedule Baru",
      `Staff: ${profile.full_name}`,
      `Store: ${store?.name ?? "-"}`,
      `Tanggal: ${requestDate}`,
      `Schedule: ${shiftCode}${shiftType?.name ? ` - ${shiftType.name}` : ""}`,
      ...(notes ? [`Catatan: ${notes}`] : []),
    ].join("\n"),
  );

  revalidatePath("/schedules");
  redirect(`/schedules?store=${profile.store_id}&month=${month}&requested=1`);
}

export async function reviewStaffScheduleRequest(formData: FormData) {
  const { supabase, user } = await requireScheduleRequestApprover();
  const requestId = text(formData, "request_id");
  const decision = text(formData, "decision");
  const reviewNotes = text(formData, "review_notes");
  const month = text(formData, "month");
  const storeId = text(formData, "store_id");

  const { data: request } = await supabase
    .from("staff_schedule_requests")
    .select("*, profiles:staff_id(full_name)")
    .eq("id", requestId)
    .single<{
      id: string;
      notes: string | null;
      profiles?: { full_name?: string | null } | null;
      request_date: string;
      shift_code: string;
      staff_id: string;
      store_id: string;
    }>();

  if (!request) redirect(`/schedules?store=${storeId}&month=${month}`);

  await supabase
    .from("staff_schedule_requests")
    .update({
      review_notes: reviewNotes || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
      status: decision === "approve" ? "approved" : "rejected",
    })
    .eq("id", requestId);

  if (decision === "approve") {
    const schedule = await getOrCreateScheduleMonth(supabase, request.store_id, `${request.request_date.slice(0, 7)}-01`, user.id);
    const { data: existing } = await supabase
      .from("store_staff_schedules")
      .select("*")
      .eq("store_id", request.store_id)
      .eq("staff_id", request.staff_id)
      .eq("work_date", request.request_date)
      .maybeSingle<StoreStaffSchedule>();

    await supabase.from("store_staff_schedules").upsert(
      {
        created_by: user.id,
        notes: request.notes || null,
        schedule_month_id: schedule.id,
        shift_code: request.shift_code,
        staff_id: request.staff_id,
        store_id: request.store_id,
        updated_by: user.id,
        work_date: request.request_date,
      },
      { onConflict: "store_id,staff_id,work_date" },
    );

    await supabase.from("store_schedule_change_logs").insert({
      action: existing ? "update" : "create",
      actor_id: user.id,
      actor_name: user.email ?? null,
      new_notes: request.notes || null,
      new_shift_code: request.shift_code,
      old_notes: existing?.notes ?? null,
      old_shift_code: existing?.shift_code ?? null,
      schedule_month_id: schedule.id,
      staff_id: request.staff_id,
      staff_name: request.profiles?.full_name ?? null,
      store_id: request.store_id,
      work_date: request.request_date,
    });
  }

  revalidatePath("/schedules");
  const redirectParams = new URLSearchParams();
  if (storeId) redirectParams.set("store", storeId);
  redirectParams.set("month", month || request.request_date.slice(0, 7));
  redirectParams.set("reviewed", "1");
  redirect("/schedules/requests?" + redirectParams.toString());
}
