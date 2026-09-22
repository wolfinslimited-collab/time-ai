import type { Metadata } from "next";
import PricingExperience from "../../../pricing/pricing-experience";
import "../../../pricing/pricing.css";

export const metadata: Metadata = {
  title: "Timeless Studio vs Higgsfield — Compare AI Model Costs",
  description:
    "Compare selected AI model costs, see exactly what each Timeless Studio credit pack makes, and create without a monthly subscription.",
  alternates: { canonical: "/studio/compare/higgsfield" },
  robots: { index: true, follow: true },
};

export default function HiggsfieldComparisonPage() {
  return <PricingExperience variant="higgsfield" />;
}
