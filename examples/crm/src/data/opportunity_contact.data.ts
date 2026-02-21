export const OpportunityContactData = {
  object: 'opportunity_contact',
  mode: 'upsert',
  records: [
    { _id: "oc1", name: 'Bob Smith — Enterprise License', opportunity: "101", contact: "2", role: 'decision_maker', is_primary: true },
    { _id: "oc2", name: 'George Martin — Enterprise License', opportunity: "101", contact: "7", role: 'evaluator', is_primary: false },
    { _id: "oc3", name: 'Charlie Brown — Global Fin Q1', opportunity: "102", contact: "3", role: 'champion', is_primary: true },
    { _id: "oc4", name: 'Diana Prince — London Renewal', opportunity: "103", contact: "4", role: 'decision_maker', is_primary: true },
    { _id: "oc5", name: 'Evan Wright — Berlin Automation', opportunity: "104", contact: "5", role: 'influencer', is_primary: true },
    { _id: "oc6", name: 'Fiona Gallagher — Paris POS', opportunity: "105", contact: "6", role: 'end_user', is_primary: true },
    { _id: "oc7", name: 'Bob Smith — SF Tower', opportunity: "107", contact: "2", role: 'decision_maker', is_primary: true },
  ]
};
