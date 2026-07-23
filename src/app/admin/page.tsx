import { isAdminServer } from "@/lib/adminAuth";
import { AdminApp } from "@/components/admin/AdminApp";
import { AdminLogin } from "@/components/admin/AdminLogin";

export const dynamic = "force-dynamic";

export const metadata = { title: "Admin · Commonplace" };

export default async function AdminPage() {
  const authed = await isAdminServer();
  return authed ? <AdminApp /> : <AdminLogin />;
}
