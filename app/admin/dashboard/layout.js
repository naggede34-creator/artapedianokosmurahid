import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminSahCookieStore } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export default async function AdminDashboardLayout({ children }) {
  const isAdmin = await adminSahCookieStore(cookies());
  if (!isAdmin) redirect("/admin/login");
  return <div className="min-h-screen bg-bg">{children}</div>;
}
