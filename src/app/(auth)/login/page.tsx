"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });

    if (loginError) {
      setLoading(false);
      setError(loginError.message);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="login-page">
      {loading ? (
        <div className="route-loading-overlay">
          <div className="route-spinner" aria-label="Loading" />
        </div>
      ) : null}
      <div className="login-mascot-bg" aria-hidden="true">
        <svg className="mascot-orbit mascot-orbit-one" fill="none" viewBox="0 0 140 140">
          <path d="M36 78c-16-8-21-28-9-42 16-19 48-14 59 8 9 18 31 16 39 33 7 16-7 33-26 35-19 1-21-12-35-10-15 2-17-17-28-24Z" />
        </svg>
        <svg className="mascot-orbit mascot-orbit-two" fill="none" viewBox="0 0 120 120">
          <path d="M65 12c18 2 34 18 35 36 1 17-12 28-23 39-13 13-28 25-46 18-18-7-20-29-13-45 8-18 26-50 47-48Z" />
        </svg>
      </div>
      <section className="login-stage">
        <div className="login-hero">
          <div className="login-brand-badge">JCore</div>
          <h1>Empowering Your Business to Move Faster</h1>
          <p>Management operasional toko dalam satu cockpit yang cepat, mudah dan real time</p>
          <div className="mascot-card image-card">
            <img alt="JCore Jagoan mascot" className="login-mascot-image" src="/images/jcore-jagoan-1000.png" />
          </div>
        </div>

        <section className="login-box panel">
          <p className="eyebrow">One Dashboard System</p>
          <h2>Masuk ke JCore</h2>
          <p className="muted"></p>

          <form className="form" onSubmit={onSubmit}>
            {error ? <div className="alert">{error}</div> : null}
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            <button className="button primary login-submit" type="submit" disabled={loading}>
              {loading ? "Memproses..." : "Masuk"}
            </button>
          </form>
        </section>
      </section>
      <footer className="login-footer">Copyright {new Date().getFullYear()} - Jagoan Group</footer>
    </main>
  );
}
