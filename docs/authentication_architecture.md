# Backend Authentication Architecture (Phase 1 & Phase 2)

This document provides a comprehensive overview of the design patterns, security rules, Redis data models, and routing strategies implemented in the Project Management System's Authentication Module.

---

## 1. System Directory Map

All authentication files are modular and decoupled under `src/`:

```
src/
├── config/
│   ├── database.ts             # MongoDB Mongoose connection handler
│   └── redis.ts                # Redis Client configuration and lifecycle hooks
│
├── controllers/
│   └── auth.controller.ts      # HTTP input parsing, cookie setting, and API output serialization
│
├── services/
│   └── auth.service.ts         # Encapsulates business logic, token rotation, and caching state
│
├── routes/
│   ├── index.ts                # Main API Router (/api/v1)
│   └── auth.routes.ts          # Auth endpoint routes mapping (/api/v1/auth)
│
├── models/
│   └── user.model.ts           # Mongoose User Schema and auto-hashing pre-save hooks
│
├── middleware/
│   ├── auth.middleware.ts      # Access JWT validation and Redis blacklist checking
│   ├── error.middleware.ts     # Global exception caught formatting (MongoDB, CastError, etc.)
│   ├── validate.middleware.ts  # Generic request payload Zod schema checker
│   └── rateLimit.middleware.ts # Custom sliding-window rate-limiter using Redis
│
├── validations/
│   └── auth.validation.ts      # Zod validation rules for registration and login
│
├── utils/
│   ├── ApiError.ts             # Structured class representing operational exceptions
│   ├── ApiResponse.ts          # Uniform wrapper for successful actions
│   ├── asyncHandler.ts         # Decorator to route async errors to error handler
│   ├── jwt.ts                  # Signer and verifier functions for JWT tokens
│   ├── password.ts             # Password utility wrapping Bcrypt (Salt factor: 12)
│   └── constants.ts            # Global cookie settings and token expiration times
│
├── types/
│   └── express.d.ts            # Declaration-merging to extend Express Request object
│
└── sockets/
    └── auth.socket.ts          # Stateless Socket.IO handshake authentication middleware
```

---

## 2. Redis Caching Strategy

To optimize database lookups and prevent token hijacking, Redis is used in five distinct contexts:

### A. Active Refresh Session Cache
- **Key Schema**: `session:{userId}:{sessionId}`
- **Value**: JSON string containing session metadata and token details:
  ```json
  {
    "sessionId": "UUID",
    "userId": "String (UUID)",
    "ip": "String (Client IP)",
    "userAgent": "String",
    "browser": "String",
    "os": "String",
    "device": "String",
    "lastActive": "ISO String",
    "createdAt": "ISO String",
    "refreshToken": "Plain Rotating Refresh Token",
    "currentAccessToken": "Current Active JWT Access Token"
  }
  ```
- **TTL**: `604800 seconds` (7 days)
- **Flow**: During login, a unique `sessionId` (UUID) is generated and embedded in the refresh token and access token payloads. The session details are stored in Redis under the `session:{userId}:{sessionId}` key. During `/refresh-token` requests, the token is decoded statelessly, and the corresponding Redis key is queried. If the refresh token matches, the session is rotated (old deleted, new generated and set). MongoDB is bypassed for active session validation unless there is a Redis cache miss.

