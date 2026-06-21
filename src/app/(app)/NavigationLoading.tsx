"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";

type Toast = {
  text: string;
  tone: "draft" | "submit" | "delete";
};

export function NavigationLoading() {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setLoading(false);
    const queuedToast = sessionStorage.getItem("request-toast");
    if (queuedToast) {
      sessionStorage.removeItem("request-toast");
      setToast(JSON.parse(queuedToast) as Toast);
    }
  }, [pathname]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || anchor.target) return;
      if (href === pathname) return;

      event.preventDefault();
      setLoading(true);
      startTransition(() => router.push(href));
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [pathname, router]);

  useEffect(() => {
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (!form || form.dataset.noRouteLoading === "true") return;
      setLoading(true);
    };

    document.addEventListener("submit", onSubmit, true);
    return () => document.removeEventListener("submit", onSubmit, true);
  }, []);

  return (
    <>
      {loading ? (
        <div className="route-loading-overlay">
          <div className="route-spinner" aria-label="Loading" />
        </div>
      ) : null}
      {toast ? <div className={`toast ${toast.tone}`}>{toast.text}</div> : null}
    </>
  );
}
