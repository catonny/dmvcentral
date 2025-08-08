

export type EmployeeRole = string;

export type BillStatus = "To Bill" | "Pending Collection" | "Collected";

export interface Firm {
  id: string;
  name: string;
  pan: string;
  gstn?: string;
  pfCode?: string;
  esiCode?: string;
  website?: string;
  email?: string;
  contactNumber?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankIfscCode?: string;
  billingAddressLine1?: string;
  billingAddressLine2?: string;

  billingAddressLine3?: string;
  country?: string;
  state?: string;
}

export interface ClientCategory {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  designation?: string;
  avatar: string;
  role: EmployeeRole[];
  managerId?: string; // Reports to this Employee ID
  // New fields for profile
  linkedin?: string;
  emergencyContact?: string;
  bloodGroup?: string;
  leaveAllowance?: number;
  leavesTaken?: number;
}

export interface Client {
  id:string;
  // Mandatory
  name: string;
  mailId: string | "unassigned";
  mobileNumber: string | "1111111111";
  category?: string | "unassigned"; // Links to ClientCategory.name
  partnerId: string; // Partner's ID
  firmId: string; // The firm this client belongs to
  // Optional
  phoneNumber?: string;
  dateOfBirth?: string; // Stored as ISO string
  linkedClientIds?: string[];
  pan?: string;
  gstin?: string;
  billingAddressLine1?: string;
  billingAddressLine2?: string;
  billingAddressLine3?: string;
  state?: string;
  country?: string;
  contactPerson?: string;
  contactPersonDesignation?: string;
  
  // System managed
  createdAt: string; // ISO 8601 string
  lastUpdated: string;
}

// EngagementType now acts as a template for Engagements
export interface EngagementType {
  id: string;
  name: string;
  description: string;
  // This is a template list. When an engagement of this type is created,
  // a 'Task' document will be created for each of these titles.
  subTaskTitles: string[]; 
  applicableCategories?: string[]; // Optional: ["Corporate", "LLP"], etc.
  recurrence?: 'Monthly' | 'Quarterly' | 'Yearly';
}

export type EngagementStatus = "Pending" | "Awaiting Documents" | "In Process" | "Partner Review" | "On Hold" | "Completed" | "Cancelled";
export type TaskStatus = "Pending" | "Completed" | "Cancelled";

export interface Department {
    id: string;
    name: EmployeeRole;
    order: number;
}

export interface Engagement {
  id: string;
  clientId: string;
  remarks: string;
  type: string; // Corresponds to EngagementType.id
  assignedTo: string[]; // Corresponds to Employee.id - Team members on the engagement
  reportedTo: string; // Corresponds to Employee.id (Manager or Partner)
  dueDate: string; // ISO 8601
  status: EngagementStatus;
  // Billing fields
  billStatus?: BillStatus;
  billSubmissionDate?: string; // ISO 8601 format
  fees?: number;
  recurringEngagementId?: string;
}

export interface RecurringEngagement {
  id: string;
  clientId: string;
  engagementTypeId: string;
  fees: number;
  isActive: boolean;
  assignedTo: string[];
  reportedTo: string;
  lastGeneratedDate?: string;
}

export type TodoType = 'FEE_REVISION_APPROVAL' | 'INCOMPLETE_CLIENT_DATA' | 'GENERAL_TASK';

export interface Todo {
    id: string;
    type: TodoType;
    text: string; // The main text of the to-do item
    createdBy: string; // Employee ID of the creator
    assignedTo: string[]; // Employee IDs of assignees
    relatedEntity?: {
        type: 'client' | 'engagement';
        id: string;
    };
    isCompleted: boolean;
    createdAt: string; // ISO String
    completedAt?: string; // ISO String
    completedBy?: string; // Employee ID
}


export interface PendingInvoice {
    id: string; // Firestore document ID
    engagementId: string;
    clientId: string;
    assignedTo: string[];
    reportedTo: string;
    partnerId: string;
}

