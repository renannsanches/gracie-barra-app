"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  GraduationCap,
  ReceiptText,
  ListTree,
  CreditCard,
  Building2,
  UserCheck,
} from "lucide-react";

const TABS = [
  { href: "/admin/financeiro",                  label: "Mensalidades",        icon: GraduationCap, exact: true  },
  { href: "/admin/financeiro/contas",           label: "Contas",              icon: ReceiptText,   exact: false },
  { href: "/admin/financeiro/fornecedores",     label: "Fornecedores",        icon: Building2,     exact: false },
  { href: "/admin/financeiro/clientes",         label: "Clientes",            icon: UserCheck,     exact: false },
  { href: "/admin/financeiro/categorias",       label: "Plano de contas",     icon: ListTree,      exact: false },
  { href: "/admin/financeiro/formas-pagamento", label: "Formas de pagamento", icon: CreditCard,    exact: false },
];

export function FinanceiroTabs() {
  const pathname = usePathname();
  return (
    <div className="border-b border-gray-100 bg-white">
      <nav className="flex items-center gap-1 overflow-x-auto px-3 md:px-6 scrollbar-none">
        {TABS.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-2 shrink-0 px-3 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap",
                active
                  ? "border-gb-blue text-gb-blue"
                  : "border-transparent text-gray-500 hover:text-gray-800"
              )}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
