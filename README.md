# WiseIn Backend - Verified Social Network Platform

> A comprehensive user authentication and onboarding system for a social networking platform with genuine/verified profiles and authentic people.

## 🎯 Overview

WiseIn is a social networking platform that prioritizes authenticity through a rigorous verification process. The platform ensures all users are genuinely verified through:

- **Email Verification** with OTP
- **ID Verification** (DigiLocker for Indians, Stripe Identity for others)
- **Video Verification** with profile picture extraction
- **Admin Approval** for quality control
- **Subscription System** with Stripe integration

Users can then engage in:
- Social networking with verified profiles
- 1-on-1 calls with AI summaries
- Job posting and applications
- Company management
- Content creation and engagement

## ✨ Key Features

- ✅ Complete user onboarding flow (7 steps)
- ✅ Multi-method ID verification (DigiLocker & Stripe Identity)
- ✅ Video verification with auto profile picture extraction
- ✅ Admin approval workflow with dashboard
- ✅ Stripe subscription management
- ✅ JWT-based authentication with refresh tokens
- ✅ Role-based access control
- ✅ 23+ API endpoints
- ✅ Comprehensive documentation

- ✅ 23+ API endpoints
- ✅ Comprehensive documentation

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18
- PostgreSQL >= 13
- FFmpeg
- npm >= 9

### Installation

```bash
# 1. Install dependencies
npm install

# 2. Setup database
createdb wisein_db

# 3. Configure environment
cp .env.example .env
# Edit .env with your configuration

# 4. Run migrations
npx prisma migrate dev --name init

# 5. Start development server
npm run start:dev
```

The API will be running at `http://localhost:3000`

## 📖 Documentation

- **[Setup Guide](./SETUP_GUIDE.md)** - Detailed installation and configuration
- **[API Reference](./API_REFERENCE.md)** - Complete API documentation
- **[Onboarding Guide](./ONBOARDING_GUIDE.md)** - User onboarding flow
- **[System Architecture](./SYSTEM_ARCHITECTURE.md)** - System design and flow diagrams
- **[Database Schema](./prisma/schema.prisma)** - Database structure

## 🔄 7-Step User Onboarding Flow

```
1. Signup (Email + Password)
   ↓
2. OTP Verification
   ↓
3. Country Selection
   ↓
4. ID Verification (DigiLocker or Stripe Identity)
   ↓
5. Video Verification (with auto profile pic extraction)
   ↓
6. Admin Approval
   ↓
7. Subscription & Platform Access
```

## 📊 API Endpoints (23 total)

| Category | Count | Key Endpoints |
|----------|-------|---------------|
| Authentication | 5 | signup, login, verify-otp, refresh-token |
| Onboarding | 2 | select-country, onboarding-status |
| ID Verification | 5 | digilocker/*, stripe-identity/* |
| Video | 1 | upload-video |
| Subscription | 4 | plans, select-plan, current, cancel |
| Admin | 4 | users/pending, users/:id, approve, reject |
| Webhooks | 2 | stripe, razorpay |

## 🛠️ Commands

```bash
# Development
npm run start:dev              # Start with watch mode
npm run start:debug           # Start with debugger

# Database
npx prisma studio                     # Open database UI
npx prisma migrate dev --name <name>  # Create migration

# Testing
npm test                      # Run tests
npm run test:watch           # Watch mode
npm run test:cov             # With coverage

# Code Quality
npm run lint                 # Check lint errors
npm run format               # Format code
```

## 🗄️ Technology Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | NestJS |
| **Database** | PostgreSQL + Prisma ORM |
| **Authentication** | JWT + Passport.js |
| **Payment** | Stripe & Razorpay |
| **ID Verification** | DigiLocker & Stripe Identity |
| **Video Processing** | FFmpeg |
| **Email** | SendGrid / Nodemailer |

## 🧪 Testing with cURL

```bash
# Signup
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123",
    "name": "Test User"
  }'

# Verify OTP
curl -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "otp": "123456"
  }'
```

See [API_REFERENCE.md](./API_REFERENCE.md) for complete examples.

## 📁 Project Structure

```
src/
├── auth/                 # Authentication module (OTP, JWT, subscription)
├── admin/               # Admin approval system
├── prisma/              # Database service
└── app.module.ts        # Root module

prisma/
├── schema.prisma        # Database schema (10+ models)
└── migrations/          # Database migrations
```

## 🔐 Environment Configuration

```bash
# Required variables
DATABASE_URL              # PostgreSQL connection string
JWT_SECRET               # JWT signing key
STRIPE_SECRET_KEY        # Stripe API key
SENDGRID_API_KEY         # SendGrid API key
DIGILOCKER_CLIENT_ID     # DigiLocker OAuth credentials
```

See `.env.example` for complete configuration.

## 💡 Key Features

### Authentication
- Email signup with OTP verification
- JWT-based login with refresh tokens
- Password hashing with bcrypt
- Role-based access control

### Verification
- DigiLocker for Indian users
- Stripe Identity for international users
- Video upload with frame extraction
- Admin approval workflow

### Payments
- Stripe checkout integration
- Subscription management
- Webhook handling
- Razorpay support (optional)

## 📈 Deployment Checklist

- [ ] Update JWT_SECRET
- [ ] Configure production database
- [ ] Setup Stripe production keys
- [ ] Configure SendGrid
- [ ] Setup AWS S3 for file storage
- [ ] Enable HTTPS
- [ ] Configure rate limiting
- [ ] Setup monitoring/logging

## 🤝 Contributing

1. Create a feature branch
2. Make changes
3. Run tests
4. Submit a pull request

## 📞 Support

For issues or questions:
1. Check the documentation files
2. Review [SETUP_GUIDE.md](./SETUP_GUIDE.md#troubleshooting) troubleshooting section
3. Check console logs

## 📚 Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Stripe API Docs](https://stripe.com/docs/api)
- [Passport.js Guide](http://www.passportjs.org/)

## ✅ Project Status

- ✅ Core onboarding system
- ✅ Database schema
- ✅ Authentication flow
- ✅ ID verification
- ✅ Video processing
- ✅ Admin approval
- ✅ Subscription system
- ✅ API documentation
- 🔄 Frontend application (in progress)

---

**Version**: 1.0.0  
**Last Updated**: November 12, 2025  
**License**: UNLICENSED
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).

## Docker / Compose (optional)

This backend includes a Dockerfile (`./Dockerfile`) and a `docker-compose.yml` in this folder that brings up a Postgres database and the backend service. This makes it easy to push just the `backend/` folder and run it in isolation.

Quick start (from the `backend/` folder):

```bash
cd backend
docker-compose up --build
```

What happens:
- The `db` service (Postgres) is started and persisted to a Docker volume named `db_data`.
- The `backend` service is built using the multistage `Dockerfile`. The build runs `npx prisma generate` and `npm run build` in the builder stage and the runtime image contains the compiled `dist` and generated Prisma client.

Notes & next steps:
- The compose file sets `DATABASE_URL` to point to the `db` service; edit `backend/docker-compose.yml` if you need different credentials.
- Migrations are not automatically applied. After the database is available you can run migrations locally or from the container using:

```bash
# From host (recommended):
npx prisma migrate deploy --preview-feature

# OR run inside the backend container (after `docker-compose up`):
docker-compose exec backend npx prisma migrate deploy --preview-feature
```

- If you change the Prisma schema, re-run `npx prisma generate` (or rebuild the image) so the generated client matches the schema.

