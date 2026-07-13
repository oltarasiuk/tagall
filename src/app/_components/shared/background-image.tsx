"use client";

import { useState, type ComponentPropsWithoutRef } from "react";
import Image from "next/image";
import { cn } from "../../../lib";

type Props = ComponentPropsWithoutRef<"div"> & { image: string };

export const BackgroundImage = (props: Props) => {
  const { children, image, className, ...restProps } = props;
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div
      className={cn("relative h-full min-h-[100dvh] w-full", className)}
      {...restProps}
    >
      {/* Fixed positioned background container */}
      <div
        aria-hidden="true"
        className="fixed inset-0 -z-10 h-[100dvh] w-[100dvw] overflow-hidden bg-background"
      >
        {/* A lightweight fallback keeps the page from flashing black while the image loads. */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br from-background via-muted to-background transition-opacity duration-500",
            isLoaded ? "opacity-0" : "opacity-100",
          )}
        />
        <Image
          src={image}
          alt=""
          fill
          sizes="100vw"
          unoptimized
          className={cn(
            "object-cover object-center transition-opacity duration-500",
            isLoaded ? "opacity-[0.10]" : "opacity-0",
          )}
          priority
          onLoad={() => setIsLoaded(true)}
        />
      </div>

      {/* Content container with proper positioning */}
      <div className="relative z-0 h-full min-h-[100dvh] w-full">
        {children}
      </div>
    </div>
  );
};
