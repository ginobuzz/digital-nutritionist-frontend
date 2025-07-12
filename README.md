# Digital Nutritionist AI - Frontend Application

A React-based frontend application for the Digital Nutritionist AI, an AI-powered weight-loss coach that guides users to their goal weight through personalized meal planning, real-time logging, and motivational feedback.

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
- **Mock Data**: Simulated backend APIs for demonstration purposes

## 🛠️ Technology Stack

- **React 18** with TypeScript
- **Material-UI (MUI)** for UI components
- **React Router** for navigation
- **Recharts** for data visualization
- **Mock APIs** for backend simulation

## 📦 Installation

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

## 🏗️ Project Structure

```
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
  height: number;
  weight: number;
  gender: 'male' | 'female';
  activityLevel: ActivityLevel;
  targetWeight: number;
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

### Deploy Options
- **Netlify**: Drag and drop `build` folder
- **Vercel**: Connect repository for automatic deployment
- **AWS S3**: Upload build files to S3 bucket
- **Heroku**: Deploy with Node.js buildpack

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
