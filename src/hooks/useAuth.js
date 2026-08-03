import { useAuth as useClerkAuth, useUser } from "@clerk/nextjs";

export function useAuth() {
  const { isLoaded: authLoaded, userId, signOut } = useClerkAuth();
  const { isLoaded: userLoaded, user } = useUser();

  const loading = !authLoaded || !userLoaded;

  return {
    session: userId ? {} : null,
    user: user ? { id: userId, email: user.primaryEmailAddress?.emailAddress, ...user } : null,
    loading,
    error: null,
    signOut,
  };
}