export interface TimesheetEntry {
    engagementId: string;
    hours: number;
    description?: string;
}

export interface Timesheet {
    id: string; // Composite key: userId_weekStartDate (e.g., S003_2024-07-22)
    userId: string;
    userName: string;
    isPartner: boolean;
    weekStartDate: string; // ISO 8601 string for the Monday of that week
    totalHours: number;
    entries: TimesheetEntry[];
}


export interface Task {
    id: string;
    engagementId: string;
    title: string;
    status: TaskStatus;
    order: number;
    assignedTo: string; // Corresponds to Employee.id
}

export type ActivityLogType = 
    | 'CREATE_ENGAGEMENT'
    | 'STATUS_CHANGE'
    | 'DUE_DATE_CHANGED'
    | 'ASSIGNEE_CHANGED'
    | 'REMARKS_CHANGED'
    | 'TASK_COMPLETED';

export interface ActivityLog {
    id: string;
    engagementId: string;
    clientId: string;
    type: ActivityLogType;
    timestamp: string; // ISO 8601
    userId: string; // Employee ID of who performed the action
    userName: string; // Name of the employee for easy display
    details: {
        engagementName: string;
        from?: string;
        to?: string;
        taskName?: string;
    };
}


export interface EngagementNote {
    id: string;
    engagementId: string;
    clientId: string;
    text: string;
    category: "Permanent File" | "Current File" | "Note";
    financialYear?: string; // e.g., "2023-24", only for "Current File"
    createdBy: string; // Employee ID
    createdAt: string; // ISO 8601
    mentions: string[]; // Array of mentioned employee IDs
}

export interface ChatThread {
    id: string;
    participants: string[]; // Array of Employee IDs
    lastMessage: {
        text: string;
        timestamp: string; // ISO 8601
        senderId: string;
    };
    participantDetails: {
        [userId: string]: {
            name: string;
            avatar: string;
        }
    };
    updatedAt: string; // ISO 8601, for sorting threads
}

export interface ChatMessage {
  id: string;
  threadId: string;
  senderId: string; // Employee ID
  text: string;
  timestamp: string; // ISO 8601
}


export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO8601 string
  end: string; // ISO8601 string
  allDay: boolean;
  createdBy: string; // Employee ID
  description?: string;
  attendees?: string[]; // Array of Employee IDs
  location?: string; // For meeting links
  engagementId?: string; // To link back to an engagement
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string; // ISO 8601
  endDate: string; // ISO 8601
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  approvedBy?: string; // Employee ID of manager/partner
  createdAt: string; // ISO 8601
}


export type FeatureName = 
    | "reports" 
    | "administration" 
    | "masters" 
    | "bulk-import" 
    | "employee-management" 
    | "workflow-editor" 
    | "settings-data-management" 
    | "settings-access-control"
    | "timesheet"
    | "calendar"
    | "inbox"
    | "firm-analytics"
    | "leave-management"
    | "agentic-ai";

export const ALL_FEATURES: { id: FeatureName, name: string, description: string }[] = [
    { id: "reports", name: "Reports", description: "Access the firm-wide engagement overview." },
    { id: "administration", name: "Administration", description: "Access the billing and collections dashboard." },
    { id: "timesheet", name: "Timesheet", description: "Access to view and manage timesheets" },
    { id: "calendar", name: "Calendar", description: "Access the shared team calendar." },
    { id: "inbox", name: "Inbox", description: "View and manage AI-processed client communications." },
    { id: "firm-analytics", name: "Firm Analytics", description: "View key performance indicators for the firm." },
    { id: "leave-management", name: "Leave Management", description: "Approve or reject employee leave requests." },
    { id: "agentic-ai", name: "Agentic AI", description: "Access and manage AI-powered agents." },
    { id: "masters", name: "Masters", description: "Create, view, and alter master data." },
    { id: "bulk-import", name: "Bulk Import", description: "Bulk create or update data using CSV files." },
    { id: "employee-management", name: "Employee Management", description: "Manage employee roles and departments." },
    { id: "workflow-editor", name: "Workflow Editor", description: "Create and edit engagement workflow templates." },
    { id: "settings-data-management", name: "Data Management Settings", description: "Access backup, restore, and delete functions." },
    { id: "settings-access-control", name: "Access Control Settings", description: "Manage which roles can access features." },
];

