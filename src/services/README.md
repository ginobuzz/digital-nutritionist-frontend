# API Services

This directory contains the API service layer that connects the frontend to the FastAPI backend.

## Files

- `api.ts` - Main API service with user and weight log endpoints
- `README.md` - This documentation file

## Backend Integration

By default the frontend points to the local FastAPI backend started from the sibling `digital-nutritionist-backend` folder:
`http://localhost:8000`

Override the base URL with the `REACT_APP_API_BASE_URL` environment variable when running against a different backend host.

## API Endpoints

### Users
- `POST /users/` - Create a new user
- `GET /users/{user_id}` - Get user by ID
- `PUT /users/{user_id}` - Update user
- `DELETE /users/{user_id}` - Delete user

### Weight Logs
- `GET /users/{user_id}/weight-logs` - Get weight logs for a user
- `POST /weight-logs/` - Create a new weight log
- `PUT /weight-logs/{log_id}` - Update weight log
- `DELETE /weight-logs/{log_id}` - Delete weight log

## Data Conversion

The API service includes helper functions to convert between frontend and backend data formats:

- `convertUserToBackend()` - Converts frontend User object to backend format
- `convertUserFromBackend()` - Converts backend UserResponse to frontend format
- `convertWeightLogFromBackend()` - Converts backend WeightLogResponse to frontend format

## Usage

```typescript
import { apiService } from '../services/api';

// Create a user
const userData = convertUserToBackend(user);
const createdUser = await apiService.createUser(userData);
const frontendUser = convertUserFromBackend(createdUser);

// Get weight logs
const weightLogs = await apiService.getWeightLogs(userId);
const frontendLogs = weightLogs.map(convertWeightLogFromBackend);
```

## Error Handling

The API service includes comprehensive error handling with try-catch blocks and user-friendly error messages displayed in the UI. 