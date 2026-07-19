-- Migration 11: Fix handle_new_user trigger to prevent 500 errors on signup
-- The trigger was failing when email or username already existed in the usuarios table

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.usuarios (id, nome_de_usuario, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'nome_de_usuario', split_part(new.email, '@', 1)),
    new.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
