# Map-Engine V3 Supabase schema

This folder contains only V3 database objects and tests. It does not touch
legacy Uber Engine tables or provide an Uber V2 bridge.

## Apply order

1. Apply `migrations/20260917000100_v3_uber_schema.sql` (the approved baseline).
2. Apply `migrations/20260918000100_v3_plan_day_weights.sql` to add constrained
   daily weights and their controlled RPCs.
3. Apply `migrations/20260918000200_v3_weight_rpc_grants.sql` to remove the
   platform's explicit anonymous/service-role execute grants from those new RPCs.
4. Run both `tests/20260917000100_v3_uber_schema.pgtap.sql` (24 assertions)
   and `tests/20260918000100_v3_plan_day_weights.pgtap.sql` (13 assertions)
   against a database with pgTAP enabled. Each test script rolls back its
   fixture transaction.

## Ownership and RLS

The schema requires Supabase Auth. Persistent rows are owned by `auth.uid()`;
clients can read only their own rows and must use the controlled RPC functions
for writes. Clients never provide `owner_id`.

## Calendar and values

- `week_start` is Monday and calendar dates are interpreted by the application
  in `Europe/London`.
- GBP values use `numeric(12,2)`.
- Business mileage uses `numeric(10,1)`.
- A positive target with zero working days is valid. Daily targets are then
  unavailable and remain derived, never stored.
- `is_working = false` means OFF; enabled days have LIGHT, NORMAL, or HEAVY
  weight. Changing a plan does not rewrite actual day records.
