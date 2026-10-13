export const CREDIT_COSTS = {
  preview: 0,
  post: 1,
  video: 10,
  lora_training: 50,
} as const;

export type CreditKind = keyof typeof CREDIT_COSTS;

export type CreditReason =
  | "grant"
  | "generation_debit"
  | "generation_refund"
  | "adjustment"
  | "stripe_subscription_grant"
  | "stripe_pack_grant"
  | "stripe_refund_clawback"
  | "stripe_dispute_clawback";

export function canAfford(balance: number, cost: number, enforced: boolean): boolean {
  if (!enforced) return true;
  return balance >= cost;
}

export function debitKey(jobId: string): string {
  return `job:${jobId}:debit`;
}

export function refundKey(jobId: string): string {
  return `job:${jobId}:refund`;
}

export function signupGrantKey(userId: string): string {
  return `grant:signup:${userId}`;
}

export function stripeCheckoutGrantKey(sessionId: string): string {
  return `stripe:checkout:${sessionId}`;
}

export function stripeInvoiceGrantKey(invoiceId: string): string {
  return `stripe:invoice:${invoiceId}`;
}

export function stripePackGrantKey(sessionId: string): string {
  return `stripe:pack:${sessionId}`;
}

export function stripeRefundKey(refundId: string): string {
  return `stripe:refund:${refundId}`;
}

export function stripeDisputeKey(disputeId: string): string {
  return `stripe:dispute:${disputeId}`;
}
