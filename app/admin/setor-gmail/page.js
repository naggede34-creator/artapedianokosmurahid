import { Suspense } from "react";
import AdminSwitcher from "@/components/AdminSwitcher";
import AdminSetorGmail from "@/components/AdminSetorGmail";

export const metadata = { title: "Stor Gmail — Admin" };

export default function Page() {
  return (
    <>
      <Suspense fallback={null}><AdminSwitcher /></Suspense>
      <AdminSetorGmail />
    </>
  );
}
