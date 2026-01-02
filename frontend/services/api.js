
import axios from 'axios';

const api = axios.create({
  baseURL: '/', 
  withCredentials: true, // Essential for handling the session_id cookie
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
});

// Helper to transform object to URLSearchParams for FastAPI Form data
export const toFormData = (data) => {
  const formData = new URLSearchParams();
  for (const key in data) {
    formData.append(key, data[key]);
  }
  return formData;
};

// Session management
export const getSessionData = async () => {
  try {
    const response = await api.get('/api/session/get');
    return response.data.data;
  } catch (error) {
    console.error('Error fetching session data:', error);
    return {};
  }
};

export const setSessionData = async (data) => {
  try {
    await api.post('/api/session/set', data, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error saving session data:', error);
  }
};

// New helper for partial updates that fetches current data first to avoid overwriting
export const updateSessionData = async (updates) => {
  try {
    const currentData = await getSessionData();
    const newData = {
      ...currentData,
      ...updates
    };
    await setSessionData(newData);
    return newData;
  } catch (error) {
    console.error('Error updating session data:', error);
    return null;
  }
};

export default api;
