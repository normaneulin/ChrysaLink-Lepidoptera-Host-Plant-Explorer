/**
 * Validation utility functions
 */

export const validateGPS = (lat: number, lng: number): boolean => {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
};

export const validateEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

export const validatePassword = (password: string): boolean => {
  // Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
};

export const validateObservationDate = (date: string): boolean => {
  const parsed = new Date(date);
  return !isNaN(parsed.getTime()) && parsed <= new Date();
};

export const validateNonEmptyString = (str: string, minLength = 1): boolean => {
  return typeof str === "string" && str.trim().length >= minLength;
};

export const validateObject = (obj: any): boolean => {
  return obj !== null && typeof obj === "object";
};
