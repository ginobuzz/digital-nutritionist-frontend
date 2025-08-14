// Test API connection and user creation
const API_BASE_URL = 'https://sundaymornings-backend-297759956270.europe-west1.run.app';

async function testApiConnection() {
  try {
    console.log('Testing API connection...');
    
    // Test 1: Check if the API is accessible
    const healthResponse = await fetch(`${API_BASE_URL}/docs`);
    console.log('Health check response:', healthResponse.status, healthResponse.statusText);
    
    // Test 2: Check what endpoints are available
    try {
      const openapiResponse = await fetch(`${API_BASE_URL}/openapi.json`);
      if (openapiResponse.ok) {
        const openapi = await openapiResponse.json();
        console.log('Available paths:', Object.keys(openapi.paths));
      }
    } catch (e) {
      console.log('Could not fetch OpenAPI spec');
    }
    
    // Test 3: Try with minimal required fields only
    console.log('\n=== Testing with minimal required fields ===');
    const minimalUserData = {
      email: 'minimal@example.com',
      password: 'password123'
    };
    
    console.log('Sending minimal user data:', minimalUserData);
    
    const minimalResponse = await fetch(`${API_BASE_URL}/users/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors',
      credentials: 'omit',
      body: JSON.stringify(minimalUserData)
    });
    
    console.log('Minimal user response:', minimalResponse.status, minimalResponse.statusText);
    
    if (minimalResponse.ok) {
      const createdUser = await minimalResponse.json();
      console.log('Minimal user created successfully:', createdUser);
    } else {
      const errorText = await minimalResponse.text();
      console.log('Minimal user error response:', errorText);
    }
    
    // Test 4: Try with our full user data
    console.log('\n=== Testing with full user data ===');
    const fullUserData = {
      email: 'test.user@example.com',
      password: 'password123',
      first_name: 'Test',
      last_name: 'User',
      age: 30,
      gender: 'male',
      activity_level: 'moderately_active',
      height_in: 70,
      starting_weight_lb: 160,
      goal_weight_lb: 150,
      goal_weight_date: '2024-06-01',
      daily_calorie_budget: 2000
    };
    
    console.log('Sending full user data:', fullUserData);
    
    const fullResponse = await fetch(`${API_BASE_URL}/users/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      mode: 'cors',
      credentials: 'omit',
      body: JSON.stringify(fullUserData)
    });
    
    console.log('Full user response:', fullResponse.status, fullResponse.statusText);
    
    if (fullResponse.ok) {
      const createdUser = await fullResponse.json();
      console.log('Full user created successfully:', createdUser);
    } else {
      const errorText = await fullResponse.text();
      console.log('Full user error response:', errorText);
    }
    
  } catch (error) {
    console.error('Error testing API:', error);
  }
}

testApiConnection();
