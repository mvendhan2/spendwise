import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

interface User {
  id: string;
  phone?: string;
  display_name: string;
  monthly_salary?: number;
  onboarding_done: boolean;
  plan: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  sendOtp: (phone: string) => Promise<{ debug_otp?: string }>;
  verifyOtp: (phone: string, otp: string) => Promise<void>;
  updateUser: (data: Partial<User>) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem('user').then((stored) => {
      if (stored) setUser(JSON.parse(stored));
      setIsLoading(false);
    });
  }, []);

  const sendOtp = async (phone: string) => {
    const res = await api.post('/auth/send-otp', { phone });
    return res.data;
  };

  const verifyOtp = async (phone: string, otp: string) => {
    const res = await api.post('/auth/verify-otp', { phone, otp, device_name: 'Mobile App' });
    const { access_token, refresh_token, user: userData } = res.data;
    await AsyncStorage.setItem('access_token', access_token);
    await AsyncStorage.setItem('refresh_token', refresh_token);
    await AsyncStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  const updateUser = async (data: Partial<User>) => {
    const res = await api.patch('/auth/me', data);
    const updated = { ...user, ...data } as User;
    await AsyncStorage.setItem('user', JSON.stringify(updated));
    setUser(updated);
  };

  const logout = async () => {
    await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, sendOtp, verifyOtp, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
