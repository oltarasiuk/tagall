import { CldImage } from "next-cloudinary";
import { cn } from "../../../lib";
import { env } from "../../../env";

type Props = {
  publicId: string;
  folder: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  sizes?: string;
  variant?: "default" | "background";
};

export const CloudinaryImage = (props: Props) => {
  const { publicId, folder, className, height, width, priority, sizes, variant = "default" } = props;
  const projectFolder = env.NEXT_PUBLIC_CLOUDINARY_FOLDER;
  const src = `${projectFolder}/${folder}/${publicId}`;

  const isBackground = variant === "background";

  return (
    <CldImage
      loading={priority ? undefined : "lazy"}
      priority={priority}
      alt={isBackground ? "" : `cover ${publicId}`}
      src={src}
      width={isBackground ? 50 : (width ?? 200)}
      height={isBackground ? 75 : (height ?? 300)}
      sizes={sizes}
      quality={isBackground ? 10 : undefined}
      className={cn(
        "aspect-[27/40] rounded-lg border border-input object-cover shadow-md",
        className,
      )}
      crop={{
        type: "fit",
        source: true,
      }}
    />
  );
};
