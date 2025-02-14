import { createRoot } from "react-dom/client";
import { Provider } from "react-redux"; // Import Redux Provider
import { store, persistor } from "../redux/store.js"; // Import the Redux store
import { PersistGate } from "redux-persist/integration/react";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <Provider store={store}>
  {/* The PersistGate delays the rendering of your app's UI until the persisted state has been retrieved and saved to redux */}
  <PersistGate loading={null} persistor={persistor}>
    <App />
  </PersistGate>
</Provider>,
);
