export const UserData = {
  object: 'user',
  mode: 'upsert',
  records: [
    { _id: "1", name: 'Martin CEO', email: 'martin@example.com', username: 'martin', role: 'admin', title: 'Chief Executive Officer', department: 'Executive', phone: '415-555-2001', active: true },
    { _id: "2", name: 'Sarah Sales', email: 'sarah@example.com', username: 'sarah', role: 'user', title: 'Sales Manager', department: 'Sales', phone: '415-555-2002', active: true },
    { _id: "3", name: 'James Ops', email: 'james@example.com', username: 'james', role: 'manager', title: 'Operations Director', department: 'Operations', phone: '415-555-2003', active: true },
    { _id: "4", name: 'Emily Support', email: 'emily@example.com', username: 'emily', role: 'user', title: 'Support Lead', department: 'Support', phone: '415-555-2004', active: true },
    { _id: "5", name: 'David Intern', email: 'david@example.com', username: 'david', role: 'viewer', title: 'Sales Intern', department: 'Sales', phone: '415-555-2005', active: true },
    { _id: "6", name: 'Rachel Marketing', email: 'rachel@example.com', username: 'rachel', role: 'user', title: 'Marketing Manager', department: 'Marketing', phone: '415-555-2006', active: true },
    { _id: "7", name: 'Tom Inactive', email: 'tom@example.com', username: 'tom', role: 'user', title: 'Former Sales Rep', department: 'Sales', phone: '415-555-2007', active: false },
  ]
};
