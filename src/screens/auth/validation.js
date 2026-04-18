/**
 * Pure validation helpers for auth screens (easy unit test later).
 */

export function validateLogin({ email, password }) {
  const errors = { email: '', password: '' };
  let valid = true;
  if (!email.trim()) {
    errors.email = 'Please enter your email address.';
    valid = false;
  }
  if (!password) {
    errors.password = 'Please enter your password.';
    valid = false;
  }
  return { valid, errors };
}

export function validateSignUp({ name, email, password, confirm }) {
  const errors = {
    name: '',
    email: '',
    password: '',
    confirm: '',
  };
  let valid = true;
  if (!name.trim()) {
    errors.name = 'Please enter your name.';
    valid = false;
  }
  if (!email.trim()) {
    errors.email = 'Please enter your email.';
    valid = false;
  }
  if (password.length < 6) {
    errors.password = 'Password must be at least 6 characters.';
    valid = false;
  }
  if (password !== confirm) {
    errors.confirm = 'Passwords do not match.';
    valid = false;
  }
  return { valid, errors };
}
