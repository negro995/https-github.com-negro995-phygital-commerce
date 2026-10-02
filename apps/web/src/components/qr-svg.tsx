/** Renders a server-generated QR SVG (produced by the `qrcode` library in the API). */
export function QrSvg({ svg, label, className }: { svg: string; label: string; className?: string }) {
  return <div role="img" aria-label={label} className={className ?? "size-40 bg-white p-2"} dangerouslySetInnerHTML={{ __html: svg }} />;
}
