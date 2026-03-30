import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { OnboardingCompleteClient } from "@/app/onboarding/complete/OnboardingCompleteClient";

function Fallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center bg-[#030712]">
      <Loader2 className="h-10 w-10 animate-spin text-blue-400" aria-hidden />
    </div>
  );
}

export default function OnboardingCompletePage() {
  return (
    <Suspense fallback={<Fallback />}>
      <OnboardingCompleteClient />
    </Suspense>
  );
}

