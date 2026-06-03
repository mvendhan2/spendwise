import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Priority: env var in app.config → LAN IP for local dev → emulator default
const CLOUD_API = Constants.expoConfig?.extra?.apiUrl as string | undefined;

const getLocalBase = () => {
  if (Platform.OS === 'android') return 'http://10.0.2.2:3001/api';
  return 'http://localhost:3001/api';
};

export const API_BASE = CLOUD_API || getLocalBase();

const api = axios.create({ baseURL: API_BASE, timeout: 15000 });

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'user']);
    }
    return Promise.reject(error);
  }
);

export default api;
