"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Wrapper from "@/app/components/wrapper";

const bareRoutes = [
  "/",
  "/pricing",
  "/auth-login",
  "/auth-signup",
  "/auth-signup-success",
  "/auth-re-password",
  "/auth-lock-screen",
];

export default function LayoutGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  
const __public = (
    pathname === "/" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/pricing" ||
    pathname === "/privacy" ||
    pathname === "/terms"
  );
  if (__public) return <>{children}</>;
const isBare = bareRoutes.includes(pathname) || pathname.startsWith("/auth-");

  if (isBare) return <>{children}</>;
  return <Wrapper>{children}</Wrapper>;
}
