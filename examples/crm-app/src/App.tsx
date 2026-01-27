// examples/crm-app/src/App.tsx
import { useState } from 'react';
import { SchemaRenderer } from '@object-ui/react';
import { ComponentRegistry } from '@object-ui/core';
// import { registerComponents } from '@object-ui/fields'; // Assuming this exists or we need to manually register
import { Card, CardContent, CardHeader, CardTitle, Button } from '@object-ui/components';
import { 
  TextField, 
  NumberField, 
  BooleanField, 
  SelectField, 
  DateField 
} from '@object-ui/fields';

import { ContactObject, ContactFormPage, contactData } from './schema';

// --- Temporary Manual Registration (Simulating what @object-ui/fields should do) ---
// In a real app, this would be `import '@object-ui/fields/register';`
ComponentRegistry.register('text', (props: any) => <TextField {...props} />);
ComponentRegistry.register('textarea', (props: any) => <TextField {...props} />);
ComponentRegistry.register('number', (props: any) => <NumberField {...props} />);
ComponentRegistry.register('boolean', (props: any) => <BooleanField {...props} />);
ComponentRegistry.register('select', (props: any) => <SelectField {...props} />);
ComponentRegistry.register('date', (props: any) => <DateField {...props} />);

// Simple Form Container Renderer
ComponentRegistry.register('form', ({ children, className }: any) => (
  <form className={className} onSubmit={(e) => e.preventDefault()}>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {children}
    </div>
  </form>
));

// Simple Field Wrapper Renderer
ComponentRegistry.register('field', ({ schema, data, onChange, objectSchema }: any) => {
  const fieldName = schema.name;
  const fieldConfig = objectSchema.fields[fieldName];
  
  if (!fieldConfig) return <div className="text-red-500">Field {fieldName} not found</div>;

  const Widget = ComponentRegistry.get(fieldConfig.type) || ComponentRegistry.get('text');
  
  // Resolve value from data binding
  const value = data[schema.bind] || data[fieldName];

  const handleChange = (val: any) => {
    onChange?.(schema.bind || fieldName, val);
  };

  return (
    <div className={schema.props?.className}>
      <label className="block text-sm font-medium mb-1.5">
        {fieldConfig.label}
        {fieldConfig.required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <Widget 
        value={value} 
        onChange={handleChange} 
        field={fieldConfig}
        readonly={schema.readonly}
      />
      {fieldConfig.help && <p className="text-xs text-muted-foreground mt-1">{fieldConfig.help}</p>}
    </div>
  );
});


// -------------------------------------------------------------

export default function App() {
  const [data, setData] = useState(contactData);

  const handleFieldChange = (field: string, value: any) => {
    console.log('Update:', field, value);
    setData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">ObjectUI CRM Example</h1>
          <p className="text-slate-500 mt-2">
            Demonstrating Server-Driven UI with React + Tailwind + Shadcn.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Form Area */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>{ContactFormPage.title}</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Recursively render the Page Schema */}
                {((ContactFormPage.children as any[]) || []).map((childSchema: any) => (
                  <SchemaRenderer 
                    key={childSchema.id || childSchema.name} 
                    schema={childSchema}
                    // Inject Context
                    {...{
                      data,
                      onChange: handleFieldChange,
                      objectSchema: ContactObject
                    }}
                  />
                ))}
                
                <div className="mt-8 flex justify-end space-x-4">
                  <Button variant="outline">Cancel</Button>
                  <Button onClick={() => alert(JSON.stringify(data, null, 2))}>Save Contact</Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Real-time Data Debugger */}
          <div className="lg:col-span-1">
             <Card className="bg-slate-900 text-slate-50">
              <CardHeader>
                <CardTitle className="text-slate-50">Live State</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="text-xs font-mono overflow-auto max-h-[600px] p-2 bg-slate-950 rounded border border-slate-800">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </div>
  );
}