export interface Permission {
  feature: FeatureName;
  departments: EmployeeRole[];
}

export interface Communication {
  id: string;
  from: string;
  subject: string;
  body: string;
  receivedAt: string; // ISO string
  
  // AI processing output
  clientId?: string;
  clientName?: string;
  summary?: string;
  category?: "Query" | "Document Submission" | "Follow-up" | "Appreciation" | "Urgent" | "General";
  actionItems?: string[];
  visibleTo: string[]; // employee IDs
}

export interface Country {
    name: string;
    code: string;
}

export interface TaxRate {
    id: string;
    name: string; // e.g., "GST @ 5%"
    rate: number; // e.g., 5
    isDefault?: boolean;
}

export interface HsnSacCode {
    id: string;
    code: string;
    description: string;
    type: 'HSN' | 'SAC';
    isDefault?: boolean;
}

export interface SalesItem {
    id: string;
    name: string;
    description: string;
    standardPrice: number;
    defaultTaxRateId: string;
    defaultSacId: string;
}

export const indianStatesAndUTs: string[] = [
    "Andhra Pradesh",
    "Arunachal Pradesh",
    "Assam",
    "Bihar",
    "Chhattisgarh",
    "Goa",
    "Gujarat",
    "Haryana",
    "Himachal Pradesh",
    "Jharkhand",
    "Karnataka",
    "Kerala",
    "Madhya Pradesh",
    "Maharashtra",
    "Manipur",
    "Meghalaya",
    "Mizoram",
    "Nagaland",
    "Odisha",
    "Punjab",
    "Rajasthan",
    "Sikkim",
    "Tamil Nadu",
    "Telangana",
    "Tripura",
    "Uttar Pradesh",
    "Uttarakhand",
    "West Bengal",
    "Andaman and Nicobar Islands",
    "Chandigarh",
    "Dadra and Nagar Haveli and Daman and Diu",
    "Delhi",
    "Jammu and Kashmir",
    "Ladakh",
    "Lakshadweep",
    "Puducherry",
];

export const clientCategories: string[] = ["Corporate", "Individual", "LLP", "Partnership", "Trust"];

export const firms: Omit<Firm, 'id'>[] = [
    {
        name: "Davis, Martin & Varghese",
        pan: "FIRMABC123D",
        gstn: "22FIRMABC123D1Z5",
        email: "contact@dmvca.com",
        contactNumber: "0484 222 3333",
        website: "https://dmvca.com",
        billingAddressLine1: "DMV Tower",
        billingAddressLine2: "Finance Road",
        state: "Kerala",
        country: "India",
    }
];

const adminUser: Employee = {
    id: "S001",
    name: "Tonny Varghese",
    email: "ca.tonnyvarghese@gmail.com",
    designation: "Founder & CEO",
    avatar: "https://placehold.co/40x40.png",
    role: ["Admin", "Partner"],
    leaveAllowance: 24,
    leavesTaken: 0,
};

const defaultEmployees: Employee[] = [
  { 
    id: "S006", 
    name: "Dojo Davis", 
    email: "cadojodavis@gmail.com", 
    designation: "Managing Partner", 
    avatar: "https://placehold.co/40x40.png", 
    role: ["Admin", "Partner"], 
    leaveAllowance: 20, 
    leavesTaken: 0 
  },
];

export const employees: Employee[] = [adminUser, ...defaultEmployees];


export const departments: Omit<Department, "id">[] = [
    { name: "Admin", order: 1 },
    { name: "Partner", order: 2 },
    { name: "Administration", order: 3 },
    { name: "Manager", order: 4 },
    { name: "Employee", order: 5 },
    { name: "Articles", order: 6 },
];


