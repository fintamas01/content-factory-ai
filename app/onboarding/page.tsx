import { redirect } from "next/navigation";

// Canonical entry: always start at step 1.
export default function OnboardingIndex() {
  redirect("/onboarding/step-1");
}

