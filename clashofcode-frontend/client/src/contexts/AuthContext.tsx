import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "../lib/api";
import axios from "axios";

interface User {
  id: string;
  name: string;
  handle: string;
  rating: number;
  rank: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize auth state from localStorage
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem("token");
      const refreshToken = localStorage.getItem("refreshToken");

      if (token) {
        setAccessToken(token);
        try {
          const response = await api.get("/users/me");
          setUser(response.data);
        } catch (err) {
          // Token is invalid, try to refresh
          if (refreshToken) {
            const refreshed = await refresh();
            if (!refreshed) {
              // Refresh failed, clear everything
              clearAuth();
            }
          } else {
            clearAuth();
          }
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  // Set up axios interceptor for automatic token refresh on 401
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If 401 and we haven't tried to refresh yet
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          const refreshed = await refresh();
          if (refreshed) {
            // Retry the original request with new token
            originalRequest.headers.Authorization = `Bearer ${localStorage.getItem("token")}`;
            return axios(originalRequest);
          } else {
            // Refresh failed, logout
            await logout();
            return Promise.reject(error);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const clearAuth = () => {
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post("/auth/login", { email, password });
      const { accessToken, refreshToken: newRefreshToken, user: userData } = response.data;

      localStorage.setItem("token", accessToken);
      if (newRefreshToken) {
        localStorage.setItem("refreshToken", newRefreshToken);
      }

      setAccessToken(accessToken);
      setUser(userData);
    } catch (err) {
      throw err;
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        // Call logout endpoint to revoke refresh token
        await api.post("/auth/logout", { refreshToken }).catch(() => {
          // Ignore errors on logout - we're logging out anyway
        });
      }
    } finally {
      clearAuth();
      // Redirect to login page
      window.location.href = "/login";
    }
  };

  const refresh = async (): Promise<boolean> => {
    try {
      const refreshToken = localStorage.getItem("refreshToken");
      if (!refreshToken) {
        return false;
      }

      const response = await api.post("/auth/refresh", { refreshToken });
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;

      localStorage.setItem("token", newAccessToken);
      if (newRefreshToken) {
        localStorage.setItem("refreshToken", newRefreshToken);
      }

      setAccessToken(newAccessToken);

      // Fetch user data with new token
      const userResponse = await api.get("/users/me");
      setUser(userResponse.data);

      return true;
    } catch (err) {
      console.error("Token refresh failed:", err);
      return false;
    }
  };

  const value: AuthContextType = {
    user,
    accessToken,
    isAuthenticated: !!user && !!accessToken,
    isLoading,
    login,
    logout,
    refreshToken: refresh,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
