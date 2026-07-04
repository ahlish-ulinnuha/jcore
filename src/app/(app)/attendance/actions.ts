"use server";

import { redirect } from "next/navigation";
import { distanceInMeters } from "@/lib/geo";
import { createClient } from "@/lib/supabase/server";
import { sendTelegramMessage } from "@/lib/telegram";
import type { Profile, Store } from "@/lib/types";

function numberOrNull(formData: FormData, key: string) {
  const value = Number(formData.get(key));
  return Number.isFinite(value) ? value : null;
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function formatJakarta(date: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

function mapsLink(latitude: number, longitude: number) {
  return `https://maps.google.com/?q=${latitude},${longitude}`;
}

async function requireStaffContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*, stores(*)").eq("id", user.id).single<Profile>();
  if (!profile || profile.role !== "staff") redirect("/dashboard");
  if (!profile.store_id) redirect("/attendance?error=missing-store");

  const { data: store } = await supabase.from("stores").select("*").eq("id", profile.store_id).single<Store>();
  if (!store) redirect("/attendance?error=missing-store");

  return { profile, store, supabase, user };
}

function checkDistance(store: Store, latitude: number, longitude: number) {
  if (store.latitude == null || store.longitude == null) return null;
  const distance = distanceInMeters(latitude, longitude, store.latitude, store.longitude);
  if (distance > store.geofence_radius_m) {
    redirect(`/attendance?error=out-of-range&distance=${Math.round(distance)}&radius=${store.geofence_radius_m}`);
  }
  return distance;
}

export async function checkInAttendance(formData: FormData) {
  const { profile, store, supabase, user } = await requireStaffContext();

  const latitude = numberOrNull(formData, "latitude");
  const longitude = numberOrNull(formData, "longitude");
  const accuracy = numberOrNull(formData, "accuracy");
  if (latitude === null || longitude === null) redirect("/attendance?error=missing-location");

  const distance = checkDistance(store, latitude, longitude);

  const { data: openSession } = await supabase
    .from("staff_attendance")
    .select("id")
    .eq("staff_id", user.id)
    .is("check_out_at", null)
    .maybeSingle();
  if (openSession) redirect("/attendance?error=already-checked-in");

  const { error } = await supabase.from("staff_attendance").insert({
    check_in_accuracy: accuracy,
    check_in_at: new Date().toISOString(),
    check_in_distance_m: distance,
    check_in_latitude: latitude,
    check_in_longitude: longitude,
    staff_id: user.id,
    store_id: store.id,
  });
  if (error) redirect("/attendance?error=save-failed");

  await sendTelegramMessage(
    [
      "✅ Check-in Absensi",
      `Staff: ${profile.full_name}`,
      `Store: ${store.name}`,
      `Waktu: ${formatJakarta(new Date())}`,
      `Lokasi: ${mapsLink(latitude, longitude)}`,
    ].join("\n"),
  );

  redirect("/attendance?saved=checkin");
}

export async function checkOutAttendance(formData: FormData) {
  const { profile, store, supabase, user } = await requireStaffContext();

  const latitude = numberOrNull(formData, "latitude");
  const longitude = numberOrNull(formData, "longitude");
  const accuracy = numberOrNull(formData, "accuracy");
  if (latitude === null || longitude === null) redirect("/attendance?error=missing-location");

  const distance = checkDistance(store, latitude, longitude);
  const notes = text(formData, "notes");

  const { data: openSession } = await supabase
    .from("staff_attendance")
    .select("id")
    .eq("staff_id", user.id)
    .is("check_out_at", null)
    .order("check_in_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!openSession) redirect("/attendance?error=not-checked-in");

  const { error } = await supabase
    .from("staff_attendance")
    .update({
      check_out_accuracy: accuracy,
      check_out_at: new Date().toISOString(),
      check_out_distance_m: distance,
      check_out_latitude: latitude,
      check_out_longitude: longitude,
      notes: notes || null,
    })
    .eq("id", openSession.id);
  if (error) redirect("/attendance?error=save-failed");

  await sendTelegramMessage(
    [
      "🚪 Check-out Absensi",
      `Staff: ${profile.full_name}`,
      `Store: ${store.name}`,
      `Waktu: ${formatJakarta(new Date())}`,
      `Lokasi: ${mapsLink(latitude, longitude)}`,
      notes ? `Catatan: ${notes}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  redirect("/attendance?saved=checkout");
}
