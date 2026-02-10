/**
 * Register Page for ObjectStack Console
 */

import { useNavigate } from 'react-router-dom';
import { RegisterForm } from '@object-ui/auth';

export function RegisterPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <RegisterForm
        onSuccess={() => navigate('/')}
        loginUrl="/login"
      />
    </div>
  );
}
