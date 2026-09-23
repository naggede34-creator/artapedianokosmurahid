import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAdminCookieStore } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export default function AdminDashboardLayout({ children }) {
  const isAdmin = isAdminCookieStore(cookies());
  if (!isAdmin) redirect("/admin/login");
  return <div className="min-h-screen bg-bg">{children}</div>;
}
