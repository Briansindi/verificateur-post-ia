import { createContext, useState, useContext, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext();

export const useAuth = () => {
  return useContext(AuthContext);
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data.user);
    } catch (error) {
      console.error('Token invalide', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
      
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error.response?.data?.error || "Erreur de connexion" 
      };
    }
  };

  const register = async (email, password) => {
    try {
      console.log("📤 Tentative inscription:", { email, password });
      console.log("🔗 URL appelée:", api.defaults.baseURL + '/auth/register');
      
      const response = await api.post('/auth/register', { email, password });
      console.log("📥 Statut réponse:", response.status);
      console.log("📥 Réponse succès:", response.data);
      
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      setToken(token);
      setUser(user);
      
      return { success: true };
    } catch (error) {
      console.log("❌ Erreur complète:", error);
      console.log("❌ Message erreur:", error.message);
      console.log("❌ Statut erreur:", error.response?.status);
      console.log("❌ Données erreur:", error.response?.data);
      console.log("❌ Headers réponse:", error.response?.headers);
      
      let errorMessage = "Erreur d'inscription";
      
      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.message === "Network Error") {
        errorMessage = "Impossible de joindre le serveur. Vérifie que le backend tourne sur http://localhost:5050";
      }
      
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  };
  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};