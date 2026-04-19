
import axios from 'axios';

// Determine API URL based on environment
const getApiUrl = () => {
  // Check if we're on Render.com
  const isRender = window.location.hostname.includes('onrender.com');
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  let apiUrl;
  if (isRender) {
    apiUrl = 'https://vizchemlab-backend.onrender.com/api';
  } else if (isLocalhost) {
    apiUrl = '/api';
  } else {
    // Fallback for other environments
    apiUrl = import.meta.env.PROD ? 'https://vizchemlab-backend.onrender.com/api' : '/api';
  }
  
  console.log('🔧 API URL detected:', {
    hostname: window.location.hostname,
    isRender,
    isLocalhost,
    apiUrl,
    isProd: import.meta.env.PROD
  });
  
  return apiUrl;
};

const api = axios.create({
  baseURL: getApiUrl(),
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const toFormData = (data) => {
  const formData = new URLSearchParams();
  for (const key in data) {
    formData.append(key, data[key]);
  }
  return formData;
};

export const getSessionData = async () => {
  try {
    const response = await api.get('/session/get');
    return response.data.data;
  } catch (error) {
    console.error('Error fetching session data:', error);
    return {};
  }
};

export const setSessionData = async (data) => {
  try {
    await api.post('/session/set', data);
  } catch (error) {
    console.error('Error saving session data:', error);
  }
};

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
