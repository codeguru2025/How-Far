# 🚗 Ndeip-Zthin

A modern ride-hailing platform for Zimbabwe with integrated mobile payments.

## 🏗️ Architecture

```
ndeip-zthin/
├── expo-app/              # React Native mobile app
│   ├── src/
│   │   ├── api/           # API layer (Supabase, PayNow)
│   │   ├── components/    # Reusable UI components
│   │   ├── screens/       # Screen components
│   │   ├── stores/        # Zustand state management
│   │   ├── theme/         # Colors, spacing, fonts
│   │   └── utils/         # Utility functions
│   └── App.tsx            # Entry point
│
├── supabase/
│   ├── functions/         # Edge Functions
│   │   ├── paynowWebhook/ # Payment webhook handler
│   │   ├── creditWallet/  # Wallet credit API
│   │   └── reconcilePayments/
│   └── migrations/        # Database migrations
│
├── scripts/               # Deployment scripts
└── .github/workflows/     # CI/CD pipelines
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- Supabase CLI
- EAS CLI (for builds)

### Setup

```powershell
# Clone and setup
git clone https://github.com/your-org/ndeip-zthin.git
cd ndeip-zthin
.\scripts\setup.ps1

# Configure environment
cp expo-app/.env.example expo-app/.env
# Edit .env with your credentials

# Start development
cd expo-app
npm start
```

### Environment Variables

Create `expo-app/.env` with:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_PAYNOW_ID=your-merchant-id
EXPO_PUBLIC_PAYNOW_KEY=your-integration-key
```

## 📱 Building for Production

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for Android
cd expo-app
eas build --platform android --profile production

# Build for iOS
eas build --platform ios --profile production
```

## 🔧 Deployment

### Deploy Supabase Functions

```powershell
.\scripts\deploy.ps1 prod
```

Or manually:

```bash
cd ndeip-zthin
supabase functions deploy paynowWebhook --no-verify-jwt
supabase functions deploy creditWallet --no-verify-jwt
supabase functions deploy reconcilePayments --no-verify-jwt
```

### GitHub Secrets Required

For CI/CD, set these in your GitHub repo settings:

| Secret | Description |
|--------|-------------|
| `EXPO_TOKEN` | Expo access token |
| `SUPABASE_ACCESS_TOKEN` | Supabase CLI token |
| `SUPABASE_PROJECT_ID` | Your Supabase project ID |

## 💳 Payment Integration

Supports Zimbabwe mobile payments via PayNow:
- ✅ EcoCash
- ✅ OneMoney
- ✅ InnBucks
- ✅ Bank Transfer

## 📊 Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile | Expo / React Native |
| State | Zustand |
| Backend | Supabase (PostgreSQL + Edge Functions) |
| Payments | PayNow Zimbabwe |
| Auth | Custom phone + password |
| CI/CD | GitHub Actions + EAS Build |

## 📄 License

MIT License - see LICENSE file

## 👥 Team

Built with ❤️ in Zimbabwe
