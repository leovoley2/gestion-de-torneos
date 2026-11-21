-- Pagos de inscripción: monto por categoría, instrucciones por torneo (Yape, cuenta…) y, en cada
-- inscripción, el comprobante que sube el atleta y la confirmación de la organización.
alter table tournaments add column payment_instructions text;
alter table categories add column registration_fee numeric(10, 2) check (registration_fee is null or registration_fee >= 0);
alter table registrations
  add column payment_file_key text,       -- ruta privada del comprobante (nunca sale al navegador)
  add column payment_file_name text,
  add column payment_file_type text,
  add column payment_uploaded_at timestamptz,
  add column paid_at timestamptz,         -- la organización confirmó el pago
  add column paid_by uuid references admins(id) on delete set null;
