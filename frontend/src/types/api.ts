export type UserRole = "admin" | "operator" | "doctor" | "triage";

export type User = {
  id: number;
  username: string;
  display_name: string;
  role: UserRole;
  is_active: boolean;
  permissions?: string[];
};

export type Pagination = {
  limit: number;
  offset: number;
  total: number;
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

export type PatientSex = "female" | "male" | "other" | "not_informed";

export type Patient = {
  id: number;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  sex: PatientSex;
  email: string | null;
  phone: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  notes: string | null;
  is_active: boolean;
};

export type PatientPayload = {
  full_name: string;
  cpf?: string | null;
  birth_date?: string | null;
  sex: PatientSex;
  email?: string | null;
  phone?: string | null;
  address_line?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  notes?: string | null;
  is_active: boolean;
};

export type PatientListResponse = {
  data: Patient[];
  pagination: Pagination;
};

export type ClinicalRecordStatus = "draft" | "finished";

export type ClinicalRecord = {
  id: number;
  patient_id: number | null;
  appointment_id: number | null;
  patient_name: string;
  patient_document: string | null;
  status: ClinicalRecordStatus;
  started_at: string;
  finished_at: string | null;
  chief_complaint: string | null;
  history: string | null;
  physical_exam: string | null;
  diagnosis: string | null;
  conduct: string | null;
  notes: string | null;
};

export type ClinicalRecordPayload = {
  patient_id?: number | null;
  appointment_id?: number | null;
  patient_name?: string | null;
  patient_document?: string | null;
  started_at?: string | null;
  chief_complaint?: string | null;
  history?: string | null;
  physical_exam?: string | null;
  diagnosis?: string | null;
  conduct?: string | null;
  notes?: string | null;
};

export type ClinicalRecordListResponse = {
  data: ClinicalRecord[];
  pagination: Pagination;
};

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
  patient_id: number | null;
  patient_name: string;
  patient_document: string | null;
  scheduled_for: string;
  status: AppointmentStatus;
  requires_triage: boolean;
  external_source: string | null;
  external_id: string | null;
};

export type PrescriptionKind = "simple" | "special_control" | "antimicrobial";
export type PrescriptionStatus = "active" | "cancelled" | "dispensed";

export type PrescriptionItemPayload = {
  medication_name: string;
  dosage?: string | null;
  route?: string | null;
  frequency?: string | null;
  duration?: string | null;
  quantity?: string | null;
  unit_price?: string | null;
  instructions?: string | null;
};

export type PrescriptionPayload = {
  patient_id?: number | null;
  clinical_record_id?: number | null;
  patient_name?: string | null;
  patient_document?: string | null;
  kind: PrescriptionKind;
  instructions?: string | null;
  notes?: string | null;
  items: PrescriptionItemPayload[];
};

export type PrescriptionItem = PrescriptionItemPayload & {
  id: number;
  prescription_id: number;
};

export type Prescription = {
  id: number;
  patient_id: number | null;
  clinical_record_id: number | null;
  patient_name: string;
  patient_document: string | null;
  kind: PrescriptionKind;
  status: PrescriptionStatus;
  issued_at: string;
  valid_until: string;
  instructions: string | null;
  notes: string | null;
  cancelled_reason: string | null;
  items: PrescriptionItem[];
};

export type ExamRequestStatus = "pending" | "billed" | "external" | "cancelled";

export type ExamRequestItemPayload = {
  exam_name: string;
  exam_code?: string | null;
  exam_type?: string | null;
  unit_price: string;
  sort_order?: number;
};

export type ExamRequestPayload = {
  patient_id?: number | null;
  clinical_record_id?: number | null;
  patient_name?: string | null;
  patient_document?: string | null;
  status: ExamRequestStatus;
  discount_amount: string;
  notes?: string | null;
  items: ExamRequestItemPayload[];
};

export type ExamRequestItem = ExamRequestItemPayload & {
  id: number;
  exam_request_id: number;
  sort_order: number;
};

export type ExamRequest = {
  id: number;
  patient_id: number | null;
  clinical_record_id: number | null;
  patient_name: string;
  patient_document: string | null;
  requested_at: string;
  status: ExamRequestStatus;
  subtotal_amount: string;
  discount_amount: string;
  total_amount: string;
  notes: string | null;
  cancelled_reason: string | null;
  items: ExamRequestItem[];
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
