import type {
  Appointment,
  Call,
  CallKind,
  PanelState,
  Room,
  RoomKind,
  TenantProfile,
  TokenResponse,
  User,
} from "@/types/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api";

type ApiOptions = {
  token?: string | null;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  options: ApiOptions = {},
): Promise<T> {
  const headers = new Headers(init.headers);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const body = (await response.json().catch(() => null)) as
    | { detail?: string }
    | T
    | null;

  if (!response.ok) {
    const fallback = `Erro HTTP ${response.status}`;
    const detail =
      body && typeof body === "object" && "detail" in body
        ? body.detail
        : fallback;
    throw new ApiError(response.status, detail ?? fallback);
  }

  return body as T;
}

export function login(username: string, password: string): Promise<TokenResponse> {
  return request<TokenResponse>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export function logout(token: string): Promise<void> {
  return request<void>("/v1/auth/logout", { method: "POST" }, { token });
}

export function getMe(token: string): Promise<User> {
  return request<User>("/v1/auth/me", {}, { token });
}

export function getTenantProfile(): Promise<TenantProfile> {
  return request<TenantProfile>("/v1/tenant/profile");
}

export function updateTenantProfile(
  token: string,
  profile: Omit<TenantProfile, "id">,
): Promise<TenantProfile> {
  return request<TenantProfile>(
    "/v1/tenant/profile",
    { method: "PUT", body: JSON.stringify(profile) },
    { token },
  );
}

export function listRooms(token?: string | null): Promise<Room[]> {
  return request<Room[]>("/v1/rooms", {}, { token });
}

export function createRoom(
  token: string,
  room: {
    code: string;
    name: string;
    display_name: string;
    kind: RoomKind;
    is_active: boolean;
    sort_order: number;
  },
): Promise<Room> {
  return request<Room>(
    "/v1/rooms",
    { method: "POST", body: JSON.stringify(room) },
    { token },
  );
}

export function listAppointments(token: string): Promise<Appointment[]> {
  return request<Appointment[]>("/v1/appointments", {}, { token });
}

export function createAppointment(
  token: string,
  appointment: {
    patient_name: string;
    patient_document?: string | null;
    scheduled_for: string;
    requires_triage: boolean;
  },
): Promise<Appointment> {
  return request<Appointment>(
    "/v1/appointments",
    { method: "POST", body: JSON.stringify(appointment) },
    { token },
  );
}

export function completeTriage(
  token: string,
  appointmentId: number,
  notes: string,
): Promise<Appointment> {
  return request<Appointment>(
    `/v1/triage/${appointmentId}/complete`,
    { method: "POST", body: JSON.stringify({ notes: notes || null }) },
    { token },
  );
}

export function listCalls(token: string): Promise<Call[]> {
  return request<Call[]>("/v1/calls", {}, { token });
}

export function createCall(
  token: string,
  call: {
    appointment_id: number;
    room_id: number | null;
    kind: CallKind;
    message?: string | null;
    notes?: string | null;
  },
): Promise<Call> {
  return request<Call>(
    "/v1/calls",
    { method: "POST", body: JSON.stringify(call) },
    { token },
  );
}

export function startCall(token: string, callId: number): Promise<Call> {
  return request<Call>(`/v1/calls/${callId}/start`, { method: "POST" }, { token });
}

export function finishCall(token: string, callId: number): Promise<Call> {
  return request<Call>(
    `/v1/calls/${callId}/finish`,
    { method: "POST", body: JSON.stringify({ patient_attended: true }) },
    { token },
  );
}

export function cancelCall(token: string, callId: number): Promise<Call> {
  return request<Call>(`/v1/calls/${callId}/cancel`, { method: "POST" }, { token });
}

export function getPanelState(): Promise<PanelState> {
  return request<PanelState>("/v1/panel/state");
}
