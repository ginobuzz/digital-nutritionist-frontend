# Digital Nutritionist AI

A full-stack Digital Nutritionist app: a React/TypeScript frontend plus a FastAPI backend in `digital-nutritionist-backend/`.

## 🎯 Overview

The Digital Nutritionist is designed to help users achieve their weight loss goals through:

- **Plan vs Reality Tracking**: Users plan their meals and then log what they actually ate
- **AI Coach Chat**: Conversational interface for logging meals and getting encouragement
- **Calorie Deficit Monitoring**: Real-time tracking of calorie deficits toward weight loss goals
- **Activity Logging**: Track exercise and activities to adjust calorie balance
- **Progress Visualization**: Charts and metrics showing weight loss progress

## 🚀 Features

### Core Features
- **Dashboard**: Overview of daily progress, calorie deficits, and weight loss journey
- **My Plan**: Schedule and manage planned meals for upcoming days
- **My Reality**: Log actual meals consumed and activities performed
- **Chat Coach**: AI-powered conversational interface for meal logging and support
- **Profile Management**: User profile, goals, and progress tracking

### Key Functionality
- **Calorie Calculations**: Mifflin-St Jeor BMR calculation with activity multipliers
- **Weight Loss Tracking**: Progress visualization and milestone tracking
- **Responsive Design**: Mobile-friendly interface with Material-UI components
- **Chat Continuity**: Chat history is retained locally per user (browser `localStorage`)
- **Voice Dictation**: Mic button for voice-to-text in chat + “describe” inputs (browser support varies; Chrome/Edge recommended)
- **Mock Data**: Simulated backend APIs for demonstration purposes

## 🛠️ Technology Stack

- **React 18** with TypeScript
- **Material-UI (MUI)** for UI components
- **React Router** for navigation
- **Recharts** for data visualization
- **FastAPI (Python)** backend (see `digital-nutritionist-backend/`)
- **SQLModel** + SQLite/Postgres for persistence

## 📦 Installation

### Full stack (Docker Compose)
```bash
docker compose -f docker-compose.dev.yml up --build
```
- Frontend: `http://localhost:3000`
- Backend docs: `http://localhost:8000/docs`

## ✅ Testing

### Frontend unit tests
```bash
npm run test:ci
```

### Backend unit tests
```bash
cd digital-nutritionist-backend
python -m pip install -e ".[dev]"
python -m pytest
```

### Automated checks
- Local: Git hooks run tests on `pre-commit`/`pre-push` (via Husky + lint-staged).
- CI: GitHub Actions runs frontend + backend tests on pushes/PRs and gates deploys.

### Frontend only
1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd digital-nutritionist-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to `http://localhost:3000`

### API smoke test (requires backend running)
```bash
npm run test:api
```

### Full workflow smoke test (requires backend running)
Covers: signup/login, profile update, meal/planned/activity/weight CRUD, chat meal logging, logout + re-login.
```bash
npm run test:smoke
```
Notes:
- Override API base URL with `REACT_APP_API_BASE_URL`.
- Skip chat (if `OPENAI_API_KEY` isn’t set) with `DN_SMOKE_REQUIRE_CHAT=0`.
- Skip cleanup with `DN_SMOKE_KEEP_DATA=1`.

## 🏗️ Project Structure

```
digital-nutritionist-backend/  # FastAPI backend
docs/                          # Architecture / planning docs
scripts/                       # Helper scripts
src/
├── components/          # React components
│   ├── Layout.tsx      # Main layout with navigation
│   ├── Dashboard.tsx   # Main dashboard view
│   ├── Plan.tsx        # Meal planning interface
│   ├── Reality.tsx     # Actual meal/activity logging
│   ├── Chat.tsx        # AI coach chat interface
│   └── Profile.tsx     # User profile management
├── types/              # TypeScript type definitions
│   └── index.ts        # All application types
├── utils/              # Utility functions
│   └── calculations.ts # Calorie and weight loss calculations
├── data/               # Mock data and APIs
│   └── mockData.ts     # Simulated backend data
└── App.tsx             # Main application component
```

