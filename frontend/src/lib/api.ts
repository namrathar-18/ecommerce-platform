import axios from "axios";
import { store } from "../app/store";
import { setCredentials, logout } from "../features/auth/authSlice";

export const api = axios.create({
  baseURL: "/api/v1",
  withCredentials: true, // send the httpOnly refresh cookie
});

// Attach access token to every request.
api.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, try one silent refresh, then replay the original request.
let refreshing: Promise<string | null> | null = null;
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      if (!refreshing) {
        refreshing = axios
          .post("/api/v1/auth/refresh", {}, { withCredentials: true })
          .then((res) => {
            store.dispatch(setCredentials(res.data));
            return res.data.accessToken as string;
          })
          .catch(() => {
            store.dispatch(logout());
            return null;
          })
          .finally(() => {
            refreshing = null;
          });
      }
      const token = await refreshing;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);
