import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { supabase } from "../utils/supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        setProfile(null);
        return null;
      }
      setProfile(data);
      return data;
    } catch (err) {
      console.error("Profile fetch failed:", err);
      setProfile(null);
      return null;
    }
  };

  const handleSession = useCallback(async (session) => {
    if (session?.user) {
      setUser(session.user);
      setLoading(false);
      fetchProfile(session.user.id);
    } else {
      setUser(null);
      setProfile(null);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const applySession = () => {
      if (!mounted) return;
      supabase.auth
        .getSession()
        .then(({ data: { session }, error }) => {
          if (!mounted) return;
          if (error) {
            console.error("getSession error:", error);
            setUser(null);
            setProfile(null);
          } else {
            handleSession(session);
          }
        })
        .catch((err) => {
          if (!mounted) return;
          console.error("Auth init error:", err);
          setUser(null);
          setProfile(null);
          setLoading(false);
        });
    };

    applySession();

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange(() => {
      if (!mounted) return;
      setLoading(true);
      // Use getSession() as source of truth so a stale null callback doesn't overwrite a valid session
      applySession();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [handleSession]);

  const value = {
    user,
    profile,
    role: profile?.role ?? null,
    employee_id: profile?.employee_id ?? null,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
