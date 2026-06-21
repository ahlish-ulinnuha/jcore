import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import type { Profile } from "@/lib/types";
import { NavLinks } from "./NavLinks";
import { ResponsiveTables } from "./ResponsiveTables";
import { NavigationLoading } from "./NavigationLoading";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single<Profile>();

  if (!profile) {
    return (
      <main className="login-page">
        <section className="login-box panel">
          <h1>Profil belum dibuat</h1>
          <p className="muted">Akun sudah login, tetapi belum ada data role di tabel profiles.</p>
          <div className="alert">
            User ID login: <strong>{user.id}</strong>
            <br />
            Email: <strong>{user.email}</strong>
            {profileError ? (
              <>
                <br />
                Supabase error: <strong>{profileError.message}</strong>
                <br />
                Code: <strong>{profileError.code}</strong>
              </>
            ) : null}
          </div>
          <form action={signOut}>
            <button className="button" type="submit">
              Keluar
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (!profile.email && user.email) {
    await supabase.from("profiles").update({ email: user.email }).eq("id", user.id);
    profile.email = user.email;
  }

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Navigasi cepat">
        <Link className="sidebar-mark" href="/dashboard" title="Dashboard">
          JC
        </Link>
        <Link href="/dashboard" title="Dashboard">⌘</Link>
        {profile.role !== "vendor" ? <Link href="/requests/new" title="Request Baru">＋</Link> : null}
        {profile.role !== "vendor" ? <Link href="/reports/daily" title="Report Harian">▣</Link> : null}
        {profile.role !== "vendor" ? <Link href="/reports/spices" title="Report Bumbu">◐</Link> : null}
        {profile.role === "admin" ? <Link href="/admin/master" title="Master Data">⚙</Link> : null}
        {profile.role === "vendor" ? <Link href="/vendor" title="Vendor">✓</Link> : null}
        <form action={signOut} className="sidebar-bottom">
          <button type="submit" title="Keluar">↪</button>
        </form>
      </aside>
      <div className="app-frame">
        <header className="topbar">
          <Link className="brand" href="/dashboard">
            <span className="brand-mark">J</span>
            JCore
          </Link>
          <nav className="nav" aria-label="Navigasi utama">
            <NavLinks role={profile.role} />
          </nav>
          <div className="user-chip">
            <span>{profile.full_name}</span>
            <Link className="icon-button tooltip-button" data-tooltip="Ganti password" href="/account/password" title="Ganti password">
              <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
                <path d="M7 11V8a5 5 0 0 1 9.6-2" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                <rect height="10" rx="2.5" stroke="currentColor" strokeWidth="2" width="14" x="5" y="11" />
                <path d="m13 14-2 3h3l-2 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
              </svg>
            </Link>
            <form action={signOut}>
              <button className="icon-button tooltip-button" data-tooltip="Keluar" title="Keluar" type="submit">
                <svg aria-hidden="true" fill="none" height="18" viewBox="0 0 24 24" width="18">
                  <path d="M15 6V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                  <path d="M10 12h10m0 0-3-3m3 3-3 3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
            </form>
          </div>
        </header>
        <NavigationLoading />
        <ResponsiveTables />
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
