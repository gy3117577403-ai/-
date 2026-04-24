/**
 * 列印專用區：不套用 (dashboard) 側欄與主版面，避免列印時樣式污染。
 */
export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-black print:min-h-0">
      {children}
    </div>
  );
}
