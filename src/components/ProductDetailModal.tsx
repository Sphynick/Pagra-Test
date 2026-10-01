import React from 'react';
import { MessageCircle, Smartphone, X } from 'lucide-react';
import { FurnitureItem } from '../types/catalog';
import {
  buildWhatsAppOrderUrl,
  formatKES,
  getEffectivePrice,
  PAGRA_WHATSAPP_DISPLAY,
} from '../utils/whatsapp';
import { ResilientImage } from './ResilientImage';

interface ProductDetailModalProps {
  item: FurnitureItem | null;
  onClose: () => void;
  onOrderMpesa: (item: FurnitureItem) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  item,
  onClose,
  onOrderMpesa,
}) => {
  if (!item) return null;

  const effectivePrice = getEffectivePrice(item);
  const isDiscounted = item.isOnSale && item.salePrice > 0 && item.salePrice < item.price;
  const savingsPercent = isDiscounted
    ? Math.round(((item.price - item.salePrice) / item.price) * 100)
    : 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdp-title"
    >
      <div className="relative w-full max-w-4xl bg-[var(--card)] text-[var(--ink)] border-t sm:border border-[var(--line)] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-none flex flex-col">
        {/* Mobile Bottom-Sheet Drag Handle */}
        <div className="sm:hidden pt-3 pb-1 bg-[var(--card)] flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-[var(--line)]" />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 min-h-[44px] min-w-[44px] flex items-center justify-center bg-[var(--card)]/95 text-[var(--ink)] rounded-full border border-[var(--line)] transition-colors cursor-pointer"
          aria-label="Close item details"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-12 overflow-y-auto">
          {/* Left Column: Product Imagery Gallery */}
          <div className="md:col-span-7 bg-[var(--bg)] flex flex-col justify-between">
            <div className="aspect-4/3 w-full overflow-hidden">
              <ResilientImage
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="px-5 py-3.5 border-t border-[var(--line)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--mute)] bg-[var(--card)]">
              <span>Dimensions: {item.dimensions}</span>
              <span aria-hidden="true">·</span>
              <span>Material: {item.material}</span>
            </div>
          </div>

          {/* Right Column: Contiguous Purchase Module */}
          <div className="md:col-span-5 p-5 sm:p-7 flex flex-col justify-between bg-[var(--card)]">
            <div className="space-y-4">
              {/* Unboxed Metadata */}
              <div className="flex items-center gap-2 text-xs text-[var(--mute)]">
                <span>{item.category}</span>
                {isDiscounted && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[var(--sale)] font-semibold">
                      {item.saleLabel || `On sale (${savingsPercent}% off)`}
                    </span>
                  </>
                )}
              </div>

              <h2
                id="pdp-title"
                className="font-display text-2xl sm:text-3xl font-bold text-[var(--ink)] leading-tight"
              >
                {item.name}
              </h2>

              {/* Price Block */}
              <div className="pt-1 pb-3 border-b border-[var(--line)]">
                <div className="flex items-baseline gap-3">
                  <span
                    className={`font-mono-tabular text-2xl font-bold ${
                      isDiscounted ? 'text-[var(--sale)]' : 'text-[var(--ink)]'
                    }`}
                  >
                    {formatKES(effectivePrice)}
                  </span>
                  {isDiscounted && (
                    <s className="font-mono-tabular text-sm text-[var(--mute)]">
                      {formatKES(item.price)}
                    </s>
                  )}
                </div>
                {isDiscounted && (
                  <p className="text-xs text-[var(--sale)] font-medium mt-1">
                    Save {formatKES(item.price - item.salePrice)} ({savingsPercent}% off normal price)
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <h3 className="text-xs font-semibold text-[var(--mute)]">
                  Description & Craftsmanship
                </h3>
                <p className="text-sm text-[var(--ink)] leading-relaxed whitespace-pre-line">
                  {item.description}
                </p>
              </div>

              {/* Specifications List */}
              <div className="pt-2 space-y-1.5 text-xs text-[var(--mute)] border-t border-[var(--line)]">
                <div className="flex justify-between py-1 gap-2">
                  <span>Upholstery & Frame</span>
                  <span className="font-medium text-[var(--ink)] text-right">{item.material}</span>
                </div>
                <div className="flex justify-between py-1 gap-2">
                  <span>Dimensions</span>
                  <span className="font-mono-tabular font-medium text-[var(--ink)] text-right">
                    {item.dimensions}
                  </span>
                </div>
                <div className="flex justify-between py-1 gap-2">
                  <span>Showroom Line</span>
                  <span className="font-mono-tabular font-medium text-[var(--ink)]">
                    {PAGRA_WHATSAPP_DISPLAY}
                  </span>
                </div>
              </div>
            </div>

            {/* Sticky / Thumb-Friendly Purchase Actions */}
            <div className="pt-5 mt-5 border-t border-[var(--line)] space-y-2.5">
              <a
                href={buildWhatsAppOrderUrl(item)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full min-h-[48px] flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-[var(--wa)] hover:opacity-95 rounded-lg transition-opacity whitespace-nowrap"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Chat on WhatsApp ({PAGRA_WHATSAPP_DISPLAY})</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOrderMpesa(item);
                }}
                className="w-full min-h-[48px] flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[var(--on-accent)] bg-[var(--accent)] hover:opacity-95 rounded-lg transition-opacity whitespace-nowrap cursor-pointer"
              >
                <Smartphone className="w-4 h-4" />
                <span>Order via M-Pesa ({formatKES(effectivePrice)})</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
