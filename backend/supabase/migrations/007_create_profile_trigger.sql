-- Create function to handle new user signup and create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
  v_base_username TEXT;
  v_exists INTEGER;
  v_suffix INTEGER := 1;
BEGIN
  -- Extract username from raw_user_meta_data or use email prefix
  v_base_username := COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1));
  v_username := v_base_username;

  -- Ensure username is unique
  SELECT COUNT(*) INTO v_exists FROM public.profiles WHERE username = v_username;
  WHILE v_exists > 0 LOOP
    v_username := v_base_username || v_suffix::TEXT;
    v_suffix := v_suffix + 1;
    SELECT COUNT(*) INTO v_exists FROM public.profiles WHERE username = v_username;
  END LOOP;

  -- Log for debugging
  RAISE NOTICE 'Creating profile - ID: %, Username: %, Email: %', 
    new.id, v_username, new.email;

  -- Insert new profile
  INSERT INTO public.profiles (id, username, email, name)
  VALUES (new.id, v_username, new.email, '')
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Profile created successfully for user: %', new.id;
  RETURN new;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating profile for user % with username %. Error: %', 
    new.id, v_username, SQLERRM;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO postgres, service_role;
