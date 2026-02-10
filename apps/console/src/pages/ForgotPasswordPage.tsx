/**
 * Forgot Password Page for ObjectStack Console
 */

import { ForgotPasswordForm } from '@object-ui/auth';

export function ForgotPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <ForgotPasswordForm loginUrl="/login" />
    </div>
  );
}
