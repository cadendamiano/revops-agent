// sObject describe metadata. Mirrors the shape of Salesforce's describe response.
import type { SObjectDescribe } from './types';

const Opportunity: SObjectDescribe = {
  name: 'Opportunity',
  label: 'Opportunity',
  fields: [
    { name: 'Id',                label: 'Opportunity ID',  type: 'id',        nillable: false },
    { name: 'Name',              label: 'Opportunity Name',type: 'string',    nillable: false },
    { name: 'AccountId',         label: 'Account ID',      type: 'reference', nillable: false, referenceTo: 'Account' },
    { name: 'OwnerId',           label: 'Owner ID',        type: 'reference', nillable: false, referenceTo: 'User' },
    { name: 'StageName',         label: 'Stage',           type: 'picklist',  nillable: false, picklistValues: ['Qualified','Quoted','Scheduled','Job Complete','Invoiced','Closed Won','Closed Lost'] },
    { name: 'Amount',            label: 'Amount',          type: 'currency',  nillable: true  },
    { name: 'Probability',       label: 'Probability (%)', type: 'number',    nillable: false },
    { name: 'CloseDate',         label: 'Close Date',      type: 'date',      nillable: false },
    { name: 'CreatedDate',       label: 'Created Date',    type: 'datetime',  nillable: false },
    { name: 'LastActivityDate',  label: 'Last Activity',   type: 'date',      nillable: true  },
    { name: 'NextStep',          label: 'Next Step',       type: 'textarea',  nillable: true  },
    { name: 'LeadSource',        label: 'Lead Source',     type: 'picklist',  nillable: true,  picklistValues: ['Google Ads','Website','Referral','Repeat Customer','Yelp','Unknown'] },
    { name: 'Service_Type__c',   label: 'Service Type',    type: 'picklist',  nillable: true,  picklistValues: ['Residential Repair','Residential Install','Commercial Service','Commercial Install','Emergency'] },
    { name: 'Urgency__c',        label: 'Urgency',         type: 'picklist',  nillable: true,  picklistValues: ['Routine','Urgent','Emergency'] },
    { name: 'Property_Type__c',  label: 'Property Type',   type: 'picklist',  nillable: true,  picklistValues: ['Residential','Commercial'] },
  ],
  childRelationships: [
    { childSObject: 'Activity',         field: 'WhatId',         relationshipName: 'Activities' },
    { childSObject: 'ApprovalRequest',  field: 'SubmittedFor',   relationshipName: 'Approvals'  },
  ],
};

const Account: SObjectDescribe = {
  name: 'Account',
  label: 'Account',
  fields: [
    { name: 'Id',            label: 'Account ID',     type: 'id',        nillable: false },
    { name: 'Name',          label: 'Account Name',   type: 'string',    nillable: false },
    { name: 'Industry',      label: 'Account Type',   type: 'picklist',  nillable: true,  picklistValues: ['Residential','Commercial','Property Management'] },
    { name: 'AnnualRevenue', label: 'Annual Revenue', type: 'currency',  nillable: true  },
    { name: 'Employees',     label: 'Employees',      type: 'number',    nillable: true  },
    { name: 'OwnerId',       label: 'Owner ID',       type: 'reference', nillable: false, referenceTo: 'User' },
  ],
  childRelationships: [
    { childSObject: 'Opportunity', field: 'AccountId', relationshipName: 'Opportunities' },
    { childSObject: 'Contact',     field: 'AccountId', relationshipName: 'Contacts' },
    { childSObject: 'Case',        field: 'AccountId', relationshipName: 'Cases' },
  ],
};

const Lead: SObjectDescribe = {
  name: 'Lead',
  label: 'Lead',
  fields: [
    { name: 'Id',          label: 'Lead ID',      type: 'id',        nillable: false },
    { name: 'Name',        label: 'Name',         type: 'string',    nillable: false },
    { name: 'Company',     label: 'Company',      type: 'string',    nillable: false },
    { name: 'Email',       label: 'Email',        type: 'email',     nillable: true  },
    { name: 'Status',      label: 'Lead Status',  type: 'picklist',  nillable: false, picklistValues: ['New','Contacted','Qualified','Unqualified','Converted'] },
    { name: 'LeadSource',  label: 'Lead Source',  type: 'picklist',  nillable: true,  picklistValues: ['Google Ads','Website','Referral','Repeat Customer','Yelp','Unknown'] },
    { name: 'CreatedDate', label: 'Created Date', type: 'datetime',  nillable: false },
    { name: 'LastActivityDate', label: 'Last Activity', type: 'date', nillable: true },
    { name: 'OwnerId',     label: 'Owner ID',     type: 'reference', nillable: true,  referenceTo: 'User' },
    { name: 'Phone',       label: 'Phone',        type: 'phone',     nillable: true  },
    { name: 'Service_Type__c', label: 'Service Type', type: 'picklist', nillable: true, picklistValues: ['Residential Repair','Residential Install','Commercial Service','Commercial Install','Emergency'] },
  ],
  childRelationships: [],
};

