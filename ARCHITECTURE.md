# DMV Central Application Architecture

This document outlines the high-level architecture and data flow of the DMV Central application.

## Logic Flowchart

```mermaid
graph TD
    subgraph "User Interaction"
        A[User visits the app] --> B{Is user authenticated?};
        B -- No --> C[Display Login Page `/login`];
        C --> D{User signs in w/ Google};
        D --> E[Check email against 'employees' in Firestore];
        E -- Not found --> F[Deny access, show error];
        E -- Found --> G[Redirect to Dashboard `/dashboard`];

        B -- Yes --> G;

        G --> H[App Layout `/app/layout.tsx`];
    end

    subgraph "Authenticated Experience"
        H --> I{Fetch User Profile & Permissions};
        I --> J[Render Sidebar with allowed links];
        J --> K[User navigates to a page, e.g., Dashboard];

        K -- Fetches data for --> L[Dashboard Page `/dashboard`];
        L --> M[Display Widgets: Status Cards, To-Do, Workload];
        M -- Data comes from --> N[Engagements, Clients, Employees collections];

        J --> O[User navigates to Clients Page `/clients`];
        O --> P[Client Manager displays all clients in a data table];
        P --> Q[User can Create/Update/Delete clients];
        Q -- Modifies --> N;

        J --> R[User navigates to Workspace `/workspace`];
        R --> S[Display user's assigned engagements];
        S --> T[User can update engagement status/due date];
        T -- Modifies --> N;

        J --> U[User navigates to Partner View `/partner-view`];
        U --> V{Is user a Partner?};
        V -- Yes --> W[Display firm-wide engagement data];
        V -- No --> X[Show Access Denied];
    end

    subgraph "Data & Services"
        subgraph "NoSQL Database (Current)"
            Y[Firebase Firestore]
        end
        subgraph "Relational Database (New)"
            DB[Relational DB e.g., Postgres]
        end

        N -- Stored in --> Y;
        
        SERVICES[App Services]
        SERVICES --> Y
        SERVICES --> DB


        Z[Firebase Authentication]
        D -- Uses --> Z;
        B -- Checks against --> Z;
    end

    subgraph "Initial Setup"
        SEED_LINK[User navigates to `/seed`] --> SEED_PAGE[Seed Page];
        SEED_PAGE --> SEED_ACTION{User clicks 'Seed Database'};
        SEED_ACTION --> SEED_LOGIC[Write initial data to Firestore];
        SEED_LOGIC --> Y;
    end

    style F fill:#fecaca,stroke:#b91c1c,stroke-width:2px
    style X fill:#fecaca,stroke:#b91c1c,stroke-width:2px
```

## Key Concepts

1.  **Authentication**: Handled via Firebase Authentication (Google Sign-In). Access is restricted to users whose email exists in the `employees` collection in Firestore.
2.  **Authorization**: Feature access is controlled by a permissions system. The `app-layout-client` fetches the current user's department/role and checks it against the `permissions` collection in Firestore to determine which navigation links to show.
3.  **Data Fetching**: Most pages are client-side rendered (`"use client";`). They use `useEffect` hooks and Firebase's `onSnapshot` listener to get real-time data from Firestore. This makes the UI reactive to database changes.
4.  **Component Structure**:
    *   **`/app`**: Contains the main page layouts and routing.
    *   **`/components`**: Contains reusable UI components, categorized by feature (e.g., `dashboard`, `client`, `workspace`) and the general `ui` library (ShadCN components).
    *   **`/lib`**: Holds utility functions (`utils.ts`), Firebase configuration (`firebase.ts`), and the core data type definitions (`data.ts`).
    *   **`/hooks`**: Contains custom React hooks, such as `useAuth` for authentication state and `useToast` for notifications.
5.  **State Management**: Local component state is managed with `useState` and `useReducer`. Global authentication state is managed via `useAuth` and React Context. Complex state related to tables or forms is handled by libraries like TanStack Table and React Hook Form.
