# Sara Kitchen Platform - Implementation Walkthrough

This document outlines the changes made to the Sara Kitchen Platform and provides instructions for verification.

## 1. Supabase Setup (Critical)
Before testing, you must execute the SQL commands in `supabase_setup.sql` in your Supabase SQL Editor.
- **File:** `supabase_setup.sql`
- **Action:** Copy content -> Paste in Supabase SQL Editor -> Run.
- **Purpose:** Creates `profiles` table, `generate_order_code` function, and RLS policies for RBAC.

## 2. Staff Dashboards (RBAC)
Access is now restricted by role. You must create users and assign roles in the `profiles` table manually (or via SQL) for testing staff.
- **Roles**: `admin`, `cook`, `driver`.
- **Admin**: `admin-login.html` -> `admin-dashboard.html` (Full Access).
- **Driver**: `driver-login.html` -> `driver-dashboard.html` (Assigned Orders).
- **Cook**: `admin-login.html` (or direct link) -> `kitchen-dashboard.html` (Pending/Preparing Orders).

## 3. Customer Experience (New)
- **Registration**: `customer-register.html` (Name, Phone, Password, Address).
- **Login**: `customer-login.html` (Phone + Password).
- **Profile**: `profile.html` (View Loyalty Points & Order History).
- **Ordering**:
    - Login first.
    - Go to `cart.html`.
    - Name/Phone/Address are auto-filled.
    - Place order.
    - **Loyalty Points**: Earn 1 point per 10 EGP when order is marked `DELIVERED`.

## 4. Code Changes
- **`auth-guard.js`**: Protects staff pages.
- **`auth-customer.js`**: Handles customer login/register (Phone -> Pseudo-Email).
- **`kitchen.js`**: Logic for Kitchen Dashboard.
- **`supabase_setup.sql`**: Complete schema update.

## Verification Steps
1.  **Run SQL**: Execute `supabase_setup.sql`.
2.  **Staff Setup**:
    - Sign up a user for Admin. In Supabase `profiles` table, set role to `admin`.
    - Sign up a user for Cook. Set role to `cook`.
    - Sign up a user for Driver. Set role to `driver`.
3.  **Customer Flow**:
    - Register as a new customer (`customer-register.html`).
    - Login (`customer-login.html`).
    - Place an order in `cart.html`.
    - Check `profile.html` -> Points should be 0.
4.  **Order Fulfillment**:
    - **Cook**: Login, see order in `kitchen-dashboard.html`, move to `PREPARING` -> `WITH_DRIVER`.
    - **Driver**: Login, see order in `driver-dashboard.html`, move to `DELIVERED`.
5.  **Loyalty Check**:
    - Refresh `profile.html` as customer. Points should have increased.
