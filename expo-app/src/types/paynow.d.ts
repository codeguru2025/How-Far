// Type declarations for paynow module
declare module 'paynow' {
  export class Paynow {
    constructor(integrationId: string, integrationKey: string);
    resultUrl: string;
    returnUrl: string;
    createPayment(reference: string, email: string): Payment;
    send(payment: Payment): Promise<InitResponse>;
    sendMobile(payment: Payment, phone: string, method: string): Promise<InitResponse>;
    pollTransaction(pollUrl: string): Promise<StatusResponse>;
  }

  export interface Payment {
    add(item: string, amount: number): void;
  }

  export interface InnbucksInfo {
    authorizationcode?: string;
    deep_link_url?: string;
    qr_code?: string;
    expires_at?: string;
  }

  export interface InitResponse {
    success: boolean;
    hasRedirect: boolean;
    error?: string;
    redirectUrl?: string;
    pollUrl?: string;
    instructions?: string;
    status?: string;
    isInnbucks?: boolean;
    innbucks_info?: InnbucksInfo[];
  }

  export interface StatusResponse {
    status?: string;
    paid?: boolean;
  }
}

