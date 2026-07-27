export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-24">
      <div
        className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary"
        role="status"
        aria-label="로딩 중"
      />
    </div>
  );
}
