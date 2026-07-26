export function ImageUploadHint({ recommendedSize }: { recommendedSize: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      최대 5MB · 권장 크기 {recommendedSize}
    </p>
  );
}
