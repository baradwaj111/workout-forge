import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const profile = await prisma.profile.findUnique({ where: { id: 1 } });
  if (!profile) redirect("/onboarding");
  redirect("/today");
}
