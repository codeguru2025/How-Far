// PayNow API operations
import { Paynow } from 'paynow';
import { CONFIG } from '../config';
import { PayNowResponse, PaymentMethod } from '../types';
import { formatPhoneForPayNow } from '../utils/phone';

export async function initiatePayment(params: {
  amount: number;
  phone: string;
  reference: string;
  paymentMethod: PaymentMethod;
}): Promise<PayNowResponse> {
  const { amount, phone, reference, paymentMethod } = params;
  const formattedPhone = formatPhoneForPayNow(phone);

  try {
    const paynow = new Paynow(CONFIG.PAYNOW_ID, CONFIG.PAYNOW_KEY);
    paynow.resultUrl = `${CONFIG.SUPABASE_URL}/functions/v1/paynowWebhook`;
    paynow.returnUrl = 'https://www.google.com';

    const customerEmail = `user${formattedPhone.replace(/[^0-9]/g, '')}@gmail.com`;
    const payment = paynow.createPayment(reference, customerEmail);
    payment.add('Wallet Top-up', amount);

    let response;
    if (paymentMethod === 'ecocash') {
      response = await paynow.sendMobile(payment, formattedPhone, 'ecocash');
    } else if (paymentMethod === 'onemoney') {
      response = await paynow.sendMobile(payment, formattedPhone, 'onemoney');
    } else if (paymentMethod === 'innbucks') {
      response = await paynow.sendMobile(payment, formattedPhone, 'innbucks');
    } else {
      response = await paynow.send(payment);
    }

    if (response.success || response.status === 'ok') {
      let innbucksCode = null;
      let innbucksDeepLink = null;
      let innbucksQR = null;
      let innbucksExpiry = null;

      if (response.isInnbucks && response.innbucks_info && response.innbucks_info.length > 0) {
        const innbucksData = response.innbucks_info[0];
        innbucksCode = innbucksData.authorizationcode;
        innbucksDeepLink = innbucksData.deep_link_url;
        innbucksQR = innbucksData.qr_code;
        innbucksExpiry = innbucksData.expires_at;
      }

      return {
        success: true,
        browserUrl: response.redirectUrl,
        pollUrl: response.pollUrl,
        instructions: response.instructions,
        innbucksCode,
        innbucksDeepLink,
        innbucksQR,
        innbucksExpiry,
        isInnbucks: response.isInnbucks,
      };
    }

    return { success: false, error: response.error || 'Payment failed' };
  } catch (error: any) {
    if (__DEV__) console.error('PayNow Error:', error.message);
    return { success: false, error: error.message || 'PayNow error' };
  }
}

export async function pollPayment(pollUrl: string): Promise<{ paid: boolean; status: string }> {
  try {
    const paynow = new Paynow(CONFIG.PAYNOW_ID, CONFIG.PAYNOW_KEY);
    const status = await paynow.pollTransaction(pollUrl);
    const isPaid = status.paid || status.status?.toLowerCase() === 'paid';
    return { paid: isPaid, status: status.status || 'unknown' };
  } catch (e) {
    return { paid: false, status: 'error' };
  }
}

