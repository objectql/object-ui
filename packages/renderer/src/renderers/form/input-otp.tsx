import { ComponentRegistry } from '../../registry';
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from '@object-ui/ui';

ComponentRegistry.register('input-otp', 
  ({ schema, className, ...props }) => (
    <InputOTP maxLength={schema.maxLength || 6} className={className} {...props}>
      <InputOTPGroup>
        <InputOTPSlot index={0} />
        <InputOTPSlot index={1} />
        <InputOTPSlot index={2} />
      </InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup>
        <InputOTPSlot index={3} />
        <InputOTPSlot index={4} />
        <InputOTPSlot index={5} />
      </InputOTPGroup>
    </InputOTP>
  ),
  {
    label: 'Input OTP',
    inputs: [
      { name: 'maxLength', type: 'number', label: 'Max Length', defaultValue: 6 },
      { name: 'className', type: 'string', label: 'CSS Class' }
    ],
    defaultProps: {
      maxLength: 6
    }
  }
);
