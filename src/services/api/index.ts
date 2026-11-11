import type {
  AppNotification, Area, AuditEntry, EscalationRule, Establishment, LiveOverview, Me, Page, QrCode, Report,
  RequestType, Role, ServiceRequest, ServiceRequestDetail, StaffMember, Table,
} from '@/contracts';
import { http, httpAuth } from '@/services/http';
import { setAccessToken } from '@/services/auth/auth-token';

/** Appels de l'espace personnel. Un fichier, une fonction par opération : les composants n'appellent jamais axios. */

type Tokens = { accessToken: string; expiresIn: number };
const est = (id: string) => `/establishments/${id}`;
const data = <T>(promise: Promise<{ data: T }>): Promise<T> => promise.then((response) => response.data);

export const authApi = {
  async login(body: { email: string; password: string }): Promise<void> {
    setAccessToken((await data(httpAuth.post<Tokens>('/auth/login', body))).accessToken);
  },
  async register(body: Record<string, string>): Promise<void> {
    setAccessToken((await data(httpAuth.post<Tokens>('/auth/register', body))).accessToken);
  },
  async logout(): Promise<void> {
    try {
      await httpAuth.post('/auth/logout');
    } finally {
      setAccessToken(null);
    }
  },
  me: () => data(http.get<Me>('/auth/me')),
  async changePassword(body: { currentPassword: string; newPassword: string }): Promise<void> {
    const response = await http.post<Tokens>('/auth/change-password', body, { withCredentials: true });
    setAccessToken(response.data.accessToken);
  },
};

export interface RequestFilters {
  scope?: 'active' | 'closed' | 'all';
  status?: string;
  areaId?: string;
  requestTypeId?: string;
  assigneeId?: string;
  late?: boolean;
  escalated?: boolean;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

const clean = (params: object) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== '' && value !== false));

export const requestsApi = {
  list: (e: string, filters: RequestFilters = {}) =>
    data(http.get<Page<ServiceRequest>>(`${est(e)}/requests`, { params: clean(filters) })),
  get: (e: string, id: string) => data(http.get<ServiceRequestDetail>(`${est(e)}/requests/${id}`)),
  create: (e: string, body: { tableId: string; requestTypeId: string; note?: string; takeIt?: boolean }) =>
    data(http.post<ServiceRequest>(`${est(e)}/requests`, body)),
  act: (e: string, id: string, action: RequestAction, body: object = {}) =>
    data(http.post<ServiceRequest>(`${est(e)}/requests/${id}/${action}`, body)),
};

export type RequestAction =
  | 'accept' | 'start' | 'resolve' | 'release' | 'transfer' | 'assign' | 'cancel' | 'acknowledge-escalation';

export const floorApi = {
  overview: (e: string) => data(http.get<Area[]>(`${est(e)}/floor`)),
  createArea: (e: string, body: { name: string }) => data(http.post(`${est(e)}/areas`, body)),
  updateArea: (e: string, id: string, body: { name?: string }) => data(http.patch(`${est(e)}/areas/${id}`, body)),
  archiveArea: (e: string, id: string) => data(http.delete(`${est(e)}/areas/${id}`)),
  createTable: (e: string, body: { areaId: string; label: string; seats: number }) =>
    data(http.post<Table>(`${est(e)}/tables`, body)),
  updateTable: (e: string, id: string, body: { areaId?: string; label?: string; seats?: number }) =>
    data(http.patch<Table>(`${est(e)}/tables/${id}`, body)),
  archiveTable: (e: string, id: string) => data(http.delete(`${est(e)}/tables/${id}`)),
  qrCodes: (e: string) => data(http.get<QrCode[]>(`${est(e)}/qr-codes`)),
  regenerateQr: (e: string, tableId: string) => data(http.post<QrCode>(`${est(e)}/tables/${tableId}/qr/regenerate`)),
  closeSessions: (e: string, tableId: string) =>
    data(http.post<{ closed: number }>(`${est(e)}/tables/${tableId}/sessions/close`)),
};

export const requestTypesApi = {
  list: (e: string) => data(http.get<RequestType[]>(`${est(e)}/request-types`)),
  create: (e: string, body: Omit<RequestType, 'id' | 'position'>) => data(http.post<RequestType>(`${est(e)}/request-types`, body)),
  update: (e: string, id: string, body: Partial<Omit<RequestType, 'id'>>) =>
    data(http.patch<RequestType>(`${est(e)}/request-types/${id}`, body)),
  archive: (e: string, id: string) => data(http.delete(`${est(e)}/request-types/${id}`)),
};

export const staffApi = {
  list: (e: string) => data(http.get<StaffMember[]>(`${est(e)}/staff`)),
  create: (e: string, body: { email: string; firstName: string; lastName: string; roleId: string; password: string }) =>
    data(http.post<StaffMember>(`${est(e)}/staff`, body)),
  update: (
    e: string,
    userId: string,
    body: { firstName?: string; lastName?: string; roleId?: string; status?: 'active' | 'disabled'; password?: string },
  ) => data(http.patch<StaffMember>(`${est(e)}/staff/${userId}`, body)),
  roles: (e: string) => data(http.get<Role[]>(`${est(e)}/roles`)),
  permissions: (e: string) => data(http.get<{ key: string; description: string }[]>(`${est(e)}/roles/permissions`)),
  createRole: (e: string, body: { name: string; permissions: string[] }) => data(http.post<Role>(`${est(e)}/roles`, body)),
  updateRole: (e: string, id: string, body: { name?: string; permissions?: string[] }) =>
    data(http.patch<Role>(`${est(e)}/roles/${id}`, body)),
  deleteRole: (e: string, id: string) => data(http.delete(`${est(e)}/roles/${id}`)),
};

export const escalationApi = {
  list: (e: string) => data(http.get<EscalationRule[]>(`${est(e)}/escalation-rules`)),
  create: (e: string, body: Omit<EscalationRule, 'id'>) => data(http.post<EscalationRule>(`${est(e)}/escalation-rules`, body)),
  update: (e: string, id: string, body: Partial<Omit<EscalationRule, 'id'>>) =>
    data(http.patch<EscalationRule>(`${est(e)}/escalation-rules/${id}`, body)),
  archive: (e: string, id: string) => data(http.delete(`${est(e)}/escalation-rules/${id}`)),
};

export const establishmentApi = {
  get: (e: string) => data(http.get<Establishment>(est(e))),
  update: (e: string, body: Partial<Omit<Establishment, 'id'>>) => data(http.patch<Establishment>(est(e), body)),
};

export const analyticsApi = {
  live: (e: string) => data(http.get<LiveOverview>(`${est(e)}/analytics/live`)),
  report: (e: string, params: { from: string; to: string; areaId?: string; assigneeId?: string }) =>
    data(http.get<Report>(`${est(e)}/analytics/report`, { params: clean(params) })),
};

export const notificationsApi = {
  list: (e: string) =>
    data(http.get<Page<AppNotification> & { unread: number }>(`${est(e)}/notifications`, { params: { pageSize: 20 } })),
  readAll: (e: string) => data(http.post(`${est(e)}/notifications/read-all`)),
};

export const auditApi = {
  list: (e: string, params: { page: number; action?: string }) =>
    data(http.get<Page<AuditEntry>>(`${est(e)}/audit-logs`, { params: clean({ ...params, pageSize: 30 }) })),
};
