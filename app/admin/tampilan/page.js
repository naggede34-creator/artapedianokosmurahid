import { Suspense } from "react";
import AdminSwitcher from "@/components/AdminSwitcher";
import AdminTampilan from "@/components/AdminTampilan";

export const metadata = { title: "Popup & Tampilan — Admin" };

export default function Page() {
  return (
    <>
      <Suspense fallback={null}><AdminSwitcher /></Suspense>
      <AdminTampilan />
    </>
  );
}
