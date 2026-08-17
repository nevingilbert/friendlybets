import { useEffect, useState } from 'react'

/**
 * Renders an invite URL as a QR code so guests can join by pointing a camera.
 *
 * The encoder is imported dynamically: most guests open this on a phone and go
 * straight to betting, so it stays out of the initial bundle and only loads for
 * whoever actually opens Share or the big-screen view.
 */
export function QrCode({ value, size = 200, className = '' }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let cancelled = false
    import('qrcode')
      .then(({ default: QRCodeLib }) =>
        QRCodeLib.toDataURL(value, {
          width: size * 2, // 2x for retina
          margin: 1,
          errorCorrectionLevel: 'M',
          color: { dark: '#09090bff', light: '#ffffffff' },
        }),
      )
      .then((url) => {
        if (!cancelled) setSrc(url)
      })
      .catch(() => {
        if (!cancelled) setSrc('')
      })
    return () => {
      cancelled = true
    }
  }, [value, size])

  if (!src) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`animate-pulse rounded-xl bg-zinc-800 ${className}`}
      />
    )
  }

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={`QR code linking to ${value}`}
      className={`rounded-xl bg-white ${className}`}
    />
  )
}
