import {
  ArrowLeftRightIcon,
  BellIcon,
  Building2Icon,
  CodeXmlIcon,
  CreditCardIcon,
  LayoutDashboardIcon,
  LandmarkIcon,
  ReceiptTextIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export const NAV: { section: string; items: { href: string; label: string; icon: LucideIcon }[] }[] = [
  { section: "Overview", items: [{ href: "/", label: "Dashboard", icon: LayoutDashboardIcon }] },
  {
    section: "Parties",
    items: [
      { href: "/customers", label: "Customers", icon: UsersIcon },
      { href: "/suppliers", label: "Suppliers", icon: Building2Icon },
    ],
  },
  {
    section: "Pay-in",
    items: [
      { href: "/payments", label: "Payments", icon: CreditCardIcon },
      { href: "/sadad", label: "SADAD bills", icon: ReceiptTextIcon },
    ],
  },
  {
    section: "Escrow & Pay-out",
    items: [
      { href: "/escrow", label: "Escrow accounts", icon: LandmarkIcon },
      { href: "/payouts", label: "Payouts & splits", icon: ArrowLeftRightIcon },
    ],
  },
  {
    section: "Integration",
    items: [
      { href: "/notifications", label: "Notifications", icon: BellIcon },
      { href: "/developer", label: "API console", icon: CodeXmlIcon },
      { href: "/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];
