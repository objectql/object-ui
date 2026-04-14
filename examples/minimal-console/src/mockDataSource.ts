/**
 * Mock Data Source
 *
 * A simple in-memory data source that demonstrates the DataSource interface.
 * In a real application, replace this with calls to your REST API, GraphQL, etc.
 */

interface DataSource {
  find(objectName: string, params?: any): Promise<any>;
  findOne(objectName: string, id: string): Promise<any>;
  create(objectName: string, data: any): Promise<any>;
  update(objectName: string, id: string, data: any): Promise<any>;
  delete(objectName: string, id: string): Promise<void>;
  getMetadata(): Promise<any>;
}

// Mock data storage
const mockData: Record<string, any[]> = {
  contact: [
    { id: '1', name: 'John Doe', email: 'john@example.com', phone: '555-1234' },
    { id: '2', name: 'Jane Smith', email: 'jane@example.com', phone: '555-5678' },
  ],
  account: [
    { id: '1', name: 'Acme Corp', industry: 'Technology', website: 'acme.com' },
    { id: '2', name: 'Global Inc', industry: 'Manufacturing', website: 'global.com' },
  ],
};

// Mock metadata
const mockMetadata = {
  objects: [
    {
      name: 'contact',
      label: 'Contacts',
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'phone', label: 'Phone', type: 'text' },
      ],
      views: [
        { id: 'grid', name: 'All Contacts', type: 'grid' },
      ],
    },
    {
      name: 'account',
      label: 'Accounts',
      fields: [
        { name: 'name', label: 'Name', type: 'text', required: true },
        { name: 'industry', label: 'Industry', type: 'text' },
        { name: 'website', label: 'Website', type: 'url' },
      ],
      views: [
        { id: 'grid', name: 'All Accounts', type: 'grid' },
      ],
    },
  ],
};

export const mockDataSource: DataSource = {
  async find(objectName: string, _params?: any) {
    await delay(300); // Simulate network delay
    const data = mockData[objectName] || [];
    return {
      data,
      total: data.length,
    };
  },

  async findOne(objectName: string, id: string) {
    await delay(200);
    const data = mockData[objectName] || [];
    const record = data.find((r) => r.id === id);
    if (!record) {
      throw new Error(`Record not found: ${objectName}/${id}`);
    }
    return record;
  },

  async create(objectName: string, data: any) {
    await delay(300);
    const newId = String(Date.now());
    const newRecord = { ...data, id: newId };

    if (!mockData[objectName]) {
      mockData[objectName] = [];
    }
    mockData[objectName].push(newRecord);

    return newRecord;
  },

  async update(objectName: string, id: string, data: any) {
    await delay(300);
    const records = mockData[objectName] || [];
    const index = records.findIndex((r) => r.id === id);

    if (index === -1) {
      throw new Error(`Record not found: ${objectName}/${id}`);
    }

    const updatedRecord = { ...records[index], ...data };
    mockData[objectName][index] = updatedRecord;

    return updatedRecord;
  },

  async delete(objectName: string, id: string) {
    await delay(300);
    const records = mockData[objectName] || [];
    const index = records.findIndex((r) => r.id === id);

    if (index === -1) {
      throw new Error(`Record not found: ${objectName}/${id}`);
    }

    mockData[objectName].splice(index, 1);
  },

  async getMetadata() {
    await delay(200);
    return mockMetadata;
  },
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
