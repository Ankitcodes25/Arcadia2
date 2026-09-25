const LOCAL_PART_PATTERN = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/;
const DOMAIN_LABEL_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/;

function normalizeEmail(value) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().toLowerCase();
}

function isValidEmail(value) {
  const normalized = normalizeEmail(value);
  if (!normalized || normalized.length > 254 || /[\s\u0000-\u001F\u007F]/.test(normalized)) {
    return false;
  }

  const atIndex = normalized.lastIndexOf('@');
  if (atIndex <= 0 || atIndex !== normalized.indexOf('@')) {
    return false;
  }

  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  if (local.length > 64 || !LOCAL_PART_PATTERN.test(local)) {
    return false;
  }

  const labels = domain.split('.');
  if (labels.length < 2 || labels.some((label) => !DOMAIN_LABEL_PATTERN.test(label))) {
    return false;
  }

  const tld = labels.at(-1);
  return tld.length >= 2 && /^[A-Za-z]+$/.test(tld);
}

normalizeEmail.isValidEmail = isValidEmail;

module.exports = normalizeEmail;
