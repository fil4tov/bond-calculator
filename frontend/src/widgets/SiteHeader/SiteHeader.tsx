import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { FiLogOut, FiMoon, FiSun, FiUser } from 'react-icons/fi';
import { Link } from 'react-router-dom';

import { useUserStore } from '#entities/user';
import { Dropdown, IconButton } from '#shared/ui';

import { AuthModal } from './components/AuthModal';
import styles from './SiteHeader.module.scss';

interface SiteHeaderProps {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  additionalAction?: ReactNode;
}

export function SiteHeader({ theme, toggleTheme, additionalAction }: SiteHeaderProps) {
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const userButtonRef = useRef<HTMLButtonElement>(null);
  const status = useUserStore((state) => state.status);
  const user = useUserStore((state) => state.user);
  const logout = useUserStore((state) => state.logout);

  const closeAuth = () => {
    setAuthOpen(false);
    requestAnimationFrame(() => userButtonRef.current?.focus());
  };

  const handleLogout = async () => {
    setLogoutError(null);
    try {
      await logout();
      setProfileOpen(false);
      requestAnimationFrame(() => userButtonRef.current?.focus());
    } catch {
      setLogoutError('Не удалось выйти. Проверьте подключение и попробуйте снова.');
    }
  };

  return (
    <div className={styles.toolbar}>
      <div className={styles.brand}><span aria-hidden="true" /> ОБЛИГАЦИИ</div>
      <div className={styles.actions}>
        {additionalAction}
        <IconButton
          icon={theme === 'dark' ? <FiSun /> : <FiMoon />}
          type="button"
          aria-label={theme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'}
          aria-pressed={theme === 'dark'}
          onClick={toggleTheme}
        />
        {status === 'authenticated' && user ? (
          <Dropdown
            open={profileOpen}
            onOpenChange={(open) => { setProfileOpen(open); if (open) setLogoutError(null); }}
            contentClassName={styles.profileMenu}
            mobileMode="anchored"
            trigger={(triggerProps) => (
              <button
                {...triggerProps}
                ref={(node) => {
                  userButtonRef.current = node;
                  const dropdownRef = triggerProps.ref;
                  dropdownRef.current = node;
                }}
                type="button"
                className={styles.avatar}
                aria-haspopup="true"
                aria-label={`${profileOpen ? 'Закрыть' : 'Открыть'} меню пользователя ${user.username}`}
              >
                {user.username.charAt(0).toLocaleUpperCase('ru-RU')}
              </button>
            )}
          >
            <nav aria-label="Меню пользователя">
              <div className={styles.profileIdentity}>
                <span>Вы вошли как</span>
                <strong>{user.username}</strong>
              </div>
              <Link className={styles.profileLink} to="/" onClick={() => setProfileOpen(false)}>Калькулятор</Link>
              <Link className={styles.profileLink} to="/portfolio" onClick={() => setProfileOpen(false)}>Портфель</Link>
              <button className={styles.logout} type="button" onClick={handleLogout}><FiLogOut aria-hidden="true" /> Выйти</button>
              {logoutError ? <p className={styles.logoutError} role="alert">{logoutError}</p> : null}
            </nav>
          </Dropdown>
        ) : (
          <button
            ref={userButtonRef}
            type="button"
            className={styles.userButton}
            aria-label={status === 'checking' ? 'Проверка авторизации' : 'Войти или зарегистрироваться'}
            disabled={status === 'checking'}
            onClick={() => setAuthOpen(true)}
          >
            <FiUser aria-hidden="true" />
          </button>
        )}
      </div>
      {authOpen ? <AuthModal onClose={closeAuth} /> : null}
    </div>
  );
}
