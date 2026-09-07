const crypto = require('crypto');
const bcrypt = require('bcryptjs');

/*
|--------------------------------------------------------------------------
| OTP Service
|--------------------------------------------------------------------------
|
| Cryptographically secure 6-digit OTP generation and verification.
|
| SECURITY RULES:
|   - OTP is generated using crypto.randomInt (CSPRNG)
|   - Only the bcrypt HASH is stored in the database
|   - The plaintext OTP is only sent to the user's email
|   - OTP value is never logged
|
*/

/**
 * Generate a cryptographically secure 6-digit OTP string.
 * Pads with leading zeros if needed (e.g. "012345").
 *
 * @returns {string} 6-digit OTP
 */
const generateOtp = () => {
  // crypto.randomInt is CSPRNG — safe for security-sensitive OTPs
  const value = crypto.randomInt(0, 1_000_000);
  return String(value).padStart(6, '0');
};

/**
 * Hash an OTP using bcrypt (cost factor 10).
 *
 * @param {string} otp - plaintext OTP
 * @returns {Promise<string>} bcrypt hash
 */
const hashOtp = async (otp) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(otp, salt);
};

/**
 * Verify a plaintext OTP against its stored bcrypt hash.
 *
 * @param {string} otp - plaintext OTP entered by user
 * @param {string} hash - bcrypt hash from database
 * @returns {Promise<boolean>}
 */
const verifyOtp = async (otp, hash) => {
  return bcrypt.compare(otp, hash);
};

module.exports = { generateOtp, hashOtp, verifyOtp };
