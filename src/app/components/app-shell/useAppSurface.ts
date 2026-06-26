"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "dna_app_surface";

function readSurfaceFlag() {
  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);
  const requestedWeb = params.get("surface") === "web";
  const requested = params.get("surface") === "app";
  if (requestedWeb) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  if (requested) {
    window.localStorage.setItem(STORAGE_KEY, "app");
  }

  const stored = !requestedWeb && window.localStorage.getItem(STORAGE_KEY) === "app";
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
  const compactViewport = window.matchMedia("(max-width: 767px)").matches;

  return requested || stored || (!requestedWeb && (standalone || compactViewport));
}

export function useAppSurface(initialAppSurface = false) {
  const [isAppSurface, setIsAppSurface] = useState(initialAppSurface);

  useEffect(() => {
    const refresh = () => setIsAppSurface(readSurfaceFlag());
    refresh();

    window.addEventListener("resize", refresh);
    window.addEventListener("orientationchange", refresh);
    return () => {
      window.removeEventListener("resize", refresh);
      window.removeEventListener("orientationchange", refresh);
    };
  }, []);

  return isAppSurface;
}