### B. Access Token Blacklist
- **Key Schema**: `blacklist:{accessToken}`
- **Value**: `"logged_out"` or `"revoked"`
- **TTL**: Dynamic (Equal to the remaining duration of the Access Token's 15-minute lifespan: `exp - now()`)
- **Flow**: When a user logs out, or when a user rotates their tokens via `/refresh-token`, the old access token is immediately added to the Redis blacklist with a TTL equal to its remaining lifespan. Any subsequent request attempting to use a blacklisted token is rejected with HTTP 401 Unauthorized (`"Token has been revoked or invalidated. Please log in again."`).

### C. Refresh Token Blacklist
- **Key Schema**: `blacklist:refresh:{plainRefreshToken}`
- **Value**: `"logged_out"` or `"rotated"`
- **TTL**: `604800 seconds` (7 days)
- **Flow**: When a user logs out or rotates their refresh token, the old refresh token is recorded into the blacklist. If an attacker or stale client attempts to reuse a blacklisted refresh token, the server immediately rejects the request with HTTP 401 Unauthorized and flags potential token reuse.

### D. Global User Revocation Timestamp ("Logout All")
- **Key Schema**: `user:revoked_before:{userId}`
- **Value**: Epoch timestamp in seconds (`Math.floor(Date.now() / 1000)`)
- **TTL**: `900 seconds` (15 minutes, matching the maximum lifespan of any active access token)
- **Flow**: When a user logs out with `all: true`, this timestamp is stored in Redis. The `protect` middleware compares the JWT `iat` (issued at) claim against this timestamp. Any token issued prior to global logout is instantly rejected across all devices without needing individual token strings.

### E. Rate Limiter Tracker
- **Key Schema**: `rate-limit:auth:{clientIp}`
- **Value**: Incremental count
- **TTL**: `900 seconds` (15 minutes sliding/fixed window)
- **Flow**: Incremented on every request to `/api/v1/auth/*`. Returns an HTTP 429 error if the count exceeds 100 requests within 15 minutes.

---

## 3. Real-Time Security (Socket.IO Handshake)

Socket.IO connections are authenticated during the initial handshake stage.

- **File**: `backend/src/sockets/auth.socket.ts`
- **Handshake Logic**:
  1. Reads the token from `socket.handshake.auth.token` or headers.
  2. Verifies the token signature statelessly with **0 database lookups**.
  3. Attaches the parsed payload (ID, email, username) directly onto `socket.user`.
  4. If invalid or expired, rejects the handshake with `Authentication error`.

---

## 4. API Specification & Payloads

### A. Registration (`POST /api/v1/auth/signup`)
- **Validation**:
  - `name`: String (2-50 chars)
  - `username`: Lowercase, alphanumeric/underscore (3-30 chars, unique)
  - `email`: Valid lowercase email (unique)
  - `password`: String (6-128 chars)
- **Logic**: Registers user in MongoDB. Password is encrypted automatically in Mongoose schema pre-save hook using bcrypt (work factor: 12).
- **Success Response (201)**: Returns user profile (password stripped).

### B. Login (`POST /api/v1/auth/login`)
- **Validation**:
  - `emailOrUsername`: String
  - `password`: String
- **Logic**: Validates credentials. Sets `refreshToken` as an HTTP-only, secure, sameSite `'strict'` cookie. Returns `accessToken` in body. Caches session in Redis with `currentAccessToken`.
- **Swagger UI Integration**: The access token returned in the response is automatically intercepted by Swagger UI and injected into the Bearer Authorization header.

### C. Token Refresh (`POST /api/v1/auth/refresh-token`)
- **Logic**:
  1. Inspects the cookie `refreshToken` (or optional request body fallback).
  2. Checks Redis `blacklist:refresh:{token}` to ensure the refresh token is not revoked.
  3. Statelessly verifies signature and retrieves active session from Redis.
  4. **Immediate Invalidation of Old Access Token**:
     - The previous access token stored in the Redis session (`sessionData.currentAccessToken`) is blacklisted with remaining TTL.
     - If the client passed an old access token in `Authorization: Bearer <oldToken>`, that token is also blacklisted.
  5. **Refresh Token Blacklisting**: The old refresh token is blacklisted in Redis (`blacklist:refresh:...`) with a 7-day TTL.
  6. Rotates the session, issues a fresh JWT Access Token and Refresh Token, and updates the cookie and Redis session.
  7. **Swagger UI Sync**: Automatically updates the Bearer token in Swagger UI.

### D. Logout (`POST /api/v1/auth/logout`)
- **Authorization**: Requires Bearer Access Token in header.
- **Request Body** (optional):
  ```json
  {
    "all": boolean,          // If true, terminates all active sessions for the user
    "sessionId": string     // ID of a specific session to terminate
  }
  ```
- **Logic**:
  1. **Access Token Blacklist**: Blacklists the current access token in Redis (`blacklist:<token>`) for its remaining TTL.
  2. **Refresh Token Blacklist**: Blacklists the refresh token in Redis (`blacklist:refresh:<token>`) for 7 days.
  3. **Global Revocation**: If `all: true`, deletes all Redis sessions `session:{userId}:*`, clears all MongoDB refresh tokens, and writes `user:revoked_before:{userId}` (15 min TTL) to invalidate tokens on all other devices.
  4. **Single Session Logout**: Deletes `session:{userId}:{sessionId}` from Redis and MongoDB.
  5. Clears the HTTP-only cookie.
  6. **Swagger UI Clear**: Automatically triggers `authActions.logout(['BearerAuth'])` in Swagger UI and clears `localStorage`.

### E. Get Current Profile (`GET /api/v1/auth/profile`)
- **Authorization**: Requires Bearer Access Token in header.
- **Verification Flow**:
  1. Validates that the token is present in the `Authorization` header.
  2. Queries Redis `blacklist:<token>`. If found, throws `401 Unauthorized: "Token has been revoked or invalidated. Please log in again."`.
  3. Verifies JWT signature and expiry.
  4. Checks `user:revoked_before:<userId>`. If issued before revocation, throws `401 Unauthorized`.
  5. If `sessionId` is in token, verifies session existence in Redis. If expired or logged out, throws `401 Unauthorized`.
  6. Attaches user profile to `req.user` and proceeds to route handler.

---

## 5. Swagger UI Automated Authentication Synchronization

To streamline developer experience and API testing in Swagger UI:
- **Interception Mechanism**: In `backend/src/config/swagger.ts`, an auto-invoking script is served at `/api/v1/docs/swagger-auth-sync.js` and injected inline into Swagger UI via `customJs` and `customJsStr`.
- **Login Auto-Authorize**: Intercepts `POST /api/v1/auth/login` (HTTP 200). Extracts `response.data.accessToken` and invokes `window.ui.authActions.authorize({ BearerAuth: { value: token } })`.
- **Refresh Auto-Update**: Intercepts `POST /api/v1/auth/refresh-token` (HTTP 200) and updates the Bearer authorization with the new access token.
- **Logout Auto-Clear**: Intercepts `POST /api/v1/auth/logout` (HTTP 200), invokes `window.ui.authActions.logout(['BearerAuth'])`, and removes credentials from `localStorage`.

---

## 6. Global Error Payload Structure

All exceptions flow through `error.middleware.ts` and return standard client structures:

```json
{
  "success": false,
  "message": "Clean Error Message Description",
  "errors": [],
  "stack": null
}
```
- In `development` mode, `stack` contains the error stack trace.
- In `production` mode, `stack` is set to `null` and general errors are masked to prevent data leaks.
- Captures MongoDB duplicate constraints (`code 11000`), casting issues, validation failures, and Redis token invalidations.
