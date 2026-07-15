"use client";

import { useState } from "react";
import Image from "next/image";
import { api } from "../../../../trpc/react";
import type { ArtworkSelection } from "../../../../server/api/modules/artwork/types/artwork.type";
import type {
  MediaKindType,
  ProviderNameType,
} from "../../../../server/api/modules/media/types";
import {
  Button,
  Input,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../ui";

type Props = {
  provider: ProviderNameType;
  externalId: string;
  mediaKind: MediaKindType;
  defaultImage: string | null;
  selection: ArtworkSelection;
  preview: string | null;
  onChange: (selection: ArtworkSelection, preview: string | null) => void;
};

const readAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });

/**
 * The always-visible cover control on the Add/Edit form. Auto is the default;
 * the user may pick another suggested cover, upload/paste one, give a URL, or
 * ask for a generated cover. A single final poster is chosen — this is not
 * multi-poster storage.
 */
export const CoverPicker = (props: Props) => {
  const {
    provider,
    externalId,
    mediaKind,
    defaultImage,
    selection,
    preview,
    onChange,
  } = props;

  const [tab, setTab] = useState("suggested");
  const [manualUrl, setManualUrl] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);

  const candidates = api.artwork.getCandidates.useQuery(
    { provider, externalId, mediaKind },
    { enabled: tab === "suggested", staleTime: 5 * 60 * 1000, retry: false },
  );

  const selectFile = async (file: File | undefined) => {
    setUploadError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadError("That file is not an image");
      return;
    }
    try {
      const dataUrl = await readAsDataUrl(file);
      onChange({ mode: "upload", dataBase64: dataUrl }, dataUrl);
    } catch {
      setUploadError("Could not read that file");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded bg-muted">
          {preview ? (
            <Image
              src={preview}
              alt="Selected cover"
              fill
              sizes="64px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-center text-[10px] text-muted-foreground">
              {selection.mode === "generated"
                ? "Generated"
                : "Auto cover"}
            </div>
          )}
        </div>
        <div className="min-w-0 text-sm">
          <p className="font-medium">Cover</p>
          <p className="text-muted-foreground">
            {selection.mode === "auto" &&
              "Auto — best available cover, or a generated one if none load."}
            {selection.mode === "candidate" && "Selected from suggestions."}
            {selection.mode === "upload" && "Uploaded image."}
            {selection.mode === "manual-url" && "Image from URL."}
            {selection.mode === "generated" && "Generated gradient cover."}
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full">
          <TabsTrigger value="suggested" className="flex-1">
            Suggested
          </TabsTrigger>
          <TabsTrigger value="upload" className="flex-1">
            Upload
          </TabsTrigger>
          <TabsTrigger value="generated" className="flex-1">
            Generated
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suggested" className="pt-2">
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            <button
              type="button"
              onClick={() =>
                onChange(
                  { mode: "auto", allowGeneratedFallback: true },
                  defaultImage,
                )
              }
              className={`flex aspect-[2/3] items-center justify-center rounded border text-center text-[10px] ${
                selection.mode === "auto"
                  ? "border-primary ring-2 ring-primary"
                  : "border-border"
              }`}
            >
              Auto
            </button>
            {candidates.isLoading &&
              Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="aspect-[2/3] rounded" />
              ))}
            {candidates.data?.candidates.map((candidate) => {
              const isSelected =
                selection.mode === "candidate" &&
                selection.candidateId === candidate.candidateId;
              return (
                <button
                  key={candidate.candidateId}
                  type="button"
                  title={candidate.attribution?.label ?? undefined}
                  onClick={() =>
                    onChange(
                      {
                        mode: "candidate",
                        candidateId: candidate.candidateId,
                        allowGeneratedFallback: true,
                      },
                      candidate.previewUrl,
                    )
                  }
                  className={`relative aspect-[2/3] overflow-hidden rounded border ${
                    isSelected
                      ? "border-primary ring-2 ring-primary"
                      : "border-border"
                  }`}
                >
                  {candidate.previewUrl && (
                    <Image
                      src={candidate.previewUrl}
                      alt="Cover option"
                      fill
                      sizes="96px"
                      className="object-cover"
                      unoptimized
                    />
                  )}
                </button>
              );
            })}
          </div>
          {candidates.data?.candidates.length === 0 &&
            !candidates.isLoading && (
              <p className="pt-2 text-xs text-muted-foreground">
                No suggested covers. Upload one or use a generated cover.
              </p>
            )}
        </TabsContent>

        <TabsContent value="upload" className="space-y-3 pt-2">
          <Input
            type="file"
            accept="image/*"
            onChange={(event) => void selectFile(event.target.files?.[0])}
            onPaste={(event) => {
              const file = event.clipboardData.files?.[0];
              if (file) void selectFile(file);
            }}
          />
          {uploadError && (
            <p className="text-xs text-destructive">{uploadError}</p>
          )}
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://… image URL"
              value={manualUrl}
              onChange={(event) => setManualUrl(event.target.value)}
            />
            <Button
              type="button"
              variant="secondary"
              disabled={!manualUrl}
              onClick={() =>
                onChange({ mode: "manual-url", url: manualUrl }, manualUrl)
              }
            >
              Use URL
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="generated" className="pt-2">
          <p className="pb-2 text-xs text-muted-foreground">
            Create a lightweight gradient cover from the title. You can replace
            it later.
          </p>
          <Button
            type="button"
            variant={selection.mode === "generated" ? "default" : "secondary"}
            onClick={() => onChange({ mode: "generated" }, null)}
          >
            Use generated cover
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
};