const Contact: SObjectDescribe = {
  name: 'Contact',
  label: 'Contact',
  fields: [
    { name: 'Id',        label: 'Contact ID', type: 'id',        nillable: false },
    { name: 'AccountId', label: 'Account ID', type: 'reference', nillable: false, referenceTo: 'Account' },
    { name: 'Name',      label: 'Name',       type: 'string',    nillable: false },
    { name: 'Title',     label: 'Title',      type: 'string',    nillable: true  },
    { name: 'Email',     label: 'Email',      type: 'email',     nillable: true  },
    { name: 'Phone',     label: 'Phone',      type: 'phone',     nillable: true  },
    { name: 'OwnerId',   label: 'Owner ID',   type: 'reference', nillable: true,  referenceTo: 'User' },
    { name: 'LastActivityDate', label: 'Last Activity', type: 'date', nillable: true },
  ],
  childRelationships: [],
};

const User: SObjectDescribe = {
  name: 'User',
  label: 'User',
  fields: [
    { name: 'Id',    label: 'User ID', type: 'id',       nillable: false },
    { name: 'Name',  label: 'Name',    type: 'string',   nillable: false },
    { name: 'Email', label: 'Email',   type: 'email',    nillable: false },
    { name: 'Role',  label: 'Role',    type: 'picklist', nillable: false, picklistValues: ['InsideSales','Plumber','OpsManager'] },
    { name: 'Quota', label: 'Quota',   type: 'currency', nillable: true  },
    { name: 'Specialty', label: 'Specialty', type: 'picklist', nillable: true, picklistValues: ['Residential','Commercial','Emergency','Install'] },
  ],
  childRelationships: [
    { childSObject: 'Opportunity', field: 'OwnerId', relationshipName: 'OwnedOpps' },
  ],
};

const Case: SObjectDescribe = {
  name: 'Case',
  label: 'Case',
  fields: [
    { name: 'Id',            label: 'Case ID',         type: 'id',        nillable: false },
    { name: 'CaseNumber',    label: 'Case Number',     type: 'string',    nillable: false },
    { name: 'AccountId',     label: 'Account ID',      type: 'reference', nillable: false, referenceTo: 'Account' },
    { name: 'Subject',       label: 'Subject',         type: 'string',    nillable: false },
    { name: 'Priority',      label: 'Priority',        type: 'picklist',  nillable: false, picklistValues: ['P1','P2','P3'] },
    { name: 'Status',        label: 'Status',          type: 'picklist',  nillable: false, picklistValues: ['New','Working','Escalated','Closed'] },
    { name: 'CreatedDate',   label: 'Created Date',    type: 'datetime',  nillable: false },
    { name: 'SlaTargetDate', label: 'SLA Target',      type: 'date',      nillable: false },
    { name: 'OwnerId',       label: 'Owner ID',        type: 'reference', nillable: false, referenceTo: 'User' },
  ],
  childRelationships: [],
};

const Activity: SObjectDescribe = {
  name: 'Activity',
  label: 'Activity',
  fields: [
    { name: 'Id',           label: 'Activity ID', type: 'id',        nillable: false },
    { name: 'WhatId',       label: 'Related To',  type: 'reference', nillable: false },
    { name: 'WhoId',        label: 'Contact/Lead',type: 'reference', nillable: true  },
    { name: 'Type',         label: 'Type',        type: 'picklist',  nillable: false, picklistValues: ['Call','Email','SMS','Meeting','Note','Quote','StageChange'] },
    { name: 'Subject',      label: 'Subject',     type: 'string',    nillable: false },
    { name: 'ActivityDate', label: 'Date',        type: 'date',      nillable: false },
    { name: 'DurationMin',  label: 'Duration',    type: 'number',    nillable: true  },
    { name: 'OwnerId',      label: 'Owner ID',    type: 'reference', nillable: false, referenceTo: 'User' },
  ],
  childRelationships: [],
};

export const SOBJECTS_SCHEMA: Record<string, SObjectDescribe> = {
  Opportunity, Account, Lead, Contact, User, Case, Activity,
};

export type SObjectName = keyof typeof SOBJECTS_SCHEMA;

export function describeSObject(name: string): SObjectDescribe | undefined {
  return SOBJECTS_SCHEMA[name];
}

export function listSObjects(): { name: string; label: string; fieldCount: number }[] {
  return Object.values(SOBJECTS_SCHEMA).map(s => ({
    name: s.name,
    label: s.label,
    fieldCount: s.fields.length,
  }));
}
