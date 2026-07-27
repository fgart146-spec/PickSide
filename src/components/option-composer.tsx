"use client";

import { useEffect, useRef, useState } from "react";
import { UploadCloudIcon, XIcon } from "lucide-react";
import { VoteCard } from "@/components/vote-card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PollCategory } from "@/lib/categories";
import { cn } from "@/lib/utils";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

type OptionComposerProps = {
  side: "A" | "B";
  category: PollCategory;
  /** FormData field name for the file, e.g. "imageA". */
  imageName: string;
  /** FormData field name for the label, e.g. "optionA". */
  labelName: string;
  title: string;
  placeholder: string;
};

export function OptionComposer({
  side,
  category,
  imageName,
  labelName,
  title,
  placeholder,
}: OptionComposerProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function acceptFile(file: File | null) {
    setError(null);
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setError("JPG, PNG, WEBP 형식만 올릴 수 있어요.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("이미지는 10MB 이하로 올려주세요.");
      return;
    }
    // Sync the dropped/selected file into the hidden input so the parent
    // <form> submits it under `imageName`.
    const dt = new DataTransfer();
    dt.items.add(file);
    if (fileInputRef.current) fileInputRef.current.files = dt.files;
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  }

  function clearImage() {
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm font-semibold">{title}</p>

      <div className="flex flex-col gap-4 sm:flex-row">
        {/* Live preview — exactly how the option will render when voting */}
        <div className="w-full max-w-[180px] shrink-0 self-center sm:self-start">
          <VoteCard side={side} category={category} label={label || "선택지"} imageUrl={previewUrl} />
        </div>

        {/* Dropzone + controls */}
        <div className="flex flex-1 flex-col gap-2">
          <div
            role="button"
            tabIndex={0}
            aria-label={`${title} 이미지 업로드`}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              acceptFile(e.dataTransfer.files?.[0] ?? null);
            }}
            className={cn(
              "flex min-h-[120px] flex-1 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed p-4 text-center transition-colors",
              dragging
                ? "border-primary bg-accent"
                : "border-border hover:border-primary/60 hover:bg-accent/40"
            )}
          >
            <UploadCloudIcon className="size-6 text-muted-foreground" />
            <span className="text-sm font-medium">이미지를 드래그하거나 클릭해 업로드</span>
            <span className="text-xs text-muted-foreground">
              JPG · PNG · WEBP · 최대 10MB · 정사각형 권장
            </span>
          </div>

          {previewUrl && (
            <button
              type="button"
              onClick={clearImage}
              className="inline-flex items-center gap-1 self-start text-xs text-muted-foreground transition-colors hover:text-destructive"
            >
              <XIcon className="size-3.5" />
              이미지 제거
            </button>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        name={imageName}
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
      />

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={labelName}>선택지 텍스트</Label>
        <Input
          id={labelName}
          name={labelName}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
          maxLength={80}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
