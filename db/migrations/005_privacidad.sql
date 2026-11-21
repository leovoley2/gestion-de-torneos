-- Consentimiento de la Política de privacidad (Ley 29733).
-- privacy_version: versión aceptada (lib/legal.ts POLICY_VERSION); null = aún no la aceptó.
-- guardian_consent_at: autorización del padre, madre o apoderado para menores de 14 años.
alter table athletes
  add column privacy_accepted_at timestamptz,
  add column privacy_version text,
  add column guardian_consent_at timestamptz;
