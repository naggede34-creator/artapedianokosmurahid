import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminSahCookieStore } from "@/lib/adminAuth";
import AdminSwitcher from "@/components/AdminSwitcher";
import AdminPusat from "@/components/AdminPusat";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pusat Admin" };

export default async function AdminPusatPage() {
  if (!(await adminSahCookieStore(cookies()))) redirect("/admin/login");
  return (
    <div className="min-h-screen bg-bg">
      <Suspense fallback={null}><AdminSwitcher /></Suspense>
      <AdminPusat />
    </div>
  );
}
