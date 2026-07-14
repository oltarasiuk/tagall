"use client";

import { useEffect, useState, type ComponentPropsWithoutRef } from "react";
import Image from "next/image";
import { cn } from "../../../lib";

type Props = ComponentPropsWithoutRef<"div"> & {
  image: string;
  highQualityImage?: string;
};

export const BackgroundImage = (props: Props) => {
  const { children, image, highQualityImage, className, ...restProps } = props;
  const [isLowQualityLoaded, setIsLowQualityLoaded] = useState(false);
  const [shouldLoadHighQuality, setShouldLoadHighQuality] = useState(false);
  const [isHighQualityLoaded, setIsHighQualityLoaded] = useState(false);
  const highQualitySource = highQualityImage ?? image.replace("-bg.webp", ".webp");

  useEffect(() => {
    setIsLowQualityLoaded(false);
    setShouldLoadHighQuality(false);
    setIsHighQualityLoaded(false);

    const startHighQualityLoading = () => {
      if (typeof globalThis.requestIdleCallback === "function") {
        const idleCallbackId = globalThis.requestIdleCallback(
          () => setShouldLoadHighQuality(true),
          { timeout: 2_500 },
        );

        return () => globalThis.cancelIdleCallback(idleCallbackId);
      }

      const timeoutId = setTimeout(() => setShouldLoadHighQuality(true), 1_500);

      return () => clearTimeout(timeoutId);
    };

    let cancelHighQualityLoading: (() => void) | undefined;

    const onWindowLoad = () => {
      cancelHighQualityLoading = startHighQualityLoading();
    };

    if (document.readyState === "complete") {
      onWindowLoad();
    } else {
      window.addEventListener("load", onWindowLoad, { once: true });
    }

    return () => {
      window.removeEventListener("load", onWindowLoad);
      cancelHighQualityLoading?.();
    };
  }, [image, highQualitySource]);

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
            isLowQualityLoaded ? "opacity-0" : "opacity-100",
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
            isLowQualityLoaded ? "opacity-[0.10]" : "opacity-0",
          )}
          priority
          onLoad={() => setIsLowQualityLoaded(true)}
        />
        {shouldLoadHighQuality && (
          <Image
            src={highQualitySource}
            alt=""
            aria-hidden="true"
            fill
            sizes="100vw"
            unoptimized
            loading="lazy"
            fetchPriority="low"
            className={cn(
              "object-cover object-center transition-opacity duration-700",
              isHighQualityLoaded ? "opacity-[0.10]" : "opacity-0",
            )}
            onLoad={() => setIsHighQualityLoaded(true)}
          />
        )}
      </div>

      {/* Content container with proper positioning */}
      <div className="relative z-0 h-full min-h-[100dvh] w-full">
        {children}
      </div>
    </div>
  );
};