export const countries: Country[] = [
    { name: "Afghanistan", code: "AF" },
    { name: "Åland Islands", code: "AX" },
    { name: "Albania", code: "AL" },
    { name: "Algeria", code: "DZ" },
    { name: "American Samoa", code: "AS" },
    { name: "AndorrA", code: "AD" },
    { name: "Angola", code: "AO" },
    { name: "Anguilla", code: "AI" },
    { name: "Antarctica", code: "AQ" },
    { name: "Antigua and Barbuda", code: "AG" },
    { name: "Argentina", code: "AR" },
    { name: "Armenia", code: "AM" },
    { name: "Aruba", code: "AW" },
    { name: "Australia", code: "AU" },
    { name: "Austria", code: "AT" },
    { name: "Azerbaijan", code: "AZ" },
    { name: "Bahamas", code: "BS" },
    { name: "Bahrain", code: "BH" },
    { name: "Bangladesh", code: "BD" },
    { name: "Barbados", code: "BB" },
    { name: "Belarus", code: "BY" },
    { name: "Belgium", code: "BE" },
    { name: "Belize", code: "BZ" },
    { name: "Benin", code: "BJ" },
    { name: "Bermuda", code: "BM" },
    { name: "Bhutan", code: "BT" },
    { name: "Bolivia", code: "BO" },
    { name: "Bosnia and Herzegovina", code: "BA" },
    { name: "Botswana", code: "BW" },
    { name: "Bouvet Island", code: "BV" },
    { name: "Brazil", code: "BR" },
    { name: "British Indian Ocean Territory", code: "IO" },
    { name: "Brunei Darussalam", code: "BN" },
    { name: "Bulgaria", code: "BG" },
    { name: "Burkina Faso", code: "BF" },
    { name: "Burundi", code: "BI" },
    { name: "Cambodia", code: "KH" },
    { name: "Cameroon", code: "CM" },
    { name: "Canada", code: "CA" },
    { name: "Cape Verde", code: "CV" },
    { name: "Cayman Islands", code: "KY" },
    { name: "Central African Republic", code: "CF" },
    { name: "Chad", code: "TD" },
    { name: "Chile", code: "CL" },
    { name: "China", code: "CN" },
    { name: "Christmas Island", code: "CX" },
    { name: "Cocos (Keeling) Islands", code: "CC" },
    { name: "Colombia", code: "CO" },
    { name: "Comoros", code: "KM" },
    { name: "Congo", code: "CG" },
    { name: "Congo, The Democratic Republic of the", code: "CD" },
    { name: "Cook Islands", code: "CK" },
    { name: "Costa Rica", code: "CR" },
    { name: "Cote D'Ivoire", code: "CI" },
    { name: "Croatia", code: "HR" },
    { name: "Cuba", code: "CU" },
    { name: "Cyprus", code: "CY" },
    { name: "Czech Republic", code: "CZ" },
    { name: "Denmark", code: "DK" },
    { name: "Djibouti", code: "DJ" },
    { name: "Dominica", code: "DM" },
    { name: "Dominican Republic", code: "DO" },
    { name: "Ecuador", code: "EC" },
    { name: "Egypt", code: "EG" },
    { name: "El Salvador", code: "SV" },
    { name: "Equatorial Guinea", code: "GQ" },
    { name: "Eritrea", code: "ER" },
    { name: "Estonia", code: "EE" },
    { name: "Ethiopia", code: "ET" },
    { name: "Falkland Islands (Malvinas)", code: "FK" },
    { name: "Faroe Islands", code: "FO" },
    { name: "Fiji", code: "FJ" },
    { name: "Finland", code: "FI" },
    { name: "France", code: "FR" },
    { name: "French Guiana", code: "GF" },
    { name: "French Polynesia", code: "PF" },
    { name: "French Southern Territories", code: "TF" },
    { name: "Gabon", code: "GA" },
    { name: "Gambia", code: "GM" },
    { name: "Georgia", code: "GE" },
    { name: "Germany", code: "DE" },
    { name: "Ghana", code: "GH" },
    { name: "Gibraltar", code: "GI" },
    { name: "Greece", code: "GR" },
    { name: "Greenland", code: "GL" },
    { name: "Grenada", code: "GD" },
    { name: "Guadeloupe", code: "GP" },
    { name: "Guam", code: "GU" },
    { name: "Guatemala", code: "GT" },
    { name: "Guernsey", code: "GG" },
    { name: "Guinea", code: "GN" },
    { name: "Guinea-Bissau", code: "GW" },
    { name: "Guyana", code: "GY" },
    { name: "Haiti", code: "HT" },
    { name: "Heard Island and Mcdonald Islands", code: "HM" },
    { name: "Holy See (Vatican City State)", code: "VA" },
    { name: "Honduras", code: "HN" },
    { name: "Hong Kong", code: "HK" },
    { name: "Hungary", code: "HU" },
    { name: "Iceland", code: "IS" },
    { name: "India", code: "IN" },
    { name: "Indonesia", code: "ID" },
    { name: "Iran, Islamic Republic Of", code: "IR" },
    { name: "Iraq", code: "IQ" },
    { name: "Ireland", code: "IE" },
    { name: "Isle of Man", code: "IM" },
    { name: "Israel", code: "IL" },
    { name: "Italy", code: "IT" },
    { name: "Jamaica", code: "JM" },
    { name: "Japan", code: "JP" },
    { name: "Jersey", code: "JE" },
    { name: "Jordan", code: "JO" },
    { name: "Kazakhstan", code: "KZ" },
    { name: "Kenya", code: "KE" },
    { name: "Kiribati", code: "KI" },
    { name: "Korea, Democratic People'S Republic of", code: "KP" },
    { name: "Korea, Republic of", code: "KR" },
    { name: "Kuwait", code: "KW" },
    { name: "Kyrgyzstan", code: "KG" },
    { name: "Lao People'S Democratic Republic", code: "LA" },
    { name: "Latvia", code: "LV" },
    { name: "Lebanon", code: "LB" },
    { name: "Lesotho", code: "LS" },
    { name: "Liberia", code: "LR" },
    { name: "Libyan Arab Jamahiriya", code: "LY" },
    { name: "Liechtenstein", code: "LI" },
    { name: "Lithuania", code: "LT" },
    { name: "Luxembourg", code: "LU" },
    { name: "Macao", code: "MO" },
    { name: "Macedonia, The Former Yugoslav Republic of", code: "MK" },
    { name: "Madagascar", code: "MG" },
    { name: "Malawi", code: "MW" },
    { name: "Malaysia", code: "MY" },
    { name: "Maldives", code: "MV" },
    { name: "Mali", code: "ML" },
    { name: "Malta", code: "MT" },
    { name: "Marshall Islands", code: "MH" },
    { name: "Martinique", code: "MQ" },
    { name: "Mauritania", code: "MR" },
    { name: "Mauritius", code: "MU" },
    { name: "Mayotte", code: "YT" },
    { name: "Mexico", code: "MX" },
    { name: "Micronesia, Federated States of", code: "FM" },
    { name: "Moldova, Republic of", code: "MD" },
    { name: "Monaco", code: "MC" },
    { name: "Mongolia", code: "MN" },
    { name: "Montserrat", code: "MS" },
    { name: "Morocco", code: "MA" },
    { name: "Mozambique", code: "MZ" },
    { name: "Myanmar", code: "MM" },
    { name: "Namibia", code: "NA" },
    { name: "Nauru", code: "NR" },
    { name: "Nepal", code: "NP" },
    { name: "Netherlands", code: "NL" },
    { name: "Netherlands Antilles", code: "AN" },
    { name: "New Caledonia", code: "NC" },
    { name: "New Zealand", code: "NZ" },
    { name: "Nicaragua", code: "NI" },
    { name: "Niger", code: "NE" },
    { name: "Nigeria", code: "NG" },
    { name: "Niue", code: "NU" },
    { name: "Norfolk Island", code: "NF" },
    { name: "Northern Mariana Islands", code: "MP" },
    { name: "Norway", code: "NO" },
    { name: "Oman", code: "OM" },
    { name: "Pakistan", code: "PK" },
    { name: "Palau", code: "PW" },
    { name: "Palestinian Territory, Occupied", code: "PS" },
    { name: "Panama", code: "PA" },
    { name: "Papua New Guinea", code: "PG" },
    { name: "Paraguay", code: "PY" },
    { name: "Peru", code: "PE" },
    { name: "Philippines", code: "PH" },
    { name: "Pitcairn", code: "PN" },
    { name: "Poland", code: "PL" },
    { name: "Portugal", code: "PT" },
    { name: "Puerto Rico", code: "PR" },
    { name: "Qatar", code: "QA" },
    { name: "Reunion", code: "RE" },
    { name: "Romania", code: "RO" },
    { name: "Russian Federation", code: "RU" },
    { name: "RWANDA", code: "RW" },
    { name: "Saint Helena", code: "SH" },
    { name: "Saint Kitts and Nevis", code: "KN" },
    { name: "Saint Lucia", code: "LC" },
    { name: "Saint Pierre and Miquelon", code: "PM" },
    { name: "Saint Vincent and the Grenadines", code: "VC" },
    { name: "Samoa", code: "WS" },
    { name: "San Marino", code: "SM" },
    { name: "Sao Tome and Principe", code: "ST" },
    { name: "Saudi Arabia", code: "SA" },
    { name: "Senegal", code: "SN" },
    { name: "Serbia and Montenegro", code: "CS" },
    { name: "Seychelles", code: "SC" },
    { name: "Sierra Leone", code: "SL" },
    { name: "Singapore", code: "SG" },
    { name: "Slovakia", code: "SK" },
    { name: "Slovenia", code: "SI" },
    { name: "Solomon Islands", code: "SB" },
    { name: "Somalia", code: "SO" },
    { name: "South Africa", code: "ZA" },
    { name: "South Georgia and the South Sandwich Islands", code: "GS" },
    { name: "Spain", code: "ES" },
    { name: "Sri Lanka", code: "LK" },
    { name: "Sudan", code: "SD" },
    { name: "Suriname", code: "SR" },
    { name: "Svalbard and Jan Mayen", code: "SJ" },
    { name: "Swaziland", code: "SZ" },
    { name: "Sweden", code: "SE" },
    { name: "Switzerland", code: "CH" },
    { name: "Syrian Arab Republic", code: "SY" },
    { name: "Taiwan, Province of China", code: "TW" },
    { name: "Tajikistan", code: "TJ" },
    { name: "Tanzania, United Republic of", code: "TZ" },
    { name: "Thailand", code: "TH" },
    { name: "Timor-Leste", code: "TL" },
    { name: "Togo", code: "TG" },
    { name: "Tokelau", code: "TK" },
    { name: "Tonga", code: "TO" },
    { name: "Trinidad and Tobago", code: "TT" },
    { name: "Tunisia", code: "TN" },
    { name: "Turkey", code: "TR" },
    { name: "Turkmenistan", code: "TM" },
    { name: "Turks and Caicos Islands", code: "TC" },
    { name: "Tuvalu", code: "TV" },
    { name: "Uganda", code: "UG" },
    { name: "Ukraine", code: "UA" },
    { name: "United Arab Emirates", code: "AE" },
    { name: "United Kingdom", code: "GB" },
    { name: "United States", code: "US" },
    { name: "United States Minor Outlying Islands", code: "UM" },
    { name: "Uruguay", code: "UY" },
    { name: "Uzbekistan", code: "UZ" },
    { name: "Vanuatu", code: "VU" },
    { name: "Venezuela", code: "VE" },
    { name: "Viet Nam", code: "VN" },
    { name: "Virgin Islands, British", code: "VG" },
    { name: "Virgin Islands, U.S.", code: "VI" },
    { name: "Wallis and Futuna", code: "WF" },
    { name: "Western Sahara", code: "EH" },
    { name: "Yemen", code: "YE" },
    { name: "Zambia", code: "ZM" },
    { name: "Zimbabwe", code: "ZW" }
];

