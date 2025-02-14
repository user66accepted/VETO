import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  userId: null,
  password: null,
  isAuthenticated: false,
  sessionExpiresAt: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    login: (state, action) => {
      state.userId = action.payload.userId;
      state.password = action.payload.password;
      state.isAuthenticated = true;
      state.sessionExpiresAt = Date.now() + 30 * 60 * 1000;
    },
    logout: (state) => {
      state.userId = null;
      state.password = null;
      state.isAuthenticated = false;
      state.sessionExpiresAt = null;
    },
  },
});

export const { login, logout } = authSlice.actions;
export default authSlice.reducer;
