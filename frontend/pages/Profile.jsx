import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { Navigate } from 'react-router-dom';

const Profile = () => {
  const { user, loading } = useAuth();

  if (loading) return <div className="container">Загрузка...</div>;
  if (!user) return <Navigate to="/login" />;

  return (
    <div className="container">
      <h1 style={{ marginBottom: '20px', marginTop: '40px' }}>Мой профиль</h1>
      
      <div className="profile-card">
        <div className="profile-detail">
          <span className="profile-label">Имя пользователя</span>
          <span className="profile-value">{user.username}</span>
        </div>
        
        <div className="profile-detail">
          <span className="profile-label">E-mail</span>
          <span className="profile-value">{user.email}</span>
        </div>
      </div>
    </div>
  );
};

export default Profile;
