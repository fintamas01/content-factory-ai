import { redirect } from "next/navigation";

// Back-compat alias: spec mentioned /onboarding/complete as step 3.
export default function OnboardingStep3Alias() {
  redirect("/onboarding/complete");
}

