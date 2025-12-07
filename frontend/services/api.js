
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

export default api;
