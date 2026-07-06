import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface AuthUser {
  id: number;
  role: "customer" | "vendor" | "admin";
  vendorId?: number;
}
interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
}

// Persist a lightweight session hint (not the token) so refresh-on-load works.
const stored = localStorage.getItem("auth_user");
const initialState: AuthState = {
  accessToken: null,
  user: stored ? JSON.parse(stored) : null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials(state, action: PayloadAction<{ accessToken: string; user: AuthUser }>) {
      state.accessToken = action.payload.accessToken;
      state.user = action.payload.user;
      localStorage.setItem("auth_user", JSON.stringify(action.payload.user));
    },
    logout(state) {
      state.accessToken = null;
      state.user = null;
      localStorage.removeItem("auth_user");
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
