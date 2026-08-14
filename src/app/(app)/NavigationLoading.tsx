"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Toast = {
  text: string;
  tone: "draft" | "submit" | "delete";
};

export function NavigationLoading() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [, startTransition] = useTransition();
  const currentUrl = `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`;

  useEffect(() => {
    setLoading(false);
    const queuedToast = sessionStorage.getItem("request-toast");
    if (queuedToast) {
      sessionStorage.removeItem("request-toast");
      setToast(JSON.parse(queuedToast) as Toast);
    }
  }, [currentUrl]);

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
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || anchor.target || anchor.hasAttribute("download")) return;
      if (href === currentUrl) return;

      event.preventDefault();
      setLoading(true);
      startTransition(() => router.push(href));
    };

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [currentUrl, router]);

  useEffect(() => {
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement | null;
      if (!form || form.method.toLowerCase() !== "get") return;
      setLoading(true);
    };

    document.addEventListener("submit", onSubmit);
    return () => document.removeEventListener("submit", onSubmit);
  }, []);

  useEffect(() => {
    const onFormLoadingDone = () => setLoading(false);
    window.addEventListener("app:form-loading-done", onFormLoadingDone);
    return () => window.removeEventListener("app:form-loading-done", onFormLoadingDone);
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
