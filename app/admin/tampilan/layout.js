import { cookies } from "next/headers";
import { adminSahCookieStore } from "@/lib/adminAuth";
import AdminGerbang from "@/components/AdminGerbang";
import AdminSesi from "@/components/AdminSesi";

export const dynamic = "force-dynamic";

// Belum masuk → formulir kode admin tampil DI TEMPAT (URL yang sama), bukan dilempar ke /admin/login: selesai masuk, halaman ini langsung terbuka.
export default async function AdminTampilanLayout({ children }) {
  const isAdmin = await adminSahCookieStore(cookies());
  if (!isAdmin) return <AdminGerbang />;
  return <div className="min-h-screen bg-bg"><AdminSesi />{children}</div>;
}
