# TeamFlow - Sprint Management SaaS Backend

A production-grade, multi-tenant Sprint & Project Management SaaS backend built with **Node.js**, **Express**, **TypeScript**, **MongoDB**, and **Redis**.

---

## Table of Contents
- [Tech Stack](#tech-stack)
- [System Architecture](#system-architecture)
- [API Documentation (Swagger / OpenAPI)](#api-documentation-swagger--openapi)
  - [Interactive Swagger UI](#interactive-swagger-ui)
  - [OpenAPI Specification JSON](#openapi-specification-json)
  - [Authentication & Session Flow](#authentication--session-flow)
  - [How to Authorize with JWT in Swagger UI](#how-to-authorize-with-jwt-in-swagger-ui)
  - [Testing Public vs Protected Endpoints](#testing-public-vs-protected-endpoints)
- [Environment Configuration](#environment-configuration)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation & Setup](#installation--setup)
  - [Running with Docker Compose](#running-with-docker-compose)
  - [Running Locally](#running-locally)
- [Extending API Documentation](#extending-api-documentation)

---

## Tech Stack
- **Runtime & Language**: Node.js, TypeScript (ES2022, NodeNext resolution)
- **Web Framework**: Express 5
- **Databases**: MongoDB (Mongoose), Redis (Redis v6 client)
- **Validation**: Zod
- **Real-Time**: Socket.IO
- **Security**: JWT (`jsonwebtoken`), Bcrypt, Redis sliding-window rate limiter
- **API Documentation**: OpenAPI 3.0.3, `swagger-ui-express`, `swagger-jsdoc`

---

## API Documentation (Swagger / OpenAPI)

TeamFlow includes interactive, production-grade OpenAPI 3.0.3 documentation powered by Swagger UI.

### Interactive Swagger UI
When the backend is running, access the interactive documentation at:
- **Development Swagger UI**: [http://localhost:5000/api/docs](http://localhost:5000/api/docs)
- **Convenience Redirect**: [http://localhost:5000/docs](http://localhost:5000/docs) *(automatically redirects to `/api/docs`)*

### OpenAPI Specification JSON
The raw, standardized OpenAPI 3.0.3 JSON schema is available for frontend code generation, Postman, and CI/CD pipelines:
- **OpenAPI JSON Spec**: [http://localhost:5000/api/docs.json](http://localhost:5000/api/docs.json)

---

### Authentication & Session Flow

The platform enforces a dual-token security model with multi-device session management:

```
┌─────────────────┐                                  ┌─────────────────────────┐
│     Client      │                                  │     Backend / Redis     │
└────────┬────────┘                                  └────────────┬────────────┘
         │                                                        │
         │─── 1. POST /api/v1/auth/signup ───────────────────────>│ (Hashes pwd, creates user)
         │<── Returns 201 Created (User Profile) ─────────────────│
         │                                                        │
         │─── 2. POST /api/v1/auth/login ────────────────────────>│ (Validates credentials)
         │                                                        │ (Caches session in Redis)
         │<── Returns 200 OK + accessToken (15m JWT) ─────────────│
         │    + Set-Cookie: refreshToken (7d HttpOnly, SameSite) ─│
         │                                                        │
         │─── 3. GET /api/v1/auth/profile ───────────────────────>│ (Checks Redis blacklist,
         │    Header: Authorization: Bearer <accessToken>         │  verifies JWT signature)
         │<── Returns 200 OK (User Profile) ──────────────────────│
         │                                                        │
         │─── 4. POST /api/v1/auth/refresh-token ────────────────>│ (Validates Redis session,
         │    Cookie: refreshToken=<token>                        │  rotates token, updates cookie)
         │<── Returns 200 OK + new accessToken ───────────────────│
         │    + Set-Cookie: new rotated refreshToken ─────────────│
         │                                                        │
         │─── 5. POST /api/v1/auth/logout ───────────────────────>│ (Blacklists accessToken in Redis,
         │    Header: Authorization: Bearer <accessToken>         │  deletes session from Redis,
         │    Body: { all?: boolean, sessionId?: string }         │  clears HttpOnly cookie)
         │<── Returns 200 OK (Logged Out Sessions List) ──────────│
```

---

### How to Authorize with JWT in Swagger UI

To test protected endpoints in Swagger UI:

1. **Register or Login**:
   - Scroll down to the **Authentication** tag.
   - Click `POST /api/v1/auth/login` (or `/api/v1/auth/signup`).
   - Click **Try it out**, enter your credentials, and click **Execute**.
2. **Copy the Access Token**:
   - In the response body, locate `data.accessToken` and copy the JWT string (without quotes).
3. **Open the Authorize Modal**:
   - Click the green **Authorize** (lock icon) button located at the top-right of the Swagger UI page.
4. **Submit Token**:
   - In the `BearerAuth` input field, enter:
     ```text
     Bearer <your_copied_token>
     ```
     *(or simply paste your raw JWT token)*.
   - Click **Authorize**, then click **Close**.
5. **Execute Protected APIs**:
   - All protected endpoints (e.g. `GET /api/v1/auth/profile`, `GET /api/v1/auth/sessions`, `POST /api/v1/auth/logout`) now send the `Authorization: Bearer <token>` header automatically.
   - The token is persisted across page refreshes.

---

### Testing Public vs Protected Endpoints

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/health` | Public | System health check |
| `POST` | `/api/v1/auth/signup` | Public | Register new user account |
| `POST` | `/api/v1/auth/register` | Public | Register alias endpoint |
| `POST` | `/api/v1/auth/login` | Public | Authenticate user, receive JWT and HttpOnly cookie |
| `POST` | `/api/v1/auth/refresh-token` | Public / Cookie | Rotate access token via `refreshToken` HttpOnly cookie |
| `GET` | `/api/v1/auth/profile` | **Protected (Bearer JWT)** | Fetch current authenticated user's profile |
| `GET` | `/api/v1/auth/me` | **Protected (Bearer JWT)** | Profile alias endpoint |
| `GET` | `/api/v1/auth/sessions` | **Protected (Bearer JWT)** | List active multi-device sessions from Redis |
| `POST` | `/api/v1/auth/logout` | **Protected (Bearer JWT)** | Invalidate session(s) and blacklist access token |

---

## Environment Configuration

All settings are managed via environment variables. See `backend/.env.example` for the complete reference:

```env
# Network Configuration
PORT=5000
NODE_ENV=development
CORS_ORIGIN=*

# Database & Cache
MONGODB_URI=mongodb://localhost:27017/sprint-management
REDIS_URL=redis://localhost:6379

# Authentication & JWT
JWT_SECRET=development_jwt_secret_teamflow_super_key_2026
ACCESS_TOKEN_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d
REFRESH_TOKEN_COOKIE_NAME=refreshToken

# Swagger / OpenAPI Documentation
SWAGGER_ENABLED=true
SWAGGER_ROUTE=/api/docs
SWAGGER_SERVER_URL=http://localhost:5000
API_TITLE=TeamFlow API
API_VERSION=1.0.0
API_DESCRIPTION=Production-grade Sprint & Project Management SaaS API Documentation

# SendGrid & Notifications Configuration
SENDGRID_API_KEY=SG.your_api_key_here
SENDGRID_FROM_EMAIL=notifications@teamflow.internal
SENDGRID_FROM_NAME=TeamFlow Sprint Manager
ADMIN_EMAILS=admin@teamflow.internal
APP_URL=http://localhost:3000
```

---

## Architectural Deep-Dives
- [Authentication & Multi-Device Session Architecture](docs/authentication_architecture.md)
- [Project & Workspace Management Architecture](docs/project_workspace.md)
- [In-App Notifications & SendGrid Email Architecture](docs/notifications_and_emails.md)

---

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended, v24 supported)
- [MongoDB](https://www.mongodb.com/) (running on port 27017)
- [Redis](https://redis.io/) (running on port 6379)
- *(Optional)* [Docker & Docker Compose](https://www.docker.com/)

### Running with Docker Compose
To start MongoDB, Redis, and the backend service all at once:
```bash
docker-compose up --build
```

### Running Locally
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment configuration:
   ```bash
   cp .env.example .env
   ```
4. Start development server with live reload:
   ```bash
   npm run dev
   ```
5. Open Swagger UI at [http://localhost:5000/api/docs](http://localhost:5000/api/docs).

---

## Extending API Documentation

The documentation is modular and designed to scale to 35–40+ APIs without editing existing routes:

1. **Schemas**: Add schemas under `src/docs/schemas/<module>.schema.ts` (e.g., `workspace.schema.ts`, `task.schema.ts`).
2. **Paths**: Add endpoint definitions under `src/docs/routes/<module>.docs.ts` (e.g., `workspace.docs.ts`, `task.docs.ts`).
3. **Register**: Export and spread into `src/docs/routes/index.ts`:
   ```typescript
   export const apiPaths = {
     ...healthDocs,
     ...authDocs,
     ...workspaceDocs, // New module added cleanly
     ...taskDocs,      // New module added cleanly
   };
   ```
This guarantees separation of concerns, zero clutter in route controllers, and full type safety across documentation components.