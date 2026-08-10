import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { FiArrowRight, FiX } from 'react-icons/fi';

import { useUserStore } from '#entities/user';
import type { Credentials } from '#entities/user';
import { ApiError } from '#shared/api';
import { Button, IconButton, TextField } from '#shared/ui';

import styles from './AuthModal.module.scss';

type AuthMode = 'login' | 'register';

interface AuthModalProps {
  onClose: () => void;
}

const usernameRules = {
  required: 'Введите логин',
  pattern: {
    value: /^[A-Za-z0-9_-]{3,32}$/,
    message: 'Используйте 3–32 латинских символа, цифры, _ или -',
  },
};

const passwordRules = {
  required: 'Пароль должен содержать от 8 до 128 символов',
  minLength: { value: 8, message: 'Пароль должен содержать от 8 до 128 символов' },
  maxLength: { value: 128, message: 'Пароль должен содержать от 8 до 128 символов' },
};

export function AuthModal({ onClose }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>('login');
  const [requestError, setRequestError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const loginTabRef = useRef<HTMLButtonElement>(null);
  const registerTabRef = useRef<HTMLButtonElement>(null);
  const login = useUserStore((state) => state.login);
  const registerUser = useUserStore((state) => state.register);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<Credentials>({ defaultValues: { username: '', password: '' } });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  const close = () => {
    if (!isSubmitting) onClose();
  };

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
    ) ?? []);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const switchMode = (nextMode: AuthMode, focusField = true) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setRequestError(null);
    reset();
    if (focusField) {
      requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLInputElement>('input')?.focus());
    }
  };

  const handleTabKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    let nextMode: AuthMode | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      nextMode = mode === 'login' ? 'register' : 'login';
    } else if (event.key === 'Home') {
      nextMode = 'login';
    } else if (event.key === 'End') {
      nextMode = 'register';
    }
    if (!nextMode) return;
    event.preventDefault();
    switchMode(nextMode, false);
    requestAnimationFrame(() => {
      (nextMode === 'login' ? loginTabRef : registerTabRef).current?.focus();
    });
  };

  const submit = handleSubmit(async (credentials) => {
    setRequestError(null);
    const normalized = { ...credentials, username: credentials.username.trim() };
    try {
      if (mode === 'login') await login(normalized);
      else await registerUser(normalized);
      onClose();
    } catch (error) {
      if (error instanceof ApiError) {
        const usernameError = error.code === 'username_taken'
          ? 'Этот логин уже занят'
          : error.fieldErrors?.username;
        const passwordError = error.fieldErrors?.password;
        if (usernameError) setError('username', { message: usernameError });
        if (passwordError) setError('password', { message: passwordError });
        if (!usernameError && !passwordError) {
          setRequestError(error.code === 'invalid_credentials'
            ? 'Неверный логин или пароль'
            : error.message);
        }
      } else {
        setRequestError('Не удалось выполнить запрос. Попробуйте снова.');
      }
    }
  });

  return (
    <div className={styles.backdrop} onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-dialog-title"
        onKeyDown={handleDialogKeyDown}
      >
        <div className={styles.topline}>
          <div>
            <span className={styles.kicker}>ЛИЧНЫЙ КАБИНЕТ</span>
            <h2 id="auth-dialog-title">Вход и регистрация</h2>
          </div>
          <IconButton icon={<FiX />} type="button" size="small" aria-label="Закрыть окно" onClick={close} disabled={isSubmitting} />
        </div>

        <div className={styles.tabs} role="tablist" aria-label="Способ авторизации">
          <button
            ref={loginTabRef}
            id="auth-login-tab"
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            aria-controls="auth-login-panel"
            tabIndex={mode === 'login' ? 0 : -1}
            onKeyDown={handleTabKeyDown}
            onClick={() => switchMode('login')}
          >Вход</button>
          <button
            ref={registerTabRef}
            id="auth-register-tab"
            type="button"
            role="tab"
            aria-selected={mode === 'register'}
            aria-controls="auth-register-panel"
            tabIndex={mode === 'register' ? 0 : -1}
            onKeyDown={handleTabKeyDown}
            onClick={() => switchMode('register')}
          >Регистрация</button>
        </div>

        <div
          id={`auth-${mode}-panel`}
          role="tabpanel"
          aria-labelledby={`auth-${mode}-tab`}
        >
          <p className={styles.intro}>
            {mode === 'login'
              ? 'Продолжите работу со своим портфелем облигаций.'
              : 'Создайте аккаунт по логину и паролю — без почты и лишних шагов.'}
          </p>

          <form className={styles.form} noValidate onSubmit={submit}>
            <TextField
              label="Логин"
              autoComplete="username"
              placeholder="например, bond_owner"
              error={errors.username?.message}
              {...register('username', usernameRules)}
            />
            <TextField
              label="Пароль"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              placeholder="Не менее 8 символов"
              error={errors.password?.message}
              {...register('password', passwordRules)}
            />
            {requestError ? <p className={styles.requestError} role="alert">{requestError}</p> : null}
            <Button type="submit" trailingIcon={<FiArrowRight />} disabled={isSubmitting}>
              {isSubmitting ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
