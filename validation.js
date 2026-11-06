'use strict';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-\s]{7,20}$/;

/**
 * Cleans and validates the data sent for a student.
 * Returns { errors, value }. `errors` is an object keyed by field name and is
 * empty when the data is valid.
 */
function validateStudent(body) {
  const input = body && typeof body === 'object' ? body : {};
  const errors = {};

  const name = String(input.name ?? '').trim();
  const email = String(input.email ?? '').trim().toLowerCase();
  const phone = String(input.phone ?? '').trim();
  const course = String(input.course ?? '').trim();
  const year = Number(input.year);

  if (name.length < 2 || name.length > 100) {
    errors.name = 'Name must be between 2 and 100 characters.';
  }
  if (!EMAIL_RE.test(email) || email.length > 120) {
    errors.email = 'Enter a valid email address.';
  }
  if (phone && !PHONE_RE.test(phone)) {
    errors.phone = 'Phone can contain digits, spaces, +, ( ), and - (7 to 20 characters).';
  }
  if (course.length < 2 || course.length > 100) {
    errors.course = 'Course must be between 2 and 100 characters.';
  }
  if (!Number.isInteger(year) || year < 1 || year > 6) {
    errors.year = 'Year of study must be a whole number from 1 to 6.';
  }

  return { errors, value: { name, email, phone, course, year } };
}

module.exports = { validateStudent };
