# TaxFlow: AI-Powered CA Firm Management Platform

TaxFlow is a comprehensive, full-stack web application designed to modernize and streamline the complete operational workflow of a chartered accountancy firm. It provides a centralized system for managing clients, engagements, team workload, and administrative tasks, leveraging AI to automate processes and provide intelligent insights.

![DMV Central Dashboard](https://placehold.co/1200x600.png)
*A placeholder image - consider replacing this with a screenshot of your actual application dashboard.*

---

## ✨ Key Features

This platform is built to address the core challenges of a modern accounting practice, focusing on efficiency, collaboration, and data-driven decision-making.

*   **🤖 AI-Enhanced Productivity:**
    *   **Email Processor:** Automatically analyzes, summarizes, and categorizes incoming client emails, generating actionable to-do items for the assigned team.
    *   **Engagement Scheduler:** Intelligently assigns new work in bulk based on natural language prompts (e.g., "distribute equally") and current team capacity.
    *   **Invoice Generator:** Produces professional, GST-compliant HTML invoices from completed engagement data.
    *   **Performance Reviewer:** Analyzes monthly timesheet data to flag hour deficits and budget overruns, creating summary tasks for partners.

*   **⚙️ Automated Workflow & Task Management:**
    *   Dynamic workflow system with customizable status tracking.
    *   Automated task checklist creation based on the type of engagement (e.g., ITR Filing, Statutory Audits).
    *   Kanban-style board for visualizing and managing the entire firm's workload.

*   **📊 Dashboards & Reporting:**
    *   **Personalized Dashboards:** Role-based views for employees, managers, and partners, showing relevant KPIs, tasks, and alerts.
    *   **Firm Analytics:** A dedicated dashboard for partners to monitor high-level KPIs like Client Lifetime Value (CLV), Monthly Recurring Revenue (MRR), and team profitability.
    *   **Comprehensive Reports:** Generate detailed, filterable reports for engagements, billing, collections, and exceptions (e.g., overdue work, incomplete client data).

*   **🗂️ Centralized Client & Team Hub:**
    *   A unified workspace for each client, providing a 360-degree view of all active engagements, historical data, and a "Permanent File" for long-term notes.
    *   Complete client and employee master data management.
    *   Role-based access control (RBAC) to manage feature permissions by department.

---

## 🚀 Tech Stack

*   **Framework:** [Next.js](https://nextjs.org/) (with App Router)
*   **Language:** [TypeScript](https://www.typescriptlang.org/)
*   **Styling:** [Tailwind CSS](https://tailwindcss.com/)
*   **UI Components:** [ShadCN UI](https://ui.shadcn.com/)
*   **Database & Backend:** [Firebase](https://firebase.google.com/) (Firestore, Authentication, Cloud Functions)
*   **Artificial Intelligence:** [Google's Genkit](https://firebase.google.com/docs/genkit) with Gemini Models
*   **Tables & Data Grids:** [TanStack Table](https://tanstack.com/table/v8)
*   **State Management:** React Context API & Hooks

---

## 🏁 Getting Started

Follow these instructions to get a local copy up and running.

### Prerequisites

*   Node.js (v18 or newer recommended)
*   npm or yarn
*   A Firebase project with Firestore and Authentication enabled.

### Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/your-repo-name.git
    cd your-repo-name
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Firebase:**
    *   Create a `.env` file in the root of the project.
    *   Add your Firebase project's service account key as a single-line JSON string to the `.env` file:
        ```
        FIREBASE_SERVICE_ACCOUNT='{ "type": "service_account", "project_id": "...", ... }'
        ```
    *   Update the client-side Firebase configuration in `src/lib/firebase.ts` with your own project's config object.

4.  **Seed the Database:**
    To populate Firestore with initial data (employees, engagement types, etc.), run the seed script.
    ```bash
    npm run seed
    ```

5.  **Run the Development Server:**
    ```bash
    npm run dev
    ```

The application should now be running on [http://localhost:9002](http://localhost:9002).

---

## 🏗️ System Architecture

For a detailed look at the application's structure, data flow, and key concepts, please see the [Architecture Document](./ARCHITECTURE.md).

---

## 📄 License

This project is licensed under the MIT License. See the `LICENSE` file for details.
