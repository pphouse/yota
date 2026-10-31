import type { Metadata } from "next";
import { Settings } from "@/components/Settings";

export const metadata: Metadata = { title: "設定 — yota" };

export default function SettingsPage() {
  return <Settings />;
}
