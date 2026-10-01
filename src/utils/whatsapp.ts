import { FurnitureItem } from '../types/catalog';

export const PAGRA_WHATSAPP_DISPLAY = '0769504732';
// International E.164 format for Kenyan number 0769504732 used by wa.me links
export const PAGRA_WHATSAPP_E164 = '254769504732';

export function formatKES(amount: number): string {
  return `KES ${Math.round(amount).toLocaleString('en-KE')}`;
}

export function getEffectivePrice(item: FurnitureItem): number {
  if (item.isOnSale && item.salePrice > 0 && item.salePrice < item.price) {
    return item.salePrice;
  }
  return item.price;
}

/**
 * Generates a WhatsApp Web / App deep link pre-filled with a message to 0769504732
 * containing the item's specific name, price, and description.
 */
export function buildWhatsAppOrderUrl(item: FurnitureItem): string {
  const effectivePrice = getEffectivePrice(item);
  const priceLine =
    item.isOnSale && item.salePrice < item.price
      ? `${formatKES(effectivePrice)} (On Sale — Regular ${formatKES(item.price)})`
      : formatKES(effectivePrice);

  const message = [
    `Hello PAGRA (0769504732), I would like to inquire about ordering this furniture piece:`,
    ``,
    `• Item Name: ${item.name}`,
    `• Category: ${item.category}`,
    `• Price: ${priceLine}`,
    `• Dimensions: ${item.dimensions}`,
    `• Description: ${item.description}`,
    ``,
    `Please let me know availability and delivery timelines.`,
  ].join('\n');

  return `https://wa.me/${PAGRA_WHATSAPP_E164}?text=${encodeURIComponent(message)}`;
}