export const clients: Omit<Client, 'id' | 'lastUpdated' | 'createdAt'>[] = [
    {
        name: "Innovate Inc.",
        pan: "AABCI1234F",
        mobileNumber: "9876543210",
        mailId: "contact@innovate.com",
        partnerId: "S006", // Dojo Davis
        firmId: "firm_id_placeholder",
        category: "Corporate",
        country: "India",
        gstin: "22AABCI1234F1Z5",
        contactPerson: "Vijay Kumar",
        contactPersonDesignation: "CEO"
    },
    {
        name: "GreenFuture LLP",
        pan: "BBGFL0987D",
        mobileNumber: "9988776655",
        mailId: "accounts@greenfuture.com",
        partnerId: "S006", // Dojo Davis
        firmId: "firm_id_placeholder",
        category: "LLP",
        country: "India",
        contactPerson: "Emily White",
        contactPersonDesignation: "Designated Partner"
    },
    {
        name: "Hope Foundation",
        pan: "DDHFT1234E",
        mobileNumber: "9654321098",
        mailId: "trust@hopefoundation.org",
        partnerId: "S001", // Tonny Varghese
        firmId: "firm_id_placeholder",
        category: "Trust",
        country: "India",
        contactPerson: "Riya Singh",
        contactPersonDesignation: "Trustee"
    }
];


