import { ContactObject } from '../../../examples/crm/src/objects/contact.object';

console.log('ContactObject keys:', Object.keys(ContactObject));
console.log('ContactObject.name:', ContactObject.name);
console.log('ContactObject.fields:', ContactObject.fields);
console.log('Contact Object fields keys:', Object.keys(ContactObject.fields || {}));

// Check what properties each field has
if (ContactObject.fields) {
  Object.keys(ContactObject.fields).forEach(fieldName => {
    const field = ContactObject.fields[fieldName];
    console.log(`\nField "${fieldName}":`);
    console.log('  - keys:', Object.keys(field));
    console.log('  - type:', field.type);
    console.log('  - label:', field.label);
  });
}
