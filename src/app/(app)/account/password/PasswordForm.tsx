"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PasswordForm() {
  const supabase = createClient();
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [tone, setTone] = useState<"alert" | "success">("alert");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setTone("alert");

    if (newPassword.length < 6) {
      setMessage("Password minimal 6 karakter.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("Konfirmasi password belum sama.");
      return;
    }

    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setNewPassword("");
    setConfirmPassword("");
    setTone("success");
    setMessage("Password berhasil diganti.");
  }

  return (
    <form className="panel form password-panel" onSubmit={submit}>
      {message ? <div className={tone === "success" ? "alert success" : "alert"}>{message}</div> : null}
      <div className="field">
        <label>Password Baru</label>
        <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required />
      </div>
      <div className="field">
        <label>Konfirmasi Password Baru</label>
        <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
      </div>
      <button className="button primary" disabled={saving} type="submit">
        {saving ? "Menyimpan..." : "Ganti Password"}
      </button>
    </form>
  );
}
