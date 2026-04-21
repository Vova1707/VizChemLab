
import axios from 'axios';

// Determine API URL based on environment
const getApiUrl = () => {
  // Always use proxy - nginx will handle forwarding to backend
  return '/api';
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
    return response.data?.data || {};
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
