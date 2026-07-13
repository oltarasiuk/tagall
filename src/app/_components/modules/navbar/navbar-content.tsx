"use client";
import React, { type ComponentPropsWithRef } from "react";
import { Avatar, AvatarFallback, Button, Header, Separator } from "../../ui";
import { cn } from "~/lib";
import { LogIn, UserRound } from "lucide-react";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { NavbarButton } from "./navbar-button";
import { NAVBAR_LINKS } from "~/constants";
import { CloudinaryImage } from "../../shared";
import { api } from "../../../../trpc/react";

type Props = ComponentPropsWithRef<"div"> & {
  onNavigate?: () => void;
};

const NavbarContent = (props: Props) => {
  const { className, onNavigate, ...restProps } = props;

  const [user] = api.user.getUser.useSuspenseQuery();

  const { data: session } = useSession();

  const pathname = usePathname();

  return (
    <div
      className={cn(
        "flex h-full flex-col justify-between gap-4 p-6",
        className,
      )}
      {...restProps}
    >
      <Header vtag="h3">Tagall</Header>
      <div className="flex flex-col gap-4">
        {Object.values(NAVBAR_LINKS).map((value, index) => {
          if (value.type === "divider") {
            return <Separator key={index} />;
          } else if (value.type === "link") {
            const Icon = value.icon;
            return (
              <NavbarButton
                key={index}
                icon={<Icon />}
                pathname={value.href}
                title={value.title}
                isActive={pathname === value.href}
                onNavigate={onNavigate}
              />
            );
          }
        })}
      </div>

      {pathname === "/profile" ? (
        <Button
          size={"navbar"}
          variant={"destructive"}
          className={"h-16 w-full gap-4 text-center font-semibold"}
          onClick={() => signOut()}
        >
          Log out
        </Button>
      ) : session?.user.id ? (
        <NavbarButton
          icon={
            <Avatar>
              {user?.image ? (
                <CloudinaryImage
                  folder={"profile"}
                  publicId={user.image}
                  className="aspect-square h-full w-full rounded-full"
                />
              ) : (
                <AvatarFallback>
                  <UserRound />
                </AvatarFallback>
              )}
            </Avatar>
          }
          pathname={"/profile"}
          title={user.name ?? "Profile"}
          isActive={pathname === "/profile"}
          onNavigate={onNavigate}
        />
      ) : (
        <NavbarButton
          isLink={false}
          icon={<LogIn />}
          pathname={"/login"}
          title={"Login"}
          isActive={true}
          onClick={() => signIn("google")}
        />
      )}
    </div>
  );
};

export { NavbarContent };
