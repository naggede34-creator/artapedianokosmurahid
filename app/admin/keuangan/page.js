import { Suspense } from "react";
import AdminSwitcher from "@/components/AdminSwitcher";
import AdminKeuangan from "@/components/AdminKeuangan";

export const metadata = { title: "Alat Admin" };

export default function Page() {
  return (
    <>
      <Suspense fallback={null}><AdminSwitcher /></Suspense>
      <AdminKeuangan />
    </>
  );
}
