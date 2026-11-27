import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { demoModeAllowed } from "@/lib/demo/gate";
import { DemoShell } from "@/components/demo/DemoShell";

export const metadata: Metadata = {
  title: "DEMO — ANGREN ESTATE monetizatsiya",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  // Production builds and Vercel get a plain 404: the demo is local-only.
  if (!demoModeAllowed()) notFound();
  return <DemoShell>{children}</DemoShell>;
}
