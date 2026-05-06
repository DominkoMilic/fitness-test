import { redirect } from "next/navigation";

export default async function AdminUserIndexPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  redirect(`/admin/users/${code}/dashboard`);
}
