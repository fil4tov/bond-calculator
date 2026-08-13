import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { FiArrowRight } from 'react-icons/fi';

import { useUserStore } from '#entities/user';
import type { Credentials } from '#entities/user';
import { ApiError } from '#shared/api';
import { Button, Modal, TextField } from '#shared/ui';

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
  const formRef = useRef<HTMLFormElement>(null);
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
    formRef.current?.querySelector<HTMLInputElement>('input')?.focus();
  }, []);

  const close = () => {
    if (!isSubmitting) onClose();
  };

  const switchMode = (nextMode: AuthMode, focusField = true) => {
    if (nextMode === mode) return;
    setMode(nextMode);
    setRequestError(null);
    reset();
    if (focusField) {
      requestAnimationFrame(() => formRef.current?.querySelector<HTMLInputElement>('input')?.focus());
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
    <Modal title="Авторизация" busy={isSubmitting} onClose={close} width="narrow">
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
        <form ref={formRef} className={styles.form} noValidate onSubmit={submit}>
          <TextField
            label="Логин"
            autoComplete="username"
            placeholder="Логин"
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
          <div className={styles.actions}>
            <Button type="submit" trailingIcon={<FiArrowRight />} disabled={isSubmitting}>
              {isSubmitting ? 'Подождите…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
