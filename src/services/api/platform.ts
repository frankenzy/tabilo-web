import type { PaymentMethod, PlanKey, PlatformTenantDetail, PlatformTenantRow, Receipt } from '@/contracts';
import { httpPlatform } from '@/services/http';

/** Spec 036 et 037 : appels de la console de la plateforme. */
const data = <T>(promise: Promise<{ data: T }>): Promise<T> => promise.then((response) => response.data);

export interface PlatformAdmin {
  id: string;
  name: string;
  email: string;
}

export const platformApi = {
  login: (email: string, password: string) => data(httpPlatform.post<{ admin: PlatformAdmin }>('/platform/auth/login', { email, password })),
  logout: () => httpPlatform.post('/platform/auth/logout'),
  me: () => data(httpPlatform.get<PlatformAdmin>('/platform/me')),
  tenants: (query: { state?: string; q?: string }) => data(httpPlatform.get<PlatformTenantRow[]>('/platform/tenants', { params: query })),
  tenant: (id: string) => data(httpPlatform.get<PlatformTenantDetail>(`/platform/tenants/${id}`)),
  changePlan: (id: string, plan: PlanKey) => data(httpPlatform.post<PlatformTenantDetail>(`/platform/tenants/${id}/plan`, { plan })),
  extend: (id: string, days: number, reason?: string) => data(httpPlatform.post<PlatformTenantDetail>(`/platform/tenants/${id}/extend`, { days, reason })),
  suspend: (id: string, reason: string) => data(httpPlatform.post<PlatformTenantDetail>(`/platform/tenants/${id}/suspend`, { reason })),
  reactivate: (id: string, reason: string) => data(httpPlatform.post<PlatformTenantDetail>(`/platform/tenants/${id}/reactivate`, { reason })),
  resetLink: (id: string, userId: string) =>
    data(httpPlatform.post<{ url: string; expiresAt: string; email: string }>(`/platform/tenants/${id}/owners/${userId}/reset-link`)),
  recordPayment: (id: string, body: { amountMinor: number; method: PaymentMethod; reference?: string; months: number; plan: PlanKey }) =>
    data(httpPlatform.post<Receipt>(`/platform/tenants/${id}/payments`, body)),
  /** Spec 041, R4 et R5 : fermer un compte (effacé à la fin du délai), le rétablir. */
  close: (id: string, body: { confirmName: string; reason: string; days: number }) => data(httpPlatform.post<PlatformTenantDetail>(`/platform/tenants/${id}/close`, body)),
  restore: (id: string, reason: string) => data(httpPlatform.post<PlatformTenantDetail>(`/platform/tenants/${id}/restore`, { reason })),
  cancelPayment: (paymentId: string, reason: string) => data(httpPlatform.post<Receipt>(`/platform/payments/${paymentId}/cancel`, { reason })),
};
