import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, ADMIN_COOKIE_VALUE } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

export default function AdminDashboardLayout({ children }) {
  const isAdmin = cookies().get(ADMIN_COOKIE)?.value === ADMIN_COOKIE_VALUE;
  if (!isAdmin) redirect("/admin/login");
  return <div className="min-h-screen bg-bg">{children}</div>;
}
