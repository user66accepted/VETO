// store.js
import { configureStore, combineReducers } from "@reduxjs/toolkit";
import authReducer from "./authSlice";
import { persistStore, persistReducer } from "redux-persist";
// For web, use localStorage. (For react-native, you'd use a different storage engine.)
import storage from "redux-persist/lib/storage"; 

// Create a root reducer if you have multiple slices
const rootReducer = combineReducers({
  auth: authReducer,
  // Add other reducers here if needed
});

// Configure redux-persist
const persistConfig = {
  key: "root",        // key used in localStorage
  storage,            // storage engine
  whitelist: ["auth"] // only persist the auth slice (add others as needed)
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

// Create the store with the persisted reducer
export const store = configureStore({
  reducer: persistedReducer,
  // Optionally add middleware or devTools configuration here
});

// Create a persistor linked to the store
export const persistor = persistStore(store);
