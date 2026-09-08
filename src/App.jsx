import React from "react";
import { useAuth } from "./auth/AuthProvider";
import LoginPage from "./auth/LoginPage";
import EditorPage from "./features/graphs/EditorPage";

export default function App() {
  const { user, logout } = useAuth();

  if (!user) return <LoginPage />;

  return (
    <div className="app-shell min-h-screen">
      <EditorPage user={user} logout={logout} />
    </div>
  );
}
