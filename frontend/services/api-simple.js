// Простая версия API без axios
const API_BASE = '/api';

export const getSessionData = async () => {
  try {
    const response = await fetch(`${API_BASE}/session/get`);
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    return null;
  }
};

export const setSessionData = async (data) => {
  try {
    const response = await fetch(`${API_BASE}/session/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    return null;
  }
};

export const updateSessionData = async (data) => {
  try {
    const response = await fetch(`${API_BASE}/session/set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    return null;
  }
};
