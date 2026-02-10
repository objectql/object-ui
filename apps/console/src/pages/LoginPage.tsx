/**
 * Login Page for ObjectStack Console
 */

import { useNavigate } from 'react-router-dom';
import { LoginForm } from '@object-ui/auth';

export function LoginPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <LoginForm
        onSuccess={() => navigate('/')}
        registerUrl="/register"
        forgotPasswordUrl="/forgot-password"
      />
    </div>
  );
}
