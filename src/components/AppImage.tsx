import { useState } from 'react';
import { Smartphone } from 'lucide-react';
import { resolveAssetUrl } from '../lib/assets';

interface AppImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export function AppImage({
  src,
  alt,
  className = '',
  fallbackLabel,
}: AppImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const resolved = resolveAssetUrl(src);
  const failed = failedSrc === resolved;

  if (!resolved || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-zinc-100 to-zinc-200 text-zinc-500 select-none ${className}`}
      >
        <Smartphone className="w-6 h-6 text-emerald-700/70" />
        {fallbackLabel && (
          <span className="text-xs font-medium text-zinc-600 px-2 text-center truncate max-w-full">
            {fallbackLabel}
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={resolved}
      loading="lazy"
      decoding="async"
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailedSrc(resolved)}
      className={className}
    />
  );
}
