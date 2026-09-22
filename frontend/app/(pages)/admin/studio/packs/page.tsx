import type { Metadata } from "next";
import { PacksAdmin } from "./packs-admin";

export const metadata: Metadata = {
  title: "Admin — Studio credit packs",
  description: "Manage Timeless Studio credit packs.",
  robots: { index: false, follow: false },
};

export default function AdminStudioPacksPage() {
  return <PacksAdmin />;
}
