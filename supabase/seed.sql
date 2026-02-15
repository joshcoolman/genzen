-- Seed a confirmed test user: testuser@gmail.com / supa!1QAwsEDr
-- Key: confirmation_token, recovery_token, email_change_token_new, and email_change
-- must be set to '' (empty string), NOT omitted/NULL, or login will fail with
-- "Database error querying schema" (GoTruth can't scan NULL into Go string).
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  recovery_sent_at,
  last_sign_in_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  is_super_admin
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'testuser@gmail.com',
  crypt('supa!1QAwsEDrf', gen_salt('bf')),
  now(),
  now(),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  '',
  false
);

INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  created_at,
  updated_at,
  last_sign_in_at
)
SELECT
  id,
  id,
  json_build_object('sub', id, 'email', email),
  'email',
  id,
  now(),
  now(),
  now()
FROM auth.users
WHERE email = 'testuser@gmail.com';
