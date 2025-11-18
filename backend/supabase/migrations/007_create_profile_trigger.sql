-- Create function to handle new user signup and create profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_username TEXT;
BEGIN
  -- Extract username from raw_user_meta_data
  v_username := new.raw_user_meta_data->>'username';
  
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
