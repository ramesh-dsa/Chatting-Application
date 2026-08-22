export function stripHTML(text: string): string {
  if (!text) return '';
  return text.replace(/<[^>]*>?/gm, '');
}

export function validateEmail(email: string): boolean {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validatePassword(password: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('at least one uppercase letter');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('at least one lowercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('at least one number');
  }
  // Let's add special character checking too, as it's good practice. Wait, the user said: "min 8 characters, at least 1 uppercase, at least 1 lowercase, at least 1 number". They omitted special character from the prompt. I will just stick to the requested 4 rules to be safe, but they also mentioned "clear error messages for each unmet rule".
  
  return {
    valid: errors.length === 0,
    errors
  };
}
