import { Suspense } from "react";
import AdminSwitcher from "@/components/AdminSwitcher";
import AdminPengguna from "@/components/AdminPengguna";

export const metadata = { title: "Pengguna & Blokir — Admin" };

export default function Page() {
  return (
    <>
      <Suspense fallback={null}><AdminSwitcher /></Suspense>
      <AdminPengguna />
    </>
  );
}
