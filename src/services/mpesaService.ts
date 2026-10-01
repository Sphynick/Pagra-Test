import { FurnitureItem } from '../types/catalog';
import { getEffectivePrice } from '../utils/whatsapp';

export interface MpesaStkPushRequest {
  phoneNumber: string;
  formattedPhoneE164: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  customerName: string;
  deliveryAddress: string;
  itemId: string;
  itemName: string;
}

export interface MpesaStkPushPayload {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  TransactionType: 'CustomerPayBillOnline';
  Amount: number;
  PartyA: string;
  PartyB: string;
  PhoneNumber: string;
  CallBackURL: string;
  AccountReference: string;
  TransactionDesc: string;
}

export interface MpesaStkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: '0';
  ResponseDescription: string;
  CustomerMessage: string;
  payloadPreview: MpesaStkPushPayload;
}

/**
 * Normalizes a Kenyan phone number (e.g. 0769504732, +254769504732, 0110...)
 * to the 2547XXXXXXXX / 2541XXXXXXXX format required by Safaricom Daraja STK Push API.
 */
export function normalizeKenyanPhone(rawPhone: string): {
  valid: boolean;
  formatted: string;
  error?: string;
} {
  const digits = rawPhone.replace(/\s+/g, '').replace(/^\+/, '');
  if (/^0[17]\d{8}$/.test(digits)) {
    return { valid: true, formatted: `254${digits.slice(1)}` };
  }
  if (/^254[17]\d{8}$/.test(digits)) {
    return { valid: true, formatted: digits };
  }
  return {
    valid: false,
    formatted: digits,
    error: 'Enter a valid Kenyan M-Pesa number (e.g., 0712345678 or 254712345678).',
  };
}

/**
 * Modular M-Pesa Daraja Express (STK Push) integration service.
 * Ready for backend endpoint activation (`POST /api/mpesa/stkpush` or Cloud Function).
 */
export async function initiateMpesaStkPush(
  item: FurnitureItem,
  customerPhone: string,
  customerName: string,
  deliveryAddress: string
): Promise<MpesaStkPushResponse> {
  const phoneCheck = normalizeKenyanPhone(customerPhone);
  if (!phoneCheck.valid) {
    throw new Error(phoneCheck.error || 'Invalid M-Pesa phone number.');
  }

  const amount = Math.round(getEffectivePrice(item));
  const now = new Date();
  const timestamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');

  const shortCode = '174379'; // Standard Daraja Lipa Na M-Pesa Sandbox ShortCode
  const accountReference = `PAGRA-${item.id.slice(0, 8).toUpperCase()}`;

  const darajaPayload: MpesaStkPushPayload = {
    BusinessShortCode: shortCode,
    Password: btoa(`${shortCode}bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919${timestamp}`),
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: amount,
    PartyA: phoneCheck.formatted,
    PartyB: shortCode,
    PhoneNumber: phoneCheck.formatted,
    CallBackURL: 'https://api.pagrafurniture.co.ke/mpesa/callback',
    AccountReference: accountReference,
    TransactionDesc: `PAGRA Order: ${item.name.slice(0, 24)}`,
  };

  // Simulate network roundtrip for the modular STK Push placeholder
  await new Promise((resolve) => setTimeout(resolve, 1100));

  return {
    MerchantRequestID: `PAGRA-${Date.now().toString().slice(-6)}`,
    CheckoutRequestID: `ws_CO_${timestamp}${Math.floor(100000 + Math.random() * 900000)}`,
    ResponseCode: '0',
    ResponseDescription: 'Success. Request accepted for processing',
    CustomerMessage: `Success. An M-Pesa STK Push prompt for KES ${amount.toLocaleString('en-KE')} has been queued for ${phoneCheck.formatted}.`,
    payloadPreview: darajaPayload,
  };
}
