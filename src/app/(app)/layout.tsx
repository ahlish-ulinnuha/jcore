import Link from "next/link";
import { redirect } from "next/navigation";
import { allowedMenuKeysForRole, firstAccessibleHref, hasAnyMasterMenuAccess, hasMenuAccess } from "@/lib/menu-access";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";
import type { Profile, ProfileMenuAccess } from "@/lib/types";
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

  const { data: menuAccessRows } = await supabase
    .from("profile_menu_access")
    .select("*")
    .eq("profile_id", profile.id)
    .returns<ProfileMenuAccess[]>();
  const allowedMenuKeys = allowedMenuKeysForRole(profile.role, menuAccessRows ?? []);
  const homeHref = firstAccessibleHref(profile.role, allowedMenuKeys);

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Navigasi cepat">
        <Link aria-label="JCore" className="sidebar-mark" data-tooltip="JCore" href={homeHref} title="JCore">
          JC
        </Link>
        {hasMenuAccess("dashboard", allowedMenuKeys) ? <Link aria-label="Dashboard" data-tooltip="Dashboard" href="/dashboard" title="Dashboard">⌘</Link> : null}
        {hasMenuAccess("requests", allowedMenuKeys) ? <Link aria-label="Request Baru" data-tooltip="Request Baru" href="/requests/new" title="Request Baru">＋</Link> : null}
        {hasMenuAccess("report_daily", allowedMenuKeys) ? <Link aria-label="Report Harian" data-tooltip="Report Harian" href="/reports/daily" title="Report Harian">▣</Link> : null}
        {hasMenuAccess("report_spices", allowedMenuKeys) ? <Link aria-label="Report Bumbu" data-tooltip="Report Bumbu" href="/reports/spices" title="Report Bumbu">◐</Link> : null}
        {hasMenuAccess("report_sales", allowedMenuKeys) ? <Link aria-label="Report Sales" data-tooltip="Report Sales" href="/reports/sales" title="Report Sales">Rp</Link> : null}
        {hasMenuAccess("shopping", allowedMenuKeys) ? <Link aria-label="Belanja" data-tooltip="Belanja" href="/shopping" title="Belanja">$</Link> : null}
        {hasMenuAccess("schedules", allowedMenuKeys) ? <Link aria-label="Schedule" data-tooltip="Schedule" href="/schedules" title="Schedule">⌚</Link> : null}
        {profile.role === "admin" && hasMenuAccess("overtime_summary", allowedMenuKeys) ? <Link aria-label="Overtime Summary" data-tooltip="Overtime Summary" href="/overtime-summary" title="Overtime Summary">OT</Link> : null}
        {hasAnyMasterMenuAccess(allowedMenuKeys) ? <Link aria-label="Master Data" data-tooltip="Master Data" href="/admin/master" title="Master Data">⚙</Link> : null}
        {hasMenuAccess("vendor_portal", allowedMenuKeys) ? <Link aria-label="Vendor" data-tooltip="Vendor" href="/vendor" title="Vendor">✓</Link> : null}
        <form action={signOut} className="sidebar-bottom">
          <button aria-label="Keluar" data-tooltip="Keluar" type="submit" title="Keluar">↪</button>
        </form>
      </aside>
      <div className="app-frame">
        <header className="topbar">
          <Link className="brand" href={homeHref}>
            <span className="brand-mark">J</span>
            JCore
          </Link>
          <nav className="nav" aria-label="Navigasi utama">
            <NavLinks allowedMenuKeys={allowedMenuKeys} role={profile.role} />
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
