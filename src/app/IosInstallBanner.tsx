"use client";

import { useEffect, useState } from "react";

const DISMISSED_KEY = "jcore-ios-install-dismissed";

function isIosSafari() {
  const ua = window.navigator.userAgent;
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isIos && isSafari;
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as { standalone?: boolean }).standalone === true;
}

export function IosInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (!isIosSafari()) return;
    if (localStorage.getItem(DISMISSED_KEY) === "1") return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="ios-install-banner">
      <span>
        Install JCore: ketuk <strong>Share</strong> lalu <strong>&quot;Add to Home Screen&quot;</strong>
      </span>
      <button
        aria-label="Tutup"
        onClick={() => {
          localStorage.setItem(DISMISSED_KEY, "1");
          setVisible(false);
        }}
        type="button"
      >
        ✕
      </button>
    </div>
  );
}
