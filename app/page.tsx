import { redirect } from "next/navigation";

/** Marketing home lives at app/(site)/page.tsx — this file should not be used. */
export default function DeprecatedRootPage() {
  redirect("/");
}
