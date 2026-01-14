try {
  await import('eslint/config');
  console.log('eslint/config imported successfully');
} catch (e) {
  console.error('Failed to import eslint/config:', e.message);
}

try {
  await import('eslint-plugin-react-hooks');
  console.log('eslint-plugin-react-hooks imported successfully');
} catch (e) {
  console.error('Failed to import eslint-plugin-react-hooks:', e.message);
}

try {
  await import('typescript-eslint');
  console.log('typescript-eslint imported successfully');
} catch (e) {
  console.error('Failed to import typescript-eslint:', e.message);
}
