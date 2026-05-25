export type UserRole = "admin" | "operator" | "doctor" | "triage";

export type User = {
  id: number;
  username: string;
  display_name: string;
  role: UserRole;
  is_active: boolean;
  permissions?: string[];
};

export type TenantProfile = {
  id: number | null;
  trade_name: string;
  legal_name: string | null;
  document: string | null;
  email: string | null;
  phone: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  logo_url: string | null;
  primary_color: string | null;
  timezone: string;
  is_active: boolean;
};

export type TokenResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
};

export type RoomKind = "office" | "triage" | "reception";

export type Room = {
  id: number;
  code: string;
  name: string;
  display_name: string;
  kind: RoomKind;
  is_active: boolean;
  sort_order: number;
};

export type AppointmentStatus =
  | "waiting"
  | "called"
  | "in_service"
  | "completed"
  | "cancelled"
  | "no_show";

export type Appointment = {
  id: number;
  patient_name: string;
  patient_document: string | null;
  scheduled_for: string;
  status: AppointmentStatus;
  requires_triage: boolean;
  external_source: string | null;
  external_id: string | null;
};

export type CallKind = "doctor" | "triage" | "administrative";

export type CallStatus =
  | "waiting"
  | "called"
  | "in_service"
  | "completed"
  | "no_show"
  | "cancelled";

export type Call = {
  id: number;
  appointment_id: number;
  room_id: number | null;
  called_by_user_id: number | null;
  status: CallStatus;
  kind: CallKind;
  sequence_number: number;
  message: string | null;
  called_at: string;
  started_at: string | null;
  finished_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
};

export type PanelState = {
  active_calls: Call[];
  recent_calls: Call[];
};

export type PanelCall = Pick<
  Call,
  | "id"
  | "appointment_id"
  | "room_id"
  | "status"
  | "kind"
  | "sequence_number"
  | "message"
  | "called_at"
> & {
  _source_id?: string;
};

export type PanelEvent = {
  version: number;
  type: "call.created" | "call.started" | "call.finished" | "call.cancelled";
  occurred_at: string;
  payload: PanelCall;
};
