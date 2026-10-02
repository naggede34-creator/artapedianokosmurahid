import { Suspense } from "react";
import { cookies } from "next/headers";
import { adminSahCookieStore } from "@/lib/adminAuth";
import AdminSwitcher from "@/components/AdminSwitcher";
import AdminPusat from "@/components/AdminPusat";
import AdminGerbang from "@/components/AdminGerbang";
import AdminSesi from "@/components/AdminSesi";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pusat Admin" };

export default async function AdminPusatPage() {
  if (!(await adminSahCookieStore(cookies()))) return <AdminGerbang />;
  return (
    <div className="min-h-screen bg-bg">
      <AdminSesi />
      <Suspense fallback={null}><AdminSwitcher /></Suspense>
      <AdminPusat />
    </div>
  );
}
