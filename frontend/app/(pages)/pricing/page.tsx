import type { Metadata } from "next";
import PricingExperience from "./pricing-experience";
import "./pricing.css";

export const metadata: Metadata = {
  title: "Timeless Studio Pricing — AI Creation Credits",
  description:
    "More creating, no monthly commitment. Compare AI model costs, see what each pack makes, and buy Timeless Studio credits from $9.99.",
  alternates: { canonical: "/pricing" },
  robots: { index: true, follow: true },
};

export default function PricingPage() {
  return <PricingExperience />;
}