## 🎨 UI/UX Design

### Design Principles
- **Clean & Modern**: Material Design principles with custom theming
- **Mobile-First**: Responsive design that works on all devices
- **Intuitive Navigation**: Clear navigation with visual feedback
- **Progress Visualization**: Charts and progress indicators for motivation

### Color Scheme
- **Primary**: Blue (#2196f3) - Trust and reliability
- **Secondary**: Orange (#ff9800) - Energy and motivation
- **Success**: Green (#4caf50) - Progress and achievement
- **Background**: Light gray (#f5f5f5) - Clean and neutral

## 📊 Data Models

### User Profile
```typescript
interface User {
  id: string;
  name: string;
  age: number;
  height: {
    feet: number;
    inches: number;
  };
  weight: number; // in lbs
  gender: 'male' | 'female';
  activityLevel: ActivityLevel;
  targetWeight: number; // in lbs
  targetDate: Date;
  dailyCalorieTarget: number;
  dailyDeficitTarget: number;
}
```

### Meal Tracking
```typescript
interface PlannedMeal {
  id: string;
  name: string;
  calories: number;
  time: Date;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  description?: string;
  isPlanned: true;
}

interface ActualMeal {
  id: string;
  name: string;
  calories: number;
  time: Date;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  description?: string;
  isPlanned: false;
  actualCalories?: number;
  notes?: string;
}
```

## 🔧 Configuration

### Environment Variables
Currently using mock data. For production, you would need:
- API endpoints for backend integration
- Authentication tokens
- Environment-specific configurations

### Customization
- **Theme**: Modify `theme` object in `App.tsx`
- **Mock Data**: Update `mockData.ts` for different scenarios
- **Calculations**: Adjust formulas in `calculations.ts`

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Native iOS app (Capacitor) — “Sunday Mornings”

Prereqs:
- macOS + Xcode
- CocoaPods (optional; only needed if you add plugins that require it)
- Apple ID (free works; installs expire after ~7 days)

Sync iOS to hosted-web mode + open the iOS project:
```bash
npm install
npm run ios
```

Switch iOS back to bundled mode + open Xcode (optional fallback):
```bash
npm run ios:bundled
```

Fast refresh of bundled iOS web assets (without opening Xcode):
```bash
npm run ios:refresh
```

Sideload to your iPhone (via Xcode):
1. Xcode opens `ios/App/App.xcworkspace`
2. Select target **App** → **Signing & Capabilities** → pick your **Team**
3. Plug in your phone, select it as the run destination, press **Run (▶)**

Notes:
- The iOS target bundle id is currently `com.sundaymorningsios.app` (change it in Xcode if you need a unique one).
- `npm run ios` now configures Capacitor iOS to load the hosted frontend URL (`https://glockstock.github.io/digital-nutritionist-frontend`) via `server.url`.
- After the app is installed once from Xcode, FE-only changes no longer need an Xcode rebuild. Push to `initial-build`, wait for the GitHub Pages workflow to finish, then relaunch the app.
- Use `npm run build:cap` + bundled sync (`npm run ios:refresh` or `npm run ios:bundled`) only if you want offline/local bundled assets.
- To point the hosted frontend at your hosted backend, set `REACT_APP_API_BASE_URL` to your Render service base URL (must be `https://...`) in `.env.production` (or `.env.production.local`) and push to `initial-build`.
- If iOS appears stale after deploy, fully close and reopen the app first. If needed, in Xcode use **Product → Clean Build Folder** and reinstall once.
- Your backend should allow both origins for CORS when you use both modes: `https://glockstock.github.io` and `capacitor://localhost`.
- The app icon is generated from `public/favicon.png` via `assets/icon.png`. To regenerate:
  ```bash
  sips -z 1024 1024 public/favicon.png --out assets/icon.png
  npx capacitor-assets generate --ios --assetPath assets --iconBackgroundColor "#ffffff"
  npm run ios:icons
  npm run cap:sync:ios
  ```

### iOS Home Screen Widget (Calories + Quick Log)

The iOS project includes a `DailyCaloriesWidget` extension that shows today's calorie progress and quick actions for:
- `Voice` log
- `Camera` log
- `Text` log

Setup in Xcode (required once per signing profile):
1. Open `ios/App/App.xcodeproj` (or workspace) in Xcode.
2. Select target **App** → **Signing & Capabilities**:
   - Ensure your Team is selected.
   - Add capability **App Groups** and include `group.com.sundaymorningsios.app.shared`.
3. Select target **DailyCaloriesWidget** → **Signing & Capabilities**:
   - Ensure the same Team is selected.
   - Add capability **App Groups** and include `group.com.sundaymorningsios.app.shared`.
4. Build/run once on device.
5. Long-press the home screen, add widget **Calories Widget**, choose size, and place it.

Important for testing:
- If your iOS app is in hosted-web mode (`npm run ios`), widget deep-link behavior and widget-data sync depend on whatever frontend is currently deployed to GitHub Pages.
- For immediate local verification of widget changes, use bundled mode instead: `npm run ios:bundled`.

How it works:
- The app syncs today's `consumedCalories` and `targetCalories` into a shared app-group store.
- The widget reads from that store and refreshes timelines.
- Widget actions deep-link into `/log` with mode-specific launch params.

### Free Deploy (GitHub Pages + Render)
This repo is already set up to deploy the frontend to GitHub Pages via `gh-pages` and run the backend as a FastAPI service.

1. **Deploy the backend (Render)**
   - Create a Render **Web Service** from this GitHub repo.
   - Set **Root Directory** to `digital-nutritionist-backend`
   - Set **Build Command** to `pip install -r requirements.txt`
   - Set **Start Command** to `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Add env vars (at minimum): `APP_ENV=beta`, `OPENAI_API_KEY`, `JWT_SECRET_KEY`, `ALLOWED_ORIGINS` (include `https://glockstock.github.io`), and `DATABASE_URL` (Neon Postgres, include `?sslmode=require`)
   - Verify: `https://<your-service>.onrender.com/health` returns `{"status":"ok"}`
   - Verify DB: `https://<your-service>.onrender.com/health/db` returns `{"status":"ok"}`

2. **Point the frontend at the backend**
   - Edit `.env.production` and set `REACT_APP_API_BASE_URL` to your Render URL, e.g. `https://<your-service>.onrender.com`

3. **Deploy the frontend (GitHub Pages)**
   - Automatic: every push to `initial-build` runs `.github/workflows/deploy.yml` and publishes the latest frontend.
   - Manual fallback:
     ```bash
     npm run deploy
     ```

4. **Open on mobile**
   - Visit `https://glockstock.github.io/digital-nutritionist-frontend/` on your phone and “Add to Home Screen”.

### Other Deploy Options
- **Vercel**: Connect repository for automatic frontend deploy (set `REACT_APP_API_BASE_URL` in Vercel env vars)
- **Netlify**: Drag and drop `build/` (or connect repo) (set `REACT_APP_API_BASE_URL` in env vars)

## 🔮 Future Enhancements

### Phase 2 Features
- **Real Backend Integration**: Replace mock APIs with actual backend
- **Photo Food Logging**: AI-powered food recognition from photos
- **Apple Health/Google Fit Integration**: Automatic activity tracking
- **Voice Calling**: AI coach voice interactions
- **Community Features**: User forums and support groups

### Advanced AI Features
- **Personalized Meal Suggestions**: AI-generated meal recommendations
- **Macronutrient Optimization**: Advanced nutrition planning
- **Behavioral Insights**: Pattern recognition and habit analysis
- **Predictive Analytics**: Weight loss trajectory predictions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Material-UI** for the excellent component library
- **Recharts** for beautiful data visualization
- **React Router** for seamless navigation
- **TypeScript** for type safety and developer experience

## 📞 Support

For questions or support, please open an issue in the repository or contact the development team.

---

**Digital Nutritionist AI** - Making weight loss easier and more human through AI-powered coaching.
