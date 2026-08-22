<div align="center">

# 🎓 TimhirtHub — School Management Platform

**A full-stack SaaS school management platform connecting Students · Teachers · Parents · Administrators**

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-Vercel-black?style=for-the-badge&logo=vercel)](https://timihrt-hub-school-management-syste.vercel.app/login)
[![API](https://img.shields.io/badge/⚙️_API-Render-46E3B7?style=for-the-badge&logo=render&logoColor=white)](https://timhirthub-api.onrender.com/health)

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](#-license)

**[🚀 Try the Live App](https://timihrt-hub-school-management-syste.vercel.app/login)** · **[📖 API Health Check](https://timhirthub-api.onrender.com/health)** · **[🐛 Report Bug](../../issues)** · **[✨ Request Feature](../../issues)**

</div>

---

> ⚠️ **Note:** The backend is hosted on Render's free tier, which spins down after inactivity. The **first request may take 30–60 seconds** to wake the server — please be patient on first load.

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
git clone https://github.com/nabas444/TimihrtHub-School-Management-System.git
cd TimihrtHub-School-Management-System
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

## 🌐 Live Deployment

| Layer        | URL                                                                                                                        | Host   |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- | ------ |
| **Frontend** | [timihrt-hub-school-management-syste.vercel.app](https://timihrt-hub-school-management-syste.vercel.app/login)             | Vercel |
| **Backend**  | [timhirthub-api.onrender.com](https://timhirthub-api.onrender.com)                                                          | Render |
| **Health**   | [timhirthub-api.onrender.com/health](https://timhirthub-api.onrender.com/health)                                           | Render |

---

## 🔐 Demo Login Credentials

Use the credentials below on the [live demo](https://timihrt-hub-school-management-syste.vercel.app/login) or your local setup:

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

## ☁️ Deploying Your Own Instance

This repo includes a [`render.yaml`](./render.yaml) blueprint for one-click backend deployment:

- **Backend (Render):** New + → Blueprint → point at this repo → Render provisions the web service + PostgreSQL database automatically from `render.yaml`.
- **Frontend (Vercel):** Import this repo → set **Root Directory** to `apps/web` → set `VITE_API_URL` to your Render API URL → Deploy.

For full step-by-step instructions (env vars, Redis setup, CORS config), see the [Environment Variables](#-environment-variables) section below.

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