export const engagementTypes: EngagementType[] = [
    { 
        id: "ET01", 
        name: "ITR Filing", 
        description: "Income Tax Return Filing for Individuals and Businesses",
        subTaskTitles: ["Contact Client", "Collect Documents", "Prepare Computation", "Finalise Computation", "File ITR", "e-Verify ITR", "Send ITR-V to Client"],
        recurrence: "Yearly",
    },
    { 
        id: "ET02", 
        name: "GST Filing", 
        description: "Monthly and Quarterly GST Return Filing",
        subTaskTitles: ["Request Sales Data", "Request Purchase Data", "Reconcile GSTR-2B", "Prepare GSTR-3B", "File GSTR-3B", "File GSTR-1"],
        recurrence: "Monthly",
    },
    {
        id: "ET03",
        name: "TDS Filing",
        description: "Quarterly TDS Return Filing",
        subTaskTitles: ["Collect TDS Data", "Prepare TDS Return", "Validate TDS Return", "File TDS Return", "Download Form 16/16A", "Issue Certificates"],
        recurrence: "Quarterly",
    },
    { 
        id: "ET04", 
        name: "Tax Audit", 
        description: "Audit under section 44AB of the Income Tax Act",
        subTaskTitles: ["Send Audit Request List", "Collect Financial Statements", "Vouching and Verification", "Prepare Audit Report", "Finalize Audit Report", "Upload Tax Audit Report"]
    },
    {
        id: "ET05",
        name: "Company Audit",
        description: "Statutory audit for companies",
        subTaskTitles: ["Engagement Acceptance", "Planning", "Risk Assessment", "Fieldwork", "Review", "Reporting", "Finalisation"],
        applicableCategories: ["Corporate", "LLP"]
    },
    {
        id: "ET06",
        name: "Net Worth Certificates",
        description: "Issuing net worth certificates for visa or other purposes",
        subTaskTitles: ["Collect Asset/Liability Docs", "Verify Documents", "Draft Certificate", "Finalize Certificate", "Issue Certificate"],
        applicableCategories: ["Individual"]
    },
    {
        id: "ET07",
        name: "Internal Audit",
        description: "Conducting internal audit for companies",
        subTaskTitles: ["Planning", "Fieldwork", "Reporting", "Follow-up"],
        applicableCategories: ["Corporate", "LLP"]
    },
    {
        id: "ET08",
        name: "Book Keeping",
        description: "Maintaining books of accounts",
        subTaskTitles: ["Collect Bank Statements", "Record Transactions", "Bank Reconciliation", "Prepare Financials", "Review"]
    },
    { 
        id: "ET09", 
        name: "ROC Forms", 
        description: "Annual filings with the Registrar of Companies",
        subTaskTitles: ["Prepare Board Resolutions", "Hold Board Meeting", "Draft Annual Report", "File AOC-4", "File MGT-7"],
        applicableCategories: ["Corporate", "LLP"]
    },
];

