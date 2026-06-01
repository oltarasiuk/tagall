import { Suspense } from "react";
import { Navbar } from "../_components/modules";
import LoadingPage from "../loading";
import { api } from "../../trpc/server";
import { getServerAuthSession } from "../../server/auth";
import { redirect } from "next/navigation";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect("/");
  }

  void api.user.getUser.prefetch();

  return (
    <>
      <Navbar>
        <Suspense fallback={<LoadingPage />}>{children}</Suspense>
      </Navbar>
    </>
  );
}
