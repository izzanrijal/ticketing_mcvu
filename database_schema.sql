-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.admin_profiles (
  id uuid NOT NULL,
  full_name character varying NOT NULL,
  email character varying NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT admin_profiles_pkey PRIMARY KEY (id)
);
CREATE TABLE public.bank_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  account_holder_name text NOT NULL,
  account_number text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT bank_accounts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.check_ins (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  registration_item_id uuid NOT NULL,
  workshop_id uuid,
  checked_in_by uuid,
  checked_in_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT check_ins_pkey PRIMARY KEY (id),
  CONSTRAINT check_ins_checked_in_by_fkey FOREIGN KEY (checked_in_by) REFERENCES public.admin_profiles(id),
  CONSTRAINT check_ins_registration_item_id_fkey FOREIGN KEY (registration_item_id) REFERENCES public.registration_items(id),
  CONSTRAINT check_ins_workshop_id_fkey FOREIGN KEY (workshop_id) REFERENCES public.workshops(id)
);
CREATE TABLE public.contact_persons (
  registration_id uuid,
  name text,
  email text,
  phone text,
  uuid uuid NOT NULL DEFAULT gen_random_uuid(),
  registration_number character varying,
  CONSTRAINT contact_persons_pkey PRIMARY KEY (uuid),
  CONSTRAINT contact_persons_registration_number_fkey FOREIGN KEY (registration_number) REFERENCES public.registrations(registration_number),
  CONSTRAINT contact_persons_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registrations(id)
);
CREATE TABLE public.cron_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  job_name character varying NOT NULL,
  result jsonb,
  error text,
  execution_time interval,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT cron_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.event_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  event_year integer NOT NULL,
  event_name character varying NOT NULL,
  registration_opens_at timestamp with time zone,
  registration_closes_at timestamp with time zone,
  symposium_max_capacity integer DEFAULT 1000,
  bank_account_details jsonb,
  contact_email character varying,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT event_config_pkey PRIMARY KEY (id)
);
CREATE TABLE public.participant_qr_codes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  participant_id uuid NOT NULL,
  registration_id uuid NOT NULL,
  qr_code_id text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  qr_code_url text,
  CONSTRAINT participant_qr_codes_pkey PRIMARY KEY (id),
  CONSTRAINT participant_qr_codes_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(id),
  CONSTRAINT participant_qr_codes_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registrations(id)
);
CREATE TABLE public.participant_workshops (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL,
  workshop_id uuid NOT NULL,
  registration_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  status text DEFAULT 'pending'::text,
  CONSTRAINT participant_workshops_pkey PRIMARY KEY (id),
  CONSTRAINT participant_workshops_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registrations(id),
  CONSTRAINT participant_workshops_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(id),
  CONSTRAINT participant_workshops_workshop_id_fkey FOREIGN KEY (workshop_id) REFERENCES public.workshops(id)
);
CREATE TABLE public.participants (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  full_name character varying NOT NULL,
  email character varying NOT NULL,
  phone character varying,
  participant_type character varying NOT NULL,
  institution character varying,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  nik character varying NOT NULL DEFAULT ''::character varying,
  registration_id uuid,
  ewaco_interest boolean DEFAULT false,
  CONSTRAINT participants_pkey PRIMARY KEY (id),
  CONSTRAINT participants_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registrations(id)
);
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  payment_method character varying NOT NULL,
  payment_date timestamp with time zone,
  amount integer NOT NULL,
  payment_proof_url text,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying::text, 'verified'::character varying::text, 'rejected'::character varying::text])),
  verified_by uuid,
  verified_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  registration_id uuid NOT NULL,
  check_attempts integer DEFAULT 0,
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_verified_by_fkey FOREIGN KEY (verified_by) REFERENCES public.admin_profiles(id),
  CONSTRAINT payments_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registrations(id)
);
CREATE TABLE public.promo_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code character varying NOT NULL UNIQUE,
  discount_type character varying NOT NULL CHECK (discount_type::text = ANY (ARRAY['percentage'::character varying::text, 'fixed'::character varying::text])),
  discount_value real NOT NULL,
  participant_type character varying,
  valid_from timestamp with time zone,
  valid_until timestamp with time zone,
  max_uses integer,
  used_count integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  promo_logic_type text,
  eligible_categories ARRAY,
  CONSTRAINT promo_codes_pkey PRIMARY KEY (id)
);
CREATE TABLE public.purchase_details (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  registration_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  item_type character varying NOT NULL,
  item_id uuid,
  item_name character varying NOT NULL,
  item_price numeric NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT purchase_details_pkey PRIMARY KEY (id),
  CONSTRAINT purchase_details_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(id),
  CONSTRAINT purchase_details_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registrations(id)
);
CREATE TABLE public.registration_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_registration_id uuid NOT NULL,
  participant_id uuid NOT NULL,
  ticket_id uuid,
  amount integer NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  registration_id uuid NOT NULL,
  CONSTRAINT registration_items_pkey PRIMARY KEY (id),
  CONSTRAINT registration_items_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registrations(id),
  CONSTRAINT registration_items_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(id),
  CONSTRAINT registration_items_parent_registration_id_fkey FOREIGN KEY (parent_registration_id) REFERENCES public.registrations(id)
);
CREATE TABLE public.registrations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  registration_number character varying NOT NULL UNIQUE,
  registration_date timestamp with time zone DEFAULT now(),
  total_amount integer NOT NULL,
  discount_amount integer DEFAULT 0,
  final_amount integer NOT NULL UNIQUE,
  promo_code_id uuid,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying::text, 'paid'::character varying::text, 'cancelled'::character varying::text])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  notes text,
  ticket_id uuid,
  participant_ids ARRAY DEFAULT '{}'::uuid[],
  sponsor_letter_url text,
  sponsor_letter_path text,
  order_details jsonb,
  unique_code integer,
  CONSTRAINT registrations_pkey PRIMARY KEY (id),
  CONSTRAINT fk_ticket FOREIGN KEY (ticket_id) REFERENCES public.tickets(id),
  CONSTRAINT registrations_promo_code_id_fkey FOREIGN KEY (promo_code_id) REFERENCES public.promo_codes(id)
);
CREATE TABLE public.scheduled_tasks (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  task_type text NOT NULL,
  registration_id uuid,
  scheduled_at timestamp with time zone NOT NULL,
  status text NOT NULL DEFAULT 'pending'::text,
  started_at timestamp with time zone,
  completed_at timestamp with time zone,
  result jsonb,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT scheduled_tasks_pkey PRIMARY KEY (id),
  CONSTRAINT scheduled_tasks_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registrations(id)
);
CREATE TABLE public.tickets (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  name character varying NOT NULL,
  description text,
  price_specialist_doctor integer NOT NULL,
  price_general_doctor integer NOT NULL,
  price_nurse integer NOT NULL,
  price_student integer NOT NULL,
  price_other integer NOT NULL,
  includes_symposium boolean DEFAULT true,
  location character varying,
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT tickets_pkey PRIMARY KEY (id)
);
CREATE TABLE public.transaction_mutations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  moota_mutation_id character varying NOT NULL UNIQUE,
  bank_id character varying NOT NULL,
  account_number character varying NOT NULL,
  amount numeric NOT NULL,
  description text,
  type character varying NOT NULL,
  transaction_date timestamp without time zone NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  status character varying DEFAULT 'unprocessed'::character varying,
  registration_id uuid,
  payment_id uuid,
  notes text,
  raw_data jsonb,
  CONSTRAINT transaction_mutations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.webhook_logs (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  provider character varying NOT NULL,
  event_type character varying NOT NULL,
  payload jsonb NOT NULL,
  signature text,
  processed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT webhook_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.workshop_registrations (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  participant_id uuid NOT NULL,
  workshop_id uuid NOT NULL,
  registration_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT workshop_registrations_pkey PRIMARY KEY (id),
  CONSTRAINT workshop_registrations_registration_id_fkey FOREIGN KEY (registration_id) REFERENCES public.registrations(id),
  CONSTRAINT workshop_registrations_workshop_id_fkey FOREIGN KEY (workshop_id) REFERENCES public.workshops(id),
  CONSTRAINT workshop_registrations_participant_id_fkey FOREIGN KEY (participant_id) REFERENCES public.participants(id)
);
CREATE TABLE public.workshops (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  title character varying NOT NULL,
  description text,
  start_time timestamp with time zone,
  end_time timestamp with time zone,
  location character varying,
  price integer NOT NULL DEFAULT 0,
  max_capacity integer DEFAULT 50,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT workshops_pkey PRIMARY KEY (id)
);