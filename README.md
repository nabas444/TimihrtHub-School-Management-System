# TimhirtHub — School Management Platform

> A full-stack SaaS school management platform connecting **Students · Teachers · Parents · Administrators**

---

## 🏗️ Architecture

```
timhirthub/
├── apps/
│   ├── web/          React 18 + Vite frontend
│   └── server/       Node.js + Express + TypeScript backend
├── docker-compose.yml
└── package.json      Monorepo root
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose
- Git

### 1. Clone & install

```bash
git clone https://github.com/yourorg/timhirthub.git
cd timhirthub
npm install
```

### 2. Configure environment

```bash
cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env with your keys
```

### 3. Start infrastructure

```bash
docker-compose up postgres redis -d
```

### 4. Setup database

```bash
npm run db:migrate    # run Prisma migrations
npm run db:seed       # seed demo school + 4 role users
```

### 5. Start development

```bash
npm run dev           # starts both server (5000) + web (3000)
```

Open http://localhost:3000

---

## 🔐 Demo Login Credentials

| Role    | Email                  | Password    |
| ------- | ---------------------- | ----------- |
| Admin   | admin@demoschool.edu   | password123 |
| Teacher | teacher@demoschool.edu | password123 |
| Student | student@demoschool.edu | password123 |
| Parent  | parent@demoschool.edu  | password123 |

---

## ✨ Features

### 📚 Academic Management

- Class & grade level structure
- Subject assignments with teachers
- Homework & assignment creation, submission, grading
- Exam scheduling, result entry, grade computation
- Term-based grade reports with GPA calculation
- Timetable builder with conflict detection

### 📋 Tracking & Monitoring

- Daily attendance marking with bulk tools
- Attendance alerts to parents via Socket.IO
- Behaviour records — merits, demerits, incidents
- Student progress trends and analytics

### 💬 Communication

- Real-time chat (Socket.IO) — DMs & group rooms
- Typing indicators, read receipts, emoji reactions
- Announcement board (targeted by role/class)
- Parent-teacher meeting booking system
- Push notifications + email queue (BullMQ)

### 💰 Finance

- Fee invoice generation (bulk or individual)
- Payment recording (cash, bank transfer, Stripe)
- Financial overview dashboard
- Overdue fee detection + parent alerts

### 📖 Library

- Book catalogue with availability tracking
- Issue & return workflow with fine calculation
- Overdue reports

### 👥 Staff & HR

- Teacher directory with subject assignments
- Leave request workflow (submit → approve/reject)
- Payroll records

### 🤖 AI Features

- OpenAI-powered student performance analysis
- Risk level detection (LOW/MEDIUM/HIGH)
- Personalised study recommendations
- AI chatbot for students and parents

### 💳 SaaS Billing

- Free / Basic / Standard / Enterprise plans
- Stripe checkout + subscription management
- Webhook handling for lifecycle events
- Customer billing portal

---

## 🛠️ Tech Stack

| Layer        | Technology                                                       |
| ------------ | ---------------------------------------------------------------- |
| Frontend     | React 18, React Router v6, TanStack Query, Zustand, Tailwind CSS |
| Backend      | Node.js, Express, TypeScript                                     |
| Database     | PostgreSQL 16 via Prisma ORM                                     |
| Cache/Queues | Redis + BullMQ                                                   |
| Real-time    | Socket.IO                                                        |
| Auth         | JWT (access + refresh tokens), bcrypt                            |
| AI           | OpenAI GPT-4o-mini                                               |
| Payments     | Stripe                                                           |
| Email        | Nodemailer / Resend                                              |
| CI/CD        | GitHub Actions                                                   |
| Deploy       | Docker, Render (API), Vercel (Web)                               |

---

## 🌐 API Reference

Base URL: `http://localhost:5000/api/v1`

### Auth

```
POST /auth/register          Register new school + admin
POST /auth/login             Login (all roles)
POST /auth/refresh           Refresh access token
POST /auth/logout            Logout
GET  /auth/me                Get current user
POST /auth/password/request-reset
POST /auth/password/reset
POST /auth/password/change
```

### Key modules

```
GET|POST   /users
GET|POST   /academics/assignments
GET|POST   /academics/exams
GET        /academics/results
GET|POST   /attendance
GET        /behaviour
GET|POST   /chat/rooms
GET        /chat/rooms/:id/messages
GET|POST   /announcements
GET|POST   /meetings
GET|POST   /fees
GET|POST   /library
GET|POST   /staff/teachers
GET|POST   /staff/leave
GET        /ai/insights/me
POST       /ai/chat
GET        /billing/subscription
POST       /billing/checkout
GET        /schools/dashboard
GET        /schools/profile
PATCH      /schools/settings
GET        /notifications
```

---

## 🔌 Socket.IO Events

| Event              | Direction       | Description             |
| ------------------ | --------------- | ----------------------- |
| `chat:send`        | Client → Server | Send a message          |
| `chat:message`     | Server → Client | New message broadcast   |
| `chat:typing`      | Client → Server | Typing indicator        |
| `chat:read`        | Client → Server | Mark room as read       |
| `chat:react`       | Client → Server | Add emoji reaction      |
| `notification:new` | Server → Client | Real-time notification  |
| `announcement:new` | Server → Client | New school announcement |
| `presence:online`  | Server → Client | User came online        |
| `presence:offline` | Server → Client | User went offline       |

---

## 🐳 Docker Production

```bash
# Build and run everything
docker-compose up --build -d

# View logs
docker-compose logs -f server

# Run migrations in container
docker-compose exec server npx prisma migrate deploy
```

---

## 📁 Environment Variables

See `apps/server/.env.example` for the full list. Key variables:

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_ACCESS_SECRET=...
JWT_REFRESH_SECRET=...
OPENAI_API_KEY=sk-...
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
SMTP_HOST=smtp.resend.com
EMAIL_FROM=noreply@timhirthub.com
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
CLOUDINARY_FOLDER=timhirthub
```

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit: `git commit -m 'feat: add my feature'`
4. Push: `git push origin feature/my-feature`
5. Open a Pull Request

---

## 📄 License

MIT © TimhirtHub
