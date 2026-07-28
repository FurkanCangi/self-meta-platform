"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase/client";

const STORAGE_KEY = "dna_therapist_profile";

type DirectoryProfilePayload = {
  profile?: {
    firstName?: string | null;
    lastName?: string | null;
    profession?: string | null;
    title?: string | null;
  } | null;
};

type StoredProfile = {
  firstName?: unknown;
  lastName?: unknown;
  profession?: unknown;
  title?: unknown;
};

type TherapistIdentity = {
  displayName: string;
  greetingName: string;
  accountDetail: string;
  initials: string;
  resolved: boolean;
};

type TherapistIdentityContextValue = TherapistIdentity & {
  resetIdentity: () => void;
};

const EMPTY_IDENTITY: TherapistIdentity = {
  displayName: "DNA Intelligence",
  greetingName: "",
  accountDetail: "Klinik çalışma alanı",
  initials: "DNA",
  resolved: false,
};

const TherapistIdentityContext = createContext<TherapistIdentityContextValue | null>(null);

function cleanText(value?: unknown) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function titleCaseFirstName(value: string) {
  const firstName = cleanText(value).split(" ").filter(Boolean)[0] || "";
  if (!firstName || firstName.includes("@")) return "";
  return `${firstName.slice(0, 1).toLocaleUpperCase("tr-TR")}${firstName
    .slice(1)
    .toLocaleLowerCase("tr-TR")}`;
}

function initialsFromName(value: string) {
  if (!value || value.includes("@")) return "DNA";
  const initials = value
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase("tr-TR") || "")
    .join("");
  return initials || "DNA";
}

function readStoredProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredProfile;
    const fullName = [parsed.firstName, parsed.lastName].map(cleanText).filter(Boolean).join(" ");
    const detail = cleanText(parsed.profession || parsed.title);
    return { fullName, detail };
  } catch {
    return null;
  }
}

function createIdentity({
  personName,
  fallbackName,
  detail,
  resolved,
}: {
  personName?: string | null;
  fallbackName?: string | null;
  detail?: string | null;
  resolved: boolean;
}): TherapistIdentity {
  const cleanPersonName = cleanText(personName);
  const displayName = cleanPersonName || cleanText(fallbackName) || EMPTY_IDENTITY.displayName;
  return {
    displayName,
    greetingName: titleCaseFirstName(cleanPersonName),
    accountDetail: cleanText(detail) || EMPTY_IDENTITY.accountDetail,
    initials: initialsFromName(displayName),
    resolved,
  };
}

export function TherapistIdentityProvider({ children }: { children: React.ReactNode }) {
  const [identity, setIdentity] = useState<TherapistIdentity>(EMPTY_IDENTITY);

  const resetIdentity = useCallback(() => {
    setIdentity({ ...EMPTY_IDENTITY, resolved: true });
  }, []);

  useEffect(() => {
    let isMounted = true;
    const storedProfile = readStoredProfile();

    if (storedProfile?.fullName || storedProfile?.detail) {
      setIdentity(createIdentity({
        personName: storedProfile.fullName,
        detail: storedProfile.detail,
        resolved: false,
      }));
    }

    const loadIdentity = async () => {
      const authRequest = supabase.auth.getUser().catch(() => ({ data: { user: null }, error: null }));
      const directoryRequest = fetch("/api/therapist-directory/profile", { cache: "no-store" })
        .then(async (response) => response.ok ? (await response.json()) as DirectoryProfilePayload : null)
        .catch(() => null);

      const [authResult, directoryPayload] = await Promise.all([authRequest, directoryRequest]);
      if (!isMounted) return;

      const user = authResult.data.user;
      // Auth metadata is display-only here; it never grants access or changes authorization.
      const authName = cleanText(user?.user_metadata?.full_name || user?.user_metadata?.name);
      const authEmail = cleanText(user?.email);
      const directoryName = [
        directoryPayload?.profile?.firstName,
        directoryPayload?.profile?.lastName,
      ].map(cleanText).filter(Boolean).join(" ");
      const personName = directoryName || authName || storedProfile?.fullName || "";
      const detail = cleanText(
        directoryPayload?.profile?.profession
          || directoryPayload?.profile?.title
          || storedProfile?.detail
          || authEmail,
      );

      setIdentity(createIdentity({
        personName,
        fallbackName: authEmail,
        detail,
        resolved: true,
      }));
    };

    void loadIdentity();
    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo<TherapistIdentityContextValue>(
    () => ({ ...identity, resetIdentity }),
    [identity, resetIdentity],
  );

  return (
    <TherapistIdentityContext.Provider value={value}>
      {children}
    </TherapistIdentityContext.Provider>
  );
}

export function useTherapistIdentity() {
  const context = useContext(TherapistIdentityContext);
  if (!context) {
    throw new Error("useTherapistIdentity must be used within TherapistIdentityProvider");
  }
  return context;
}
