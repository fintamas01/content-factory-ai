import { redirect } from "next/navigation";

export default function HistoryLegacyRedirect() {
  redirect("/dashboard/history");
}
