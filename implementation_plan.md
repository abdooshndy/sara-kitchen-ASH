# Implementation Plan - Role-Based Access Control (RBAC) System

## Goal
Implement a complete user system with distinct roles: **Admin**, **Cook** (Chef), **Driver**, and **Customer**.
- **Staff Roles**: Admin, Cook, Driver (RBAC with specific permissions).
- **Customer Role**: Login with Phone/Password, Loyalty Points System.

## User Review Required
> [!IMPORTANT]
> **Database Reset/Migration**: This plan requires creating a new `profiles` table and linking it to Supabase Auth. You will need to run the updated SQL script.
> **Phone Authentication**: To support "Phone + Password" without an SMS provider, we will use a "Pseudo-Email" strategy (e.g., `010xxxxxxxxx@sara.app`) behind the scenes.

## Proposed Architecture

### 1. Database Schema (Supabase)
- **New Table**: `profiles`
    - `id`: references `auth.users.id` (Primary Key)
    - `role`: Enum (`admin`, `cook`, `driver`, `customer`)
    - `full_name`: Text
    - `phone`: Text (Unique)
    - `address`: Text (Optional)
    - `points`: Integer (Default 0) - *For Loyalty System*
    - `created_at`: Timestamp
- **RLS Policies**:
    - **Admin**: Full access.
    - **Cook**: View/Update Orders.
    - **Driver**: View/Update Assigned Orders.
    - **Customer**: View own profile and orders.
- **Triggers**:
    - `on_auth_user_created`: Automatically create a profile.
    - `add_loyalty_points`: When order status becomes `DELIVERED`, calculate points (e.g., 1 point per 10 EGP) and add to customer profile.

### 2. Frontend Logic
- **`auth-guard.js`**: Handles access control for all roles.
- **`auth-customer.js`**: Handles Customer Login/Register logic (Phone -> Email conversion).

### 3. New Components
- **Staff Dashboards**: `kitchen-dashboard.html`, `driver-dashboard.html`, `admin-dashboard.html`.
- **Customer Pages**:
    - `customer-login.html`: Login (Phone + Password).
    - `customer-register.html`: Register (Name, Phone, Password, Address).
    - `profile.html`: View Points and Personal Info.

## Proposed Changes

### Database
#### [MODIFY] [supabase_setup.sql](file:///home/abdoosh/Downloads/sara-kitchen-platform-main/supabase_setup.sql)
- Add `profiles` table definition with `points`.
- Add trigger to create profile on user signup.
- Add function/trigger for Loyalty Points calculation.
- Define granular RLS policies for all roles.

### Shared Utilities
#### [NEW] [auth-guard.js](file:///home/abdoosh/Downloads/sara-kitchen-platform-main/auth-guard.js)
- Exports `requireRole(allowedRoles)` function.

#### [NEW] [auth-customer.js](file:///home/abdoosh/Downloads/sara-kitchen-platform-main/auth-customer.js)
- Helper functions for Customer Auth.

### Dashboards & Pages
#### [MODIFY] [admin-dashboard.html](file:///home/abdoosh/Downloads/sara-kitchen-platform-main/admin-dashboard.html)
- Integrate `auth-guard.js`.

#### [MODIFY] [driver-dashboard.html](file:///home/abdoosh/Downloads/sara-kitchen-platform-main/driver-dashboard.html)
- Integrate `auth-guard.js`.

#### [NEW] [kitchen-dashboard.html](file:///home/abdoosh/Downloads/sara-kitchen-platform-main/kitchen-dashboard.html)
- Dashboard for cooks.

#### [NEW] [customer-login.html](file:///home/abdoosh/Downloads/sara-kitchen-platform-main/customer-login.html)
- Customer Login Page.

#### [NEW] [customer-register.html](file:///home/abdoosh/Downloads/sara-kitchen-platform-main/customer-register.html)
- Customer Registration Page.

#### [NEW] [profile.html](file:///home/abdoosh/Downloads/sara-kitchen-platform-main/profile.html)
- Customer Profile (Points, Order History).

#### [NEW] [kitchen.js](file:///home/abdoosh/Downloads/sara-kitchen-platform-main/kitchen.js)
- Logic for fetching 'PENDING'/'PREPARING' orders.

## Verification Plan
### Manual Verification
1.  **Setup**: Run the new SQL script.
2.  **Staff Flow**:
    - Create Admin, Cook, Driver users.
    - Verify access control for each dashboard.
3.  **Customer Flow**:
    - Register a new customer (Phone + Password).
    - Login.
    - Place an order.
    - Verify points increase after order is marked `DELIVERED` by driver.
