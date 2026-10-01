import React, { useState } from 'react';
import { Sofa } from 'lucide-react';

interface ResilientImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackLabel?: string;
}

export const ResilientImage: React.FC<ResilientImageProps> = ({
  src,
  alt,
  className = '',
  fallbackLabel,
}) => {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-[var(--line)] text-[var(--mute)] p-6 text-center select-none ${className}`}
        role="img"
        aria-label={alt}
      >
        <Sofa className="w-10 h-10 stroke-[1.5] text-[var(--accent)] mb-2" />
        <span className="font-display text-base text-[var(--ink)] font-bold line-clamp-1">
          {fallbackLabel || alt}
        </span>
        <span className="text-xs text-[var(--mute)] mt-0.5">PAGRA Showroom</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={className}
      loading="lazy"
    />
  );
};
