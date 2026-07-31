import Link from "next/link";

const links = [
  { href: "/", label: "Dashboard" },
  { href: "/trades", label: "Trades" },
  { href: "/calendar", label: "Calendar" },
  { href: "/checklist", label: "Checklist" },
  { href: "/rules", label: "Rules" },
  { href: "/analytics", label: "Analytics" },
  { href: "/achievements", label: "Achievements" },
];

export function Nav() {
  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-3">
        <span className="font-semibold tracking-tight">Gold Journal</span>
        <nav className="flex gap-4 text-sm text-muted-foreground">
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="hover:text-foreground">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
