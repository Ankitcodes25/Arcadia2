import type { ReactNode } from "react";
import AuthLoading from "./AuthLoading";
import { useAuth } from "./AuthContext";

type ProtectedRouteProps = {
  children: ReactNode;
  unauthenticatedFallback?: ReactNode;
};

function ProtectedRoute({ children, unauthenticatedFallback = null }: ProtectedRouteProps) {
  const { isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return <AuthLoading />;
  }

  return isAuthenticated ? <>{children}</> : unauthenticatedFallback;
}

export default ProtectedRoute;
