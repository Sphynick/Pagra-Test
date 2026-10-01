import React, { useState } from 'react';
import { CheckCircle2, Code2, Loader2, Phone, ShieldCheck, X } from 'lucide-react';
import { FurnitureItem } from '../types/catalog';
import { formatKES, getEffectivePrice, buildWhatsAppOrderUrl } from '../utils/whatsapp';
import {
  initiateMpesaStkPush,
  MpesaStkPushResponse,
  normalizeKenyanPhone,
} from '../services/mpesaService';
import { ResilientImage } from './ResilientImage';

interface MpesaModalProps {
  item: FurnitureItem | null;
  userEmail?: string | null;
  onClose: () => void;
}

export const MpesaModal: React.FC<MpesaModalProps> = ({ item, userEmail, onClose }) => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [customerName, setCustomerName] = useState(
    userEmail ? userEmail.split('@')[0] : ''
  );
  const [deliveryAddress, setDeliveryAddress] = useState('Nairobi, Kenya');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stkResult, setStkResult] = useState<MpesaStkPushResponse | null>(null);
  const [showPayload, setShowPayload] = useState(false);

  if (!item) return null;

  const effectivePrice = getEffectivePrice(item);

  const handleStkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerName.trim()) {
      setError('Please enter your full name for the delivery note.');
      return;
    }

    const phoneValidation = normalizeKenyanPhone(phoneNumber);
    if (!phoneValidation.valid) {
      setError(phoneValidation.error || 'Please enter a valid M-Pesa phone number.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await initiateMpesaStkPush(
        item,
        phoneNumber,
        customerName.trim(),
        deliveryAddress.trim()
      );
      setStkResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to initiate M-Pesa request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mpesa-modal-title"
    >
      <div className="relative w-full max-w-lg bg-[var(--card)] text-[var(--ink)] border-t sm:border border-[var(--line)] rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] sm:max-h-none flex flex-col">
        {/* Mobile Bottom-Sheet Drag Handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
          <div className="w-10 h-1.5 rounded-full bg-[var(--line)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[var(--line)] bg-[var(--card)]">
          <div>
            <p className="text-xs text-[var(--accent)] font-semibold">
              Lipa Na M-Pesa · STK Push Checkout
            </p>
            <h2 id="mpesa-modal-title" className="font-display text-2xl font-bold text-[var(--ink)]">
              Order via M-Pesa
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[var(--mute)] hover:text-[var(--ink)] rounded-full transition-colors cursor-pointer"
            aria-label="Close M-Pesa checkout modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          {/* Selected Item Summary */}
          <div className="flex items-center gap-4 p-3.5 bg-[var(--bg)] border border-[var(--line)] rounded-xl">
            <div className="w-20 h-16 rounded-lg overflow-hidden shrink-0 bg-[var(--line)]">
              <ResilientImage
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-[var(--mute)] truncate">
                {item.category} · {item.dimensions}
              </p>
              <h3 className="text-sm font-semibold text-[var(--ink)] truncate">{item.name}</h3>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span
                  className={`font-mono-tabular text-sm font-bold ${
                    item.isOnSale && item.salePrice < item.price
                      ? 'text-[var(--sale)]'
                      : 'text-[var(--ink)]'
                  }`}
                >
                  {formatKES(effectivePrice)}
                </span>
                {item.isOnSale && item.salePrice < item.price && (
                  <s className="font-mono-tabular text-xs text-[var(--mute)]">
                    {formatKES(item.price)}
                  </s>
                )}
              </div>
            </div>
          </div>

          {!stkResult ? (
            <form onSubmit={handleStkSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="mpesa-customer-name"
                  className="block text-xs font-semibold text-[var(--ink)] mb-1.5"
                >
                  Recipient Name
                </label>
                <input
                  id="mpesa-customer-name"
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. Wanjiku Kamau"
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              <div>
                <label
                  htmlFor="mpesa-phone"
                  className="block text-xs font-semibold text-[var(--ink)] mb-1.5"
                >
                  M-Pesa Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[var(--mute)] absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="mpesa-phone"
                    type="tel"
                    inputMode="tel"
                    required
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="0712 345 678"
                    className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 text-sm font-mono-tabular bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                  />
                </div>
                <p className="text-xs text-[var(--mute)] mt-1">
                  Check your phone for the M-Pesa PIN prompt of {formatKES(effectivePrice)}.
                </p>
              </div>

              <div>
                <label
                  htmlFor="mpesa-address"
                  className="block text-xs font-semibold text-[var(--ink)] mb-1.5"
                >
                  Delivery Location
                </label>
                <input
                  id="mpesa-address"
                  type="text"
                  required
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="e.g. Kilimani, Nairobi"
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-[var(--bg)] text-[var(--ink)] border border-[var(--line)] rounded-lg focus:outline-none focus:border-[var(--accent)]"
                />
              </div>

              {error && (
                <div className="p-3 bg-[var(--bg)] border border-[var(--sale)] rounded-lg text-xs text-[var(--sale)] font-medium">
                  {error}
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:flex-1 min-h-[48px] flex items-center justify-center gap-2 px-5 py-3 text-sm font-semibold text-[var(--on-accent)] bg-[var(--accent)] hover:opacity-95 disabled:opacity-60 rounded-lg transition-opacity whitespace-nowrap cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending payment request...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Send payment request ({formatKES(effectivePrice)})</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto min-h-[48px] px-4 py-2.5 text-sm font-semibold text-[var(--ink)] border border-[var(--ink)] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  Close
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-[var(--bg)] border border-[var(--accent)] rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-[var(--accent)] font-semibold text-sm">
                  <CheckCircle2 className="w-5 h-5 text-[var(--accent)] shrink-0" />
                  <span>Payment Request Prepared</span>
                </div>
                <p className="text-xs text-[var(--ink)] leading-relaxed">
                  {stkResult.CustomerMessage}
                </p>
                <div className="pt-2 border-t border-[var(--line)] text-xs text-[var(--mute)] font-mono-tabular space-y-1">
                  <div>Reference: {stkResult.payloadPreview.AccountReference}</div>
                  <div>CheckoutRequestID: {stkResult.CheckoutRequestID}</div>
                </div>
              </div>

              <div className="border border-[var(--line)] rounded-lg bg-[var(--bg)] overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowPayload((prev) => !prev)}
                  className="w-full min-h-[44px] flex items-center justify-between px-4 py-2.5 text-xs font-medium text-[var(--ink)] cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-[var(--mute)]" />
                    <span>Inspect Daraja STK Push Payload</span>
                  </span>
                  <span className="text-[var(--mute)]">{showPayload ? 'Hide' : 'Show'}</span>
                </button>
                {showPayload && (
                  <pre className="p-3.5 bg-black/90 text-emerald-100 text-[11px] font-mono-tabular overflow-x-auto leading-relaxed">
                    {JSON.stringify(stkResult.payloadPreview, null, 2)}
                  </pre>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                <a
                  href={buildWhatsAppOrderUrl(item)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:flex-1 min-h-[48px] flex items-center justify-center px-4 py-2.5 text-xs font-semibold text-white bg-[var(--wa)] rounded-lg transition-opacity whitespace-nowrap"
                >
                  Confirm on WhatsApp (0769504732)
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto min-h-[48px] px-5 py-2.5 text-xs font-semibold text-[var(--on-accent)] bg-[var(--accent)] rounded-lg transition-opacity whitespace-nowrap cursor-pointer"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
