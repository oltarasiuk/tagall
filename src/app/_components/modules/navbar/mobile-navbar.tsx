"use client";

import { cn } from "~/lib";
import {
  Button,
  Sheet,
  SheetContent,
  type SheetContentProps,
  SheetTrigger,
} from "../../ui";
import { Menu } from "lucide-react";
import { useState } from "react";
import { NavbarContent } from "./navbar-content";

const MobileNavbar = (props: SheetContentProps) => {
  const { className, ...restProps } = props;
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild className="fixed right-6 top-6 z-50 lg:hidden">
        <Button size={"icon"} variant={"outline"}>
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent
        side={"left"}
        className={cn("overflow-hidden p-0", className)}
        {...restProps}
      >
        <div
          className="pointer-events-none absolute inset-0 z-0 opacity-[0.02]"
          style={{
            backgroundImage: "url('/halftone.png')",
            backgroundRepeat: "repeat",
          }}
        />
        <NavbarContent onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
};

export { MobileNavbar };
