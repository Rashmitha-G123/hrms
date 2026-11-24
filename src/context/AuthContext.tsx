import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getCachedUser, fetchProfile, logoutApi, saveCachedUser } from '../services/authService';
import {
  hasPermission as checkPermission,
  hasAnyPermission as checkAnyPermission,
  hasAllPermissions as checkAllPermissions,
  canViewModule as checkModuleAccess,
  extractPermissions,
  PermissionKey,
} from '../services/permissionService';

export interface AuthContextType {
  user: any;
  role: string;
  permissions: string[];
  isLoading: boolean;
  hasPermission: (permissionKey: PermissionKey) => boolean;
  hasAnyPermission: (permissionKeys: PermissionKey[]) => boolean;
  hasAllPermissions: (permissionKeys: PermissionKey[]) => boolean;
  canViewModule: (moduleName: string) => boolean;
  refreshProfile: () => Promise<any>;
  setUser: (user: any) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: 'employee',
  permissions: [],
  isLoading: true,
  hasPermission: () => false,
  hasAnyPermission: () => false,
  hasAllPermissions: () => false,
  canViewModule: () => true,
  refreshProfile: async () => null,
  setUser: () => { },
  logout: async () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUserState] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const updateUser = useCallback((newUser: any) => {
    setUserState(newUser);
    if (newUser) {
      saveCachedUser(newUser);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const data = await fetchProfile();
      if (data && data.user) {
        const fullUser = {
          ...data.user,
          permissions: data.permissions || data.user.permissions || [],
        };
        updateUser(fullUser);
        return fullUser;
      }
    } catch (err) {
      // Fallback to cached user if offline or network error
      const cached = await getCachedUser();
      if (cached) {
        setUserState(cached);
        return cached;
      }
    }
    return null;
  }, [updateUser]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const cached = await getCachedUser();
        if (cached && isMounted) {
          setUserState(cached);
        }
        // Background sync latest profile & permissions from backend
        const remote = await fetchProfile().catch(() => null);
        if (remote && remote.user && isMounted) {
          const fullUser = {
            ...remote.user,
            permissions: remote.permissions || remote.user.permissions || [],
          };
          updateUser(fullUser);
        }
      } catch (e) {
        // Ignored
      } finally {
        if (isMounted) setIsLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  const role = (user?.role || 'employee').toLowerCase();
  const permissions = extractPermissions(user);

  const hasPermission = useCallback(
    (key: PermissionKey) => checkPermission(user, key),
    [user]
  );

  const hasAnyPermission = useCallback(
    (keys: PermissionKey[]) => checkAnyPermission(user, keys),
    [user]
  );

  const hasAllPermissions = useCallback(
    (keys: PermissionKey[]) => checkAllPermissions(user, keys),
    [user]
  );

  const canViewModule = useCallback(
    (moduleName: string) => checkModuleAccess(user, moduleName),
    [user]
  );

  const logout = useCallback(async () => {
    await logoutApi();
    setUserState(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        permissions,
        isLoading,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        canViewModule,
        refreshProfile,
        setUser: updateUser,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook to access auth & permission controls anywhere in the application.
 * Usage:
 *   const { hasPermission, canViewModule, user, role } = useAuth();
 *   if (hasPermission('lead.create')) { ... }
 */
export const useAuth = () => useContext(AuthContext);
