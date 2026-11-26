import { notFound } from "next/navigation";
import { devToolsAllowed } from "@/lib/env/safety";
import { TestLoginClient } from "./TestLoginClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Test kirishi | ANGREN ESTATE", robots: { index: false, follow: false } };

/** Local-only test login (404 on Vercel, in production builds and for non-test databases). */
export default function TestLoginPage() {
  if (!devToolsAllowed().allowed) notFound();
  return <TestLoginClient />;
}
