import { useState, useEffect } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { Menu, Home, User, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Profile", href: "/dashboard/profile", icon: User },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function MobileNav({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close sheet on route change
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  const isActive = (href: string) => {
    if (href === "/dashboard") return location.pathname === "/dashboard";
    return location.pathname.startsWith(href);
  };

  return (
    <div className={cn("fixed left-4 top-4 z-50", className)}>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="icon" className="bg-card">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-card p-0">
          {/* Logo */}
          <div className="flex h-16 items-center border-b border-border px-6">
            <span className="text-lg font-semibold text-accent-gold">
              GenZen
            </span>
          </div>

          {/* Nav items */}
          <nav className="space-y-1 p-4">
            {navItems.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "border-l-2 border-accent-gold bg-sidebar-hover text-foreground"
                      : "text-muted-foreground hover:bg-sidebar-hover hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
