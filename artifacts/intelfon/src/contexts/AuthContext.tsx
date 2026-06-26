import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Usuario } from "@workspace/api-client-react/src/generated/api.schemas";

interface AuthContextType {
  usuario: Usuario | null;
  token: string | null;
  setToken: (token: string | null) => void;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(localStorage.getItem("intelfon_token"));
  const queryClient = useQueryClient();

  const setToken = (newToken: string | null) => {
    setTokenState(newToken);
    if (newToken) {
      localStorage.setItem("intelfon_token", newToken);
    } else {
      localStorage.removeItem("intelfon_token");
    }
  };

  const { data: usuario, isLoading } = useGetMe({
    query: {
      enabled: !!token,
      queryKey: getGetMeQueryKey(),
      retry: false,
    },
  });

  useEffect(() => {
    if (!isLoading && token && !usuario) {
      // Token exists but getMe failed (e.g. invalid token)
      setToken(null);
    }
  }, [isLoading, token, usuario]);

  const logout = () => {
    setToken(null);
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ usuario: usuario || null, token, setToken, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
