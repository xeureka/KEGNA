# Mobile development networking

## White-label tenant onboarding

1. Set `EXPO_PUBLIC_TENANT_ID` and `EXPO_PUBLIC_TENANT_SLUG` in the build's
   `.env`. During normal Metro development, the API host is derived from
   Expo's `hostUri`, so no developer IP is required.
2. Set `EXPO_PUBLIC_API_URL` only for production/EAS builds or tunnel-based
   development.
3. The app loads the tenant name, logo, and brand color from
   `/api/v1/auth/branding` and caches them in SecureStore (or browser storage)
   for the next launch.
4. Only update `apps/mobile/config/tenant.config.ts` for static clinic content
   that is not owned by the backend, such as the fallback address, support
   details, default appointment copy, or feature flags.

Components consume the resolved tenant config; they do not contain clinic-
specific names, contact details, addresses, or colors.

Every mobile API request and Better Auth client uses the same runtime resolver.
In Metro development it uses the Expo bundler host with port `3001`; in
production or tunnel mode it uses the explicit `EXPO_PUBLIC_API_URL` override.
Do not add a second URL in a screen or service.

For production or tunnel builds, set it in `apps/mobile/.env`:

| Test target        | `EXPO_PUBLIC_API_URL`         |
| ------------------ | ----------------------------- |
| Production/EAS     | `https://<production-api>`    |
| Tunnel development | `https://<public-api-tunnel>` |

For a physical device, Android emulator, or iOS simulator in normal Metro
development, leave `EXPO_PUBLIC_API_URL` unset. Expo determines the host.

The API must be running on `0.0.0.0:3001` for LAN devices. Confirm reachability
from the phone browser before opening Expo Go:

```text
http://<computer-lan-ip>:3001/api/v1/auth/branding?tenantSlug=<tenant-slug>
```

Start the API and Expo separately:

```bash
pnpm --filter back-end dev
pnpm --filter mobile start
```

If Expo advertises a different address than the computer's Wi-Fi address,
select the Wi-Fi address explicitly before starting Metro. On Windows
PowerShell, use the IPv4 address shown by `ipconfig` for the active Wi-Fi
adapter:

```powershell
$env:REACT_NATIVE_PACKAGER_HOSTNAME = "<computer-lan-ip>"
pnpm --filter mobile start
```

Metro uses port `8081`; the backend uses port `3001`. Both ports must be allowed
through the computer's firewall on the Private network profile. The phone and
computer must use the same non-guest Wi-Fi network, and the router must allow
client-to-client traffic. A quick phone-browser check for the API is:

```text
http://<computer-lan-ip>:3001/api/v1/auth/branding?tenantSlug=<tenant-slug>
```

The phone and computer must be on the same Wi-Fi for LAN mode. If they are on
different networks, expose both Metro and the API through reachable HTTPS
tunnels; changing only the Expo QR URL is not enough because the API URL must
also be reachable from the phone.

## Chapa checkout

The mobile app calls only the authenticated back-end payment endpoints. Chapa
keys and webhook secrets belong only in `apps/back-end/.env`. The app opens the
hosted checkout and returns through the back-end's HTTPS bridge, which redirects
to the tenant's existing `nexa-<tenant-slug>://payment-return` scheme. Test that
return on an Expo development/EAS build with the native scheme installed; Expo
Go does not install each tenant's custom scheme. No new mobile secret or
payment-specific environment variable is needed.
