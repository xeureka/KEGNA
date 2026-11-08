# ZOLA mobile app

This Expo app is the mobile workspace for sales and accountant users. Admin
and storekeeper users are directed to the ZOLA web dashboard.

The app uses the single static ZOLA configuration, email/password sign-in,
Better Auth Expo storage, and the inventory API under `/api/v1`.

## Development

Run the API and Metro in separate terminals:

```bash
pnpm --filter zola-back-end dev
pnpm --filter mobile start
```

Set `EXPO_PUBLIC_API_URL` to the backend origin without `/api`; both mobile
clients append their API paths from this one value. For Expo Go on a physical
device, set it in `apps/mobile/.env` to `http://<computer-LAN-IP>:3001`. Android emulators use
`http://10.0.2.2:3001`; iOS simulators can use `http://localhost:3001`.

The API must listen on `0.0.0.0:3001`, and the phone and computer must be on
the same network. Open the API URL in the phone browser first to verify LAN
reachability.

The chat list polls while focused and foregrounded. Open conversations poll
for new events and mark the thread read. Native push notifications are not
configured; polling is the current MVP behavior.
