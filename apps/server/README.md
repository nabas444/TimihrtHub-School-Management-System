# TimhirtHub — Backend API

Node.js + Express + TypeScript REST API for the TimhirtHub timhirthub connect portal.

## Tech Stack
- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Express 4
- **Database**: PostgreSQL 16 via Prisma ORM
- **Cache / Queues**: Redis + BullMQ
- **Real-time**: Socket.IO
- **Auth**: JWT (access + refresh tokens) + bcrypt
- **AI**: OpenAI API
- **Payments**: Stripe
- **Email**: Nodemailer / Resend

## Getting Started

### 1. Install dependencies
```bash
cd apps/server
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Start infrastructure (Postgres + Redis)
```bash
# From project root
docker-compose up postgres redis -d
```

### 4. Run migrations and seed
```bash
npm run prisma:migrate   # creates tables
npm run prisma:generate  # generates Prisma client
npm run prisma:seed      # seeds demo school + 4 role users
```

### 5. Start dev server
```bash
npm run dev
# Server running at http://localhost:5000
```

## API Endpoints

### Auth (public)
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/v1/auth/register` | Register new school + admin |
| POST | `/api/v1/auth/login` | Login (any role) |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Logout |
| GET  | `/api/v1/auth/me` | Get current user |
| POST | `/api/v1/auth/password/request-reset` | Request password reset |
| POST | `/api/v1/auth/password/reset` | Reset password |
| POST | `/api/v1/auth/password/change` | Change password |

### Health
```
GET /health
```

## Demo Credentials (after seed)
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@demoschool.edu | password123 |
| Teacher | teacher@demoschool.edu | password123 |
| Student | student@demoschool.edu | password123 |
| Parent | parent@demoschool.edu | password123 |

## Multi-Tenancy
Every database record is scoped to a `schoolId`. The `tenantGuard` middleware automatically enforces this — no cross-school data leakage is possible.

## Socket.IO Events
| Event | Direction | Description |
|-------|-----------|-------------|
| `chat:send` | Client → Server | Send a message |
| `chat:message` | Server → Client | New message broadcast |
| `chat:typing` | Client → Server | Typing indicator |
| `chat:read` | Client → Server | Mark messages read |
| `chat:react` | Client → Server | Add emoji reaction |
| `presence:online` | Server → Client | User came online |
| `presence:offline` | Server → Client | User went offline |