export const taxRates: Omit<TaxRate, 'id'>[] = [
    { name: 'GST @ 0%', rate: 0 },
    { name: 'GST @ 5%', rate: 5 },
    { name: 'GST @ 12%', rate: 12 },
    { name: 'GST @ 18%', rate: 18, isDefault: true },
];

const getDueDate = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
const getPastDate = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

export const engagements: Omit<Engagement, 'id'>[] = [
    // PENDING (3)
    { clientId: "client1_id_placeholder", remarks: "ITR Filing for FY 2023-24", type: "ET01", assignedTo: ["S006"], reportedTo: "S006", dueDate: getDueDate(10), status: "Pending", fees: 5000 },
    { clientId: "client2_id_placeholder", remarks: "GST Filing for June 2024", type: "ET02", assignedTo: ["S006"], reportedTo: "S006", dueDate: getDueDate(5), status: "Pending", fees: 8000 },
    { clientId: "client3_id_placeholder", remarks: "Book Keeping Q2 2024", type: "ET08", assignedTo: ["S001"], reportedTo: "S001", dueDate: getDueDate(20), status: "Pending", fees: 15000 },

    // IN PROCESS (2)
    { clientId: "client1_id_placeholder", remarks: "Company Audit FY 23-24", type: "ET05", assignedTo: ["S006", "S001"], reportedTo: "S001", dueDate: getDueDate(90), status: "In Process", fees: 50000 },
    { clientId: "client2_id_placeholder", remarks: "Tax Audit FY 23-24", type: "ET04", assignedTo: ["S006"], reportedTo: "S006", dueDate: getDueDate(60), status: "In Process", fees: 75000 },
    
    // COMPLETED (1)
    { clientId: "client3_id_placeholder", remarks: "TDS Filing Q4 FY23", type: "ET03", assignedTo: ["S001"], reportedTo: "S001", dueDate: getPastDate(60), status: "Completed", billStatus: "Collected", fees: 6500 },

];


export const tasks: Omit<Task, 'id' | 'engagementId' | 'assignedTo'>[] = [
    // This is now just a placeholder. The seed script creates tasks based on the subTaskTitles in EngagementType.
    { title: "Placeholder Task", status: "Pending", order: 1 },
];


export const timesheets: Omit<Timesheet, 'id' | 'userName' | 'isPartner'>[] = [
    // Dojo Davis (S006) - Partner
    {
        userId: "S006",
        weekStartDate: "2024-07-22T00:00:00.000Z",
        totalHours: 40,
        entries: [
            { engagementId: "eng_S006_1", hours: 20 }, // ITR Filing
            { engagementId: "eng_S006_2", hours: 10 }, // GST Filing
            { engagementId: "eng_S006_3", hours: 10 }, // Company Audit
        ]
    },
];

// Placeholder mapping for seed script. These IDs will be replaced by actual engagement IDs.
// This is just to make the timesheet data meaningful.
export const engagementIdMapForTimesheet: {[key: string]: {remarks: string}} = {
    "eng_S006_1": { remarks: "ITR Filing for FY 2023-24" },
    "eng_S006_2": { remarks: "GST Filing for June 2024" },
    "eng_S006_3": { remarks: "Company Audit FY 23-24" },
};
