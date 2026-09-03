/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ComponentRegistry } from '@object-ui/core';
import type { InputOTPSchema } from '@object-ui/types';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../../ui';
import { toFormControlDomProps } from '../../lib/form-control-dom-props';

ComponentRegistry.register('input-otp', 
  ({ schema, className, onChange, value, ...props }: { schema: InputOTPSchema; className?: string; [key: string]: any }) => {
    // `style` forwarded by name; the rest through the form-control
    // declaration (objectui#5632).
    const { style, ...otpProps } = props;
    const length = schema.maxLength || 6;
    const slots = Array.from({ length });

    const handleChange = (val: string) => {
      if (onChange) {
        onChange(val);
      }
    };

    return (
      <InputOTP 
        maxLength={length} 
        className={className} 
        value={value ?? schema.value}
        onChange={handleChange}
        {...toFormControlDomProps(otpProps)}
        style={style}
      >
        <InputOTPGroup>
          {slots.map((_, i) => (
             <InputOTPSlot key={i} index={i} />
          ))}
        </InputOTPGroup>
      </InputOTP>
    );
  },
  {
    namespace: 'ui',
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
