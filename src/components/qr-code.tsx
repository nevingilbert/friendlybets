"use client";

import { useEffect, useState } from "react";

/**
 * Renders an invite URL as a QR code so guests can join by pointing a camera.
 *
 * The encoder is imported dynamically: most guests open this on a phone and go
 * straight to betting, so it only loads for whoever opens Share or the big screen.
 */
export function QrCode({ value, size = 200, className = "" }: { value: string; size?: number; className?: string }) {
  const [rendered, setRendered] = useState<{ value: string; src: string } | null>(null);

  useEffect(() => {
    if (!value) return undefined;
    let cancelled = false;
    import("qrcode")
      .then(({ default: QRCode }) =>
        QRCode.toDataURL(value, {
          width: size * 2, // 2x for retina
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#09090bff", light: "#ffffffff" },
        }),
      )
      .then((src) => {
        if (!cancelled) setRendered({ value, src });
      })
      .catch(() => {
        if (!cancelled) setRendered(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!rendered || rendered.value !== value) {
    return <div style={{ width: size, height: size }} className={`animate-pulse rounded-xl bg-zinc-800 ${className}`} />;
  }

  return (
    // A data: URL generated in the browser; next/image adds nothing here.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={rendered.src}
      width={size}
      height={size}
      alt={`QR code linking to ${value}`}
      className={`rounded-xl bg-white ${className}`}
    />
  );
}
