const ORGANIZATIONS = Object.freeze({
  'org-one': Object.freeze({ id: 'org-one', name: 'Synthetic Primary Practice' }),
  'org-two': Object.freeze({ id: 'org-two', name: 'Synthetic Secondary Practice' }),
});

const SYNTHETIC_PROFILE = Object.freeze({
  full_name: 'Synthetic Referral Person',
  date_of_birth: '1987-04-03',
  gender: 'other',
  phone: '0000 000 000',
  email: 'synthetic-referral@example.test',
  address: '1 Synthetic Street',
  referral_source: 'gp',
  referral_source_name: 'Dr Synthetic Referrer',
  referral_reason: 'Synthetic browser-assurance fixture',
  referral_date: '2026-07-20',
  funding_source: 'self_funded',
  primary_condition: 'Synthetic primary condition',
  comorbidities: ['Synthetic comorbidity'],
  medications: ['Synthetic medication'],
  medical_history: 'Synthetic reviewed medical history',
  client_goals: 'Complete the synthetic assurance journey',
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function membershipsFor(scenario) {
  if (scenario === 'multi') {
    return [
      { id: 'membership-one', org_id: 'org-one', is_primary: true },
      { id: 'membership-two', org_id: 'org-two', is_primary: false },
    ];
  }
  return [{ id: 'membership-one', org_id: 'org-one', is_primary: true }];
}

function clientsFor(scenario) {
  if (scenario !== 'match') return [];
  return [
    {
      id: 'synthetic-existing-client',
      org_id: 'org-one',
      full_name: 'Synthetic Referral Person',
      date_of_birth: '1987-04-03',
    },
    {
      id: 'synthetic-other-tenant-client',
      org_id: 'org-two',
      full_name: 'Synthetic Referral Person',
      date_of_birth: '1987-04-03',
    },
  ];
}

const scenario = new URLSearchParams(globalThis.location.search).get('scenario') || 'success';

export const harnessState = {
  scenario,
  user: {
    id: 'synthetic-user',
    email: 'synthetic-practitioner@example.test',
  },
  organizations: ORGANIZATIONS,
  memberships: membershipsFor(scenario),
  clients: clientsFor(scenario),
  profile: clone(SYNTHETIC_PROFILE),
  calls: {
    auth: [],
    memberships: [],
    organizations: [],
    clientQueries: [],
    upload: [],
    extract: [],
    cancel: [],
    functions: [],
    writes: [],
    callbacks: [],
  },
};

export function snapshotHarnessState() {
  return clone({
    scenario: harnessState.scenario,
    calls: harnessState.calls,
  });
}

globalThis.__referralAssurance = {
  snapshot: snapshotHarnessState,
};
