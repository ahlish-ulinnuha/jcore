import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PasswordForm } from "./PasswordForm";

export default async function ChangePasswordPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow">Akun</p>
          <h1>Ganti Password</h1>
          <p className="muted">Gunakan password baru minimal 6 karakter.</p>
        </div>
      </div>
      <PasswordForm />
    </>
  );
}
