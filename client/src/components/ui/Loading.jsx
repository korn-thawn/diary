/** Loading placeholder: a few slowly breathing lines that hold the layout (announced to screen readers). */
export default function Loading({ lines = 3, className = "" }) {
  const widths = ["w-2/3", "w-full", "w-5/6", "w-1/2", "w-3/4"];
  return (
    <div className={`space-y-3 py-2 ${className}`} role="status" aria-label="กำลังโหลด">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={`skeleton h-4 ${widths[i % widths.length]}`} style={{ animationDelay: `${i * 120}ms` }} />
      ))}
      <span className="sr-only">กำลังโหลด…</span>
    </div>
  );
}
