# 🚗 How Far

A modern ride-sharing platform for Zimbabwe with integrated mobile payments.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Expo](https://img.shields.io/badge/Expo-54.0-blue.svg)](https://expo.dev/)
[![React Native](https://img.shields.io/badge/React%20Native-0.81-green.svg)](https://reactnative.dev/)

## 📱 About

How Far connects drivers with available seats to riders heading in the same direction. It's convenient, affordable, and community-driven.

### Key Features

**For Riders:**
- 🔍 Find rides matching your route
- 📱 Book seats with a few taps
- 💳 Pay securely via QR code
- 📍 Real-time trip tracking

**For Drivers:**
- 🚘 Create trips and set fares
- 👥 Accept or decline bookings
- 💰 Receive instant payments
- 📊 Track earnings and manage trips

**Payment Options:**
- ✅ EcoCash
- ✅ OneMoney
- ✅ InnBucks
- ✅ Bank Transfer

---

## 🏗️ Architecture

```
how-far/
├── expo-app/              # React Native mobile app
│   ├── src/
│   │   ├── api/           # API layer (Supabase, PayNow)
│   │   ├── components/    # Reusable UI components
│   │   ├── screens/       # Screen components
│   │   ├── stores/        # Zustand state management
│   │   ├── services/      # Services (announcements)
│   │   ├── context/       # React contexts
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
├── docs/                  # Documentation
│   ├── PRIVACY_POLICY.md
│   ├── TERMS_OF_SERVICE.md
│   ├── APP_STORE_SUBMISSION_GUIDE.md
│   ├── GOOGLE_PLAY_SUBMISSION_GUIDE.md
│   ├── deployment.md
│   └── testing-guide.md
│
└── scripts/               # Deployment scripts
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI
- Supabase CLI
- EAS CLI (for builds)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/how-far.git
cd how-far

# Run setup script (Windows)
.\scripts\setup.ps1

# Or manual setup
cd expo-app
npm install
```

### Environment Configuration

Create `expo-app/.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_PAYNOW_ID=your-merchant-id
EXPO_PUBLIC_PAYNOW_KEY=your-integration-key
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-key
EAS_PROJECT_ID=your-eas-project-id
```

### Development

```bash
cd expo-app
npm start           # Start Expo dev server
npm run android     # Run on Android
npm run ios         # Run on iOS
npm run web         # Run on web
```

---

## 📱 Building for Production

### Using EAS Build

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

### Submit to Stores

```bash
# Submit to Google Play
eas submit --platform android --profile production

# Submit to Apple App Store
eas submit --platform ios --profile production
```

**📖 Detailed Guides:**
- [Google Play Submission Guide](docs/GOOGLE_PLAY_SUBMISSION_GUIDE.md)
- [App Store Submission Guide](docs/APP_STORE_SUBMISSION_GUIDE.md)

---

## 🔧 Backend Deployment

### Supabase Setup

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_ID

# Set secrets
supabase secrets set PAYNOW_CLIENT_KEY=your-key
supabase secrets set PAYNOW_CLIENT_SECRET=your-secret

# Run migrations
supabase db push

# Deploy functions
supabase functions deploy paynowWebhook --no-verify-jwt
supabase functions deploy creditWallet --no-verify-jwt
supabase functions deploy reconcilePayments --no-verify-jwt
```

**📖 Full Guide:** [Deployment Documentation](docs/deployment.md)

---

## 📊 Tech Stack

| Layer | Technology |
|-------|------------|
| Mobile | Expo / React Native |
| State | Zustand |
| Backend | Supabase (PostgreSQL + Edge Functions) |
| Payments | PayNow Zimbabwe |
| Auth | Custom phone + password (users table) |
| Maps | Google Maps / Mapbox |
| CI/CD | GitHub Actions + EAS Build |

---

## 📄 Legal Documents

Required for App Store / Play Store submission:

| Document | Description |
|----------|-------------|
| [Privacy Policy](docs/PRIVACY_POLICY.md) | Data collection and usage |
| [Terms of Service](docs/TERMS_OF_SERVICE.md) | User agreement |

**Note:** Host these documents on a public URL (e.g., howfar.app/privacy) for store submissions.

---

## 📋 Store Submission Checklist

### Before Building

- [ ] Environment variables configured
- [ ] Google Maps API keys obtained
- [ ] PayNow merchant account verified
- [ ] Supabase project configured
- [ ] App icons and splash screens ready

### For Google Play

- [ ] [Read the full guide](docs/GOOGLE_PLAY_SUBMISSION_GUIDE.md)
- [ ] Google Play Developer account ($25)
- [ ] Service account JSON for EAS
- [ ] Feature graphic (1024 x 500)
- [ ] Screenshots (min 2)
- [ ] Privacy Policy URL live
- [ ] Data Safety form completed

### For Apple App Store

- [ ] [Read the full guide](docs/APP_STORE_SUBMISSION_GUIDE.md)
- [ ] Apple Developer account ($99/year)
- [ ] App Store Connect app created
- [ ] Screenshots for all device sizes
- [ ] Privacy Policy URL live
- [ ] Age rating questionnaire completed

---

## 🔐 Security

- Passwords are cryptographically hashed (bcrypt via Supabase)
- All API calls use HTTPS
- Sensitive data encrypted at rest
- Row Level Security on all tables
- JWT tokens for API authentication

---

## 📞 Support

For issues or questions:

- 📧 Email: support@howfar.app
- 🐛 Issues: [GitHub Issues](https://github.com/your-org/how-far/issues)

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file

---

## 👥 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 🙏 Acknowledgments

Built with ❤️ in Zimbabwe

---

**Made by the How Far Team** 🚗
