import type { Metadata } from "next";
import { AdminApp } from "@/components/admin/AdminApp";

export const metadata: Metadata = { title: "管理 — yota", robots: { index: false, follow: false } };

/** 運営の管理者画面（パスワードで守る。中身は画面で取りに行く） */
export default function AdminPage() {
  return <AdminApp />;
}
