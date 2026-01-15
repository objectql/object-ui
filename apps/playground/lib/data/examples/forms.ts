import formDemo from './forms/form-demo.json';
import airtableForm from './forms/airtable-form.json';
import formControls from './forms/form-controls.json';
import dateTimePickers from './forms/date-time-pickers.json';
import fileUploadDemo from './forms/file-upload-demo.json';
import inputOtpDemo from './forms/input-otp-demo.json';
import toggleGroupDemo from './forms/toggle-group-demo.json';

export const forms = {
  'form-demo': JSON.stringify(formDemo, null, 2),
  'airtable-form': JSON.stringify(airtableForm, null, 2),
  'form-controls': JSON.stringify(formControls, null, 2),
  'date-time-pickers': JSON.stringify(dateTimePickers, null, 2),
  'file-upload-demo': JSON.stringify(fileUploadDemo, null, 2),
  'input-otp-demo': JSON.stringify(inputOtpDemo, null, 2),
  'toggle-group-demo': JSON.stringify(toggleGroupDemo, null, 2)
};
