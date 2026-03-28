// Phone number utilities

export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) {
    cleaned = cleaned.startsWith('0') ? '+263' + cleaned.substring(1) : '+263' + cleaned;
  }
  return cleaned;
}

export function formatPhoneForPayNow(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+263')) {
    cleaned = '0' + cleaned.substring(4);
  } else if (cleaned.startsWith('263')) {
    cleaned = '0' + cleaned.substring(3);
  }
  return cleaned;
}

export function formatPhoneDisplay(phone: string): string {
  // Format: +263 77 123 4567
  const cleaned = normalizePhone(phone);
  if (cleaned.length === 13) { // +263XXXXXXXXX
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 6)} ${cleaned.slice(6, 9)} ${cleaned.slice(9)}`;
  }
  return cleaned;
}

