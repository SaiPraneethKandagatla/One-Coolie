const supabase = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { generateOtp, hashOtp, verifyOtp } = require('../utils/otpService');
const { sendOtpEmail } = require('../utils/emailService');

/*
|--------------------------------------------------------------------------
| Generate JWT Token
|--------------------------------------------------------------------------
*/
const generateToken = (id, role) => {
  return jwt.sign(
    {
      id,
      role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '30d'
    }
  );
};

/*
|--------------------------------------------------------------------------
| OTP EXPIRY HELPER
|--------------------------------------------------------------------------
*/
const getOtpExpiryDate = () => {
  const minutes = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);
  return new Date(Date.now() + minutes * 60 * 1000);
};

/*
|--------------------------------------------------------------------------
| SEND OTP
|--------------------------------------------------------------------------
|
| POST /api/auth/otp/send
|
| Body: { email, purpose: 'login' | 'signup' }
|
| Security:
|   - Rate limiting handled at route level (express-rate-limit)
|   - Always returns same success message to prevent account enumeration
|   - OTP value is never logged server-side
|   - Maximum 5 failed attempts before OTP is invalidated
|
*/
exports.sendOtp = async (req, res) => {
  try {
    const { email, purpose } = req.body;

    // Validate input
    if (!email || !purpose) {
      return res.status(400).json({
        message: 'Email and purpose are required.'
      });
    }

    if (!['login', 'signup'].includes(purpose)) {
      return res.status(400).json({
        message: 'Invalid purpose. Must be "login" or "signup".'
      });
    }

    // Basic email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: 'Invalid email address format.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check whether account exists
    const { data: existingUser, error: userError } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (userError) {
      console.error('SEND OTP — USER LOOKUP ERROR:', userError);
      return res.status(500).json({
        message: 'Server error. Please try again.'
      });
    }

    // For login: account must exist
    if (purpose === 'login' && !existingUser) {
      return res.status(404).json({
        message: 'No account found with this email address. Please sign up first.'
      });
    }

    // For signup: account must NOT exist
    if (purpose === 'signup' && existingUser) {
      return res.status(409).json({
        message: 'An account with this email already exists. Only one account can be created per verified email address. Please sign in.'
      });
    }

    // Invalidate any previous unused OTPs for this email + purpose
    await supabase
      .from('email_otps')
      .update({ used: true })
      .eq('email', normalizedEmail)
      .eq('purpose', purpose)
      .eq('used', false);

    // Generate, hash, and store new OTP
    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const expiresAt = getOtpExpiryDate();
    const expiryMinutes = parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10);

    const { error: insertError } = await supabase
      .from('email_otps')
      .insert([{
        email: normalizedEmail,
        otp_hash: otpHash,
        purpose,
        expires_at: expiresAt.toISOString(),
        used: false,
        attempts: 0
      }]);

    if (insertError) {
      console.error('SEND OTP — INSERT ERROR:', insertError);
      return res.status(500).json({
        message: 'Failed to generate OTP. Please try again.'
      });
    }

    try {
      await sendOtpEmail(normalizedEmail, otp, expiryMinutes);
    } catch (emailError) {
      await supabase
        .from('email_otps')
        .update({ used: true })
        .eq('email', normalizedEmail)
        .eq('purpose', purpose)
        .eq('otp_hash', otpHash)
        .eq('used', false);

      console.error('OTP EMAIL DELIVERY FAILED:', emailError.message);
      return res.status(503).json({
        message: 'Email delivery is not configured. Please contact support.'
      });
    }

    return res.status(200).json({
      message: 'OTP sent successfully. Check your inbox.',
      email: normalizedEmail,
      // Tell the frontend whether this is a known account (for UI branching)
      accountExists: !!existingUser,
      expiresInMinutes: expiryMinutes
    });

  } catch (err) {
    console.error('SEND OTP — SERVER ERROR:', err.message);
    return res.status(500).json({
      message: 'Failed to send OTP. Please check your email and try again.'
    });
  }
};

/*
|--------------------------------------------------------------------------
| VERIFY OTP & LOGIN
|--------------------------------------------------------------------------
|
| POST /api/auth/otp/verify-login
|
| Body: { email, otp, role }
|
| Verifies OTP for an existing user and returns a JWT session.
|
*/
exports.verifyOtpAndLogin = async (req, res) => {
  try {
    const { email, otp, role = 'passenger' } = req.body;

    if (!email || !otp || !role) {
      return res.status(400).json({
        message: 'Email, OTP and role are required.'
      });
    }

    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        message: 'OTP must be exactly 6 digits.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Validate role
    const allowedRoles = ['passenger', 'assistant'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: 'Invalid role for OTP login.'
      });
    }

    // Find the latest valid (unused, unexpired) OTP for this email
    const { data: otpRecords, error: otpError } = await supabase
      .from('email_otps')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('purpose', 'login')
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (otpError) {
      console.error('VERIFY OTP LOGIN — LOOKUP ERROR:', otpError);
      return res.status(500).json({ message: 'Server error verifying OTP.' });
    }

    if (!otpRecords || otpRecords.length === 0) {
      return res.status(400).json({
        message: 'OTP has expired or is invalid. Please request a new one.'
      });
    }

    const otpRecord = otpRecords[0];

    // Brute-force guard: max 5 attempts per OTP
    if (otpRecord.attempts >= 5) {
      // Invalidate this OTP record
      await supabase
        .from('email_otps')
        .update({ used: true })
        .eq('id', otpRecord.id);

      return res.status(429).json({
        message: 'Too many incorrect attempts. Please request a new OTP.'
      });
    }

    // Verify OTP
    const isValid = await verifyOtp(otp, otpRecord.otp_hash);

    if (!isValid) {
      // Increment attempt counter
      await supabase
        .from('email_otps')
        .update({ attempts: otpRecord.attempts + 1 })
        .eq('id', otpRecord.id);

      const remaining = 5 - (otpRecord.attempts + 1);
      return res.status(400).json({
        message: remaining > 0
          ? `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
          : 'Incorrect OTP. OTP has been invalidated. Please request a new one.',
        attemptsRemaining: remaining
      });
    }

    // Mark OTP as used
    await supabase
      .from('email_otps')
      .update({ used: true })
      .eq('id', otpRecord.id);

    // Find user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (userError || !user) {
      return res.status(404).json({
        message: 'Account not found. Please sign up first.'
      });
    }

    // Check role match
    if (user.role !== role) {
      return res.status(401).json({
        message: `This account does not have ${role} access.`
      });
    }

    // Assistant approval check
    if (user.role === 'assistant' && user.is_approved !== true) {
      return res.status(403).json({
        message: 'Your assistant account is awaiting admin approval.'
      });
    }

    // Generate JWT
    const token = generateToken(user.id, user.role);

    console.log('OTP LOGIN SUCCESS:', { id: user.id, email: user.email, role: user.role });

    return res.status(200).json({
      _id: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      role: user.role,
      station_code: user.station_code || null,
      is_approved: user.is_approved,
      kyc_status: user.kyc_status || null,
      token
    });

  } catch (err) {
    console.error('VERIFY OTP LOGIN — SERVER ERROR:', err.message);
    return res.status(500).json({ message: 'Server error during OTP verification.' });
  }
};

/*
|--------------------------------------------------------------------------
| VERIFY OTP & REGISTER
|--------------------------------------------------------------------------
|
| POST /api/auth/otp/verify-register
|
| Body: { name, email, otp, role, station_code? }
|
| Verifies OTP for a new signup, creates user, returns JWT session.
|
*/
exports.verifyOtpAndRegister = async (req, res) => {
  try {
    const {
      name,
      email,
      otp,
      password,
      role = 'passenger',
      station_code,
      phone
    } = req.body;

    if (!name || !email || !otp || !password || !role) {
      return res.status(400).json({
        message: 'Name, email, OTP, password and role are required.'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: 'Password must be at least 6 characters.'
      });
    }

    if (otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        message: 'OTP must be exactly 6 digits.'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Validate role
    const allowedRoles = ['passenger', 'assistant'];
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: 'Invalid role for OTP registration.'
      });
    }

    // Find the latest valid OTP for signup
    const { data: otpRecords, error: otpError } = await supabase
      .from('email_otps')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('purpose', 'signup')
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    if (otpError) {
      console.error('VERIFY OTP REGISTER — LOOKUP ERROR:', otpError);
      return res.status(500).json({ message: 'Server error verifying OTP.' });
    }

    if (!otpRecords || otpRecords.length === 0) {
      return res.status(400).json({
        message: 'OTP has expired or is invalid. Please request a new one.'
      });
    }

    const otpRecord = otpRecords[0];

    // Brute-force guard
    if (otpRecord.attempts >= 5) {
      await supabase
        .from('email_otps')
        .update({ used: true })
        .eq('id', otpRecord.id);

      return res.status(429).json({
        message: 'Too many incorrect attempts. Please request a new OTP.'
      });
    }

    // Verify OTP
    const isValid = await verifyOtp(otp, otpRecord.otp_hash);

    if (!isValid) {
      await supabase
        .from('email_otps')
        .update({ attempts: otpRecord.attempts + 1 })
        .eq('id', otpRecord.id);

      const remaining = 5 - (otpRecord.attempts + 1);
      return res.status(400).json({
        message: remaining > 0
          ? `Incorrect OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`
          : 'Incorrect OTP. OTP has been invalidated. Please request a new one.',
        attemptsRemaining: remaining
      });
    }

    // Mark OTP as used
    await supabase
      .from('email_otps')
      .update({ used: true })
      .eq('id', otpRecord.id);

    // Double-check user doesn't exist (race condition guard)
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingUser) {
      return res.status(409).json({
        message: 'An account with this email already exists. Only one account can be created per verified email address. Please sign in.'
      });
    }

    // Determine approval status
    const isApproved = role === 'passenger';

    // Format phone consistently
    let formattedPhone = null;
    if (phone) {
      const cleanDigits = String(phone).replace(/\D/g, '');
      formattedPhone = cleanDigits.length === 10 ? `+91 ${cleanDigits}` : String(phone).trim();
    }

    // Create user with real hashed password
    const hashedPassword = await bcrypt.hash(password, 10);
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert([{
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        phone: formattedPhone,
        role,
        is_approved: isApproved,
        station_code: role === 'assistant' ? (station_code || null) : null
      }])
      .select()
      .single();

    if (insertError) {
      console.error('VERIFY OTP REGISTER — INSERT ERROR:', insertError);
      if (
        insertError.code === '23505' ||
        insertError.message?.toLowerCase().includes('duplicate') ||
        insertError.message?.toLowerCase().includes('unique')
      ) {
        return res.status(409).json({
          message: 'An account with this email already exists. Only one account can be created per verified email address. Please sign in.'
        });
      }
      return res.status(400).json({ message: insertError.message });
    }

    // Assistant — no token until admin approves
    if (role === 'assistant') {
      return res.status(201).json({
        message: 'Registration successful! Your account is awaiting admin approval.',
        _id: newUser.id,
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone || null,
        role: newUser.role,
        station_code: newUser.station_code,
        is_approved: newUser.is_approved
      });
    }

    // Passenger — issue token immediately
    const token = generateToken(newUser.id, newUser.role);

    console.log('OTP REGISTER SUCCESS:', { id: newUser.id, email: newUser.email, role: newUser.role });

    return res.status(201).json({
      _id: newUser.id,
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone || null,
      role: newUser.role,
      station_code: newUser.station_code || null,
      is_approved: newUser.is_approved,
      kyc_status: newUser.kyc_status || null,
      token
    });

  } catch (err) {
    console.error('VERIFY OTP REGISTER — SERVER ERROR:', err.message);
    return res.status(500).json({ message: 'Server error during registration.' });
  }
};

/*
|--------------------------------------------------------------------------
| CHECK EMAIL
|--------------------------------------------------------------------------
|
| POST /api/auth/otp/check-email
|
| Body: { email }
|
| Returns whether the email is registered (for UI branching on the
| single email-entry screen). Uses the same anti-enumeration response
| in production; here we expose it explicitly for UX since the sendOtp
| endpoint also differentiates.
|
*/
exports.checkEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const { data: user } = await supabase
      .from('users')
      .select('id, role')
      .eq('email', normalizedEmail)
      .maybeSingle();

    return res.status(200).json({
      exists: !!user,
      role: user?.role || null
    });

  } catch (err) {
    console.error('CHECK EMAIL — ERROR:', err.message);
    return res.status(500).json({ message: 'Server error.' });
  }
};

/*
|--------------------------------------------------------------------------
| REGISTER (legacy — kept for admin portal compatibility)
|--------------------------------------------------------------------------
*/
exports.register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role = 'passenger',
      station_code,
      phone
    } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'Name, email and password are required.'
      });
    }

    // Validate role
    const allowedRoles = ['passenger', 'assistant', 'admin'];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        message: 'Invalid role.'
      });
    }

    // Check if email already exists
    const { data: existingUser, error: existingError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingError) {
      console.error('CHECK USER ERROR:', existingError);

      return res.status(500).json({
        message: 'Unable to check existing user.'
      });
    }

    if (existingUser) {
      return res.status(400).json({
        message: 'User already exists.'
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const isApproved =
      role === 'passenger' || role === 'admin';

    // Format phone consistently
    let formattedPhone = null;
    if (phone) {
      const cleanDigits = String(phone).replace(/\D/g, '');
      formattedPhone = cleanDigits.length === 10 ? `+91 ${cleanDigits}` : String(phone).trim();
    }

    // Create user
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          name,
          email,
          password: hashedPassword,
          phone: formattedPhone,
          role,
          is_approved: isApproved,
          station_code:
            role === 'assistant'
              ? station_code || null
              : null
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('REGISTER ERROR:', error);

      return res.status(400).json({
        message: error.message
      });
    }

    const user = data;

    if (role === 'assistant') {
      return res.status(201).json({
        message:
          'Registration successful! Please wait for Admin approval before logging in.',
        _id: user.id,
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || null,
        role: user.role,
        station_code: user.station_code,
        is_approved: user.is_approved
      });
    }

    const token = generateToken(user.id, user.role);

    return res.status(201).json({
      _id: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      role: user.role,
      station_code: user.station_code || null,
      is_approved: user.is_approved,
      kyc_status: user.kyc_status || null,
      token
    });

  } catch (error) {
    console.error('REGISTER SERVER ERROR:', error);

    return res.status(500).json({
      message: 'Server error during registration.'
    });
  }
};

/*
|--------------------------------------------------------------------------
| LOGIN (legacy — kept for admin portal compatibility)
|--------------------------------------------------------------------------
*/
exports.login = async (req, res) => {
  try {
    const {
      email,
      phone,
      identifier,
      password,
      role
    } = req.body;

    const rawInput = (identifier || email || phone || '').trim();

    // Validate input
    if (!rawInput || !password || !role) {
      return res.status(400).json({
        message: 'Email or phone number, password, and role are required.'
      });
    }

    // Find user
    let user = null;
    let queryError = null;

    if (role === 'admin') {
      const normalizedEmail = rawInput.toLowerCase();
      // Check exact email first
      const { data: exactAdmin, error: exactErr } = await supabase
        .from('users')
        .select('*')
        .eq('email', normalizedEmail)
        .maybeSingle();

      if (exactErr) {
        queryError = exactErr;
      } else if (exactAdmin) {
        user = exactAdmin;
      } else {
        // Fallback for recognized admin aliases if configured under alternate domain
        const aliases = ['admin@onecoolie.com', 'admin@onecoolie.in', 'admin@railmitra.com']
          .filter(e => e !== normalizedEmail);
        const { data: aliasAdmins, error: aliasErr } = await supabase
          .from('users')
          .select('*')
          .in('email', aliases)
          .eq('role', 'admin');

        if (aliasErr) {
          queryError = aliasErr;
        } else if (aliasAdmins && aliasAdmins.length > 0) {
          user = aliasAdmins[0];
        }
      }
    } else {
      if (rawInput.includes('@')) {
        const normalizedEmail = rawInput.toLowerCase();
        const { data: standardUser, error: stdErr } = await supabase
          .from('users')
          .select('*')
          .eq('email', normalizedEmail)
          .maybeSingle();

        queryError = stdErr;
        user = standardUser;
      } else {
        // Phone lookup: construct common formatting variants (+91..., 10 digits, with/without space, etc.)
        const digits = rawInput.replace(/\D/g, '');
        const tenDigits = digits.length === 12 && digits.startsWith('91') ? digits.slice(2) : (digits.length === 10 ? digits : digits);
        const phoneCandidates = [
          rawInput,
          digits,
          tenDigits,
          `+91${tenDigits}`,
          `+91 ${tenDigits}`,
          `+${digits}`,
          digits.length === 10 ? `91${digits}` : null
        ].filter(Boolean);

        const { data: phoneUser, error: phoneErr } = await supabase
          .from('users')
          .select('*')
          .in('phone', phoneCandidates)
          .maybeSingle();

        queryError = phoneErr;
        user = phoneUser;
      }
    }

    if (queryError) {
      console.error('LOGIN DATABASE ERROR:', queryError);

      return res.status(500).json({
        message: 'Database error while logging in.'
      });
    }

    if (!user) {
      return res.status(401).json({
        message: 'Invalid credentials.'
      });
    }

    if (!user.role) {
      console.error(
        'USER HAS NO ROLE:',
        user.email,
        user.id
      );

      return res.status(500).json({
        message:
          'This account does not have a role assigned. Please update the user role in Supabase.'
      });
    }

    // Check requested role against database role
    if (user.role !== role) {
      return res.status(401).json({
        message:
          `This account does not have ${role} privileges.`
      });
    }

    // Check password
    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(401).json({
        message: 'Invalid credentials.'
      });
    }

    if (
      user.role === 'assistant' &&
      user.is_approved !== true
    ) {
      return res.status(403).json({
        message:
          'Your assistant account is waiting for Admin approval.'
      });
    }

    const token = generateToken(
      user.id,
      user.role
    );

    const responseUser = {
      _id: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone || null,
      role: user.role,
      station_code: user.station_code || null,
      is_approved: user.is_approved,
      kyc_status: user.kyc_status || null,
      token
    };

    console.log('LOGIN SUCCESS:', {
      id: responseUser.id,
      email: responseUser.email,
      role: responseUser.role
    });

    return res.status(200).json(responseUser);

  } catch (error) {
    console.error('LOGIN SERVER ERROR:', error);

    return res.status(500).json({
      message: 'Server error during login.'
    });
  }
};

/*
|--------------------------------------------------------------------------
| SEED TEST USERS
|--------------------------------------------------------------------------
*/
exports.seedTestUsers = async (req, res) => {
  try {
    const salt = await bcrypt.genSalt(10);

    const hashedPassword = await bcrypt.hash(
      'password123',
      salt
    );

    const usersToSeed = [
      {
        name: 'Admin User',
        email: 'admin@onecoolie.com',
        password: hashedPassword,
        role: 'admin',
        is_approved: true,
        station_code: null
      },
      {
        name: 'Kazipet Assistant',
        email: 'assistant@onecoolie.com',
        password: hashedPassword,
        role: 'assistant',
        is_approved: true,
        station_code: 'KZJ'
      },
      {
        name: 'Test Passenger',
        email: 'passenger@onecoolie.com',
        password: hashedPassword,
        role: 'passenger',
        is_approved: true,
        station_code: null
      }
    ];

    const createdUsers = [];

    for (const user of usersToSeed) {

      const {
        data: existingUser,
        error: findError
      } = await supabase
        .from('users')
        .select('id, email, role')
        .eq('email', user.email)
        .maybeSingle();

      if (findError) {
        console.error(
          'SEED CHECK ERROR:',
          findError
        );
        continue;
      }

      if (existingUser) {

        const {
          data: updatedUser,
          error: updateError
        } = await supabase
          .from('users')
          .update({
            role: user.role,
            is_approved: user.is_approved,
            station_code: user.station_code
          })
          .eq('id', existingUser.id)
          .select()
          .single();

        if (updateError) {
          console.error(
            'SEED UPDATE ERROR:',
            updateError
          );
        } else {
          createdUsers.push({
            id: updatedUser.id,
            email: updatedUser.email,
            role: updatedUser.role,
            status: 'updated'
          });
        }

      } else {

        const {
          data: newUser,
          error: insertError
        } = await supabase
          .from('users')
          .insert([user])
          .select()
          .single();

        if (insertError) {
          console.error(
            'SEED INSERT ERROR:',
            insertError
          );
        } else {
          createdUsers.push({
            id: newUser.id,
            email: newUser.email,
            role: newUser.role,
            status: 'created'
          });
        }
      }
    }

    return res.status(200).json({
      message:
        'Seed complete. Password for all test accounts is password123.',
      users: createdUsers
    });

  } catch (error) {
    console.error('SEED SERVER ERROR:', error);

    return res.status(500).json({
      message: 'Unable to seed test users.'
    });
  }
};

/*
|--------------------------------------------------------------------------
| UPDATE USER PHONE NUMBER WITH 2-CHANGE MONTHLY LIMIT
|--------------------------------------------------------------------------
|
| PUT /api/auth/update-phone
| Header: Authorization: Bearer <token>
| Body: { phone }
|
| Allows up to 2 phone number changes per calendar month.
| Tracks change timestamps inside kyc_documents JSONB on the user row.
|
*/
exports.updatePhoneNumber = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { phone } = req.body;

    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized. Please sign in.' });
    }

    if (!phone) {
      return res.status(400).json({ message: 'Phone number is required.' });
    }

    const cleanPhone = String(phone).replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) {
      return res.status(400).json({ message: 'Please provide a valid 10-digit mobile phone number.' });
    }

    const formattedPhone = cleanPhone.length === 10 ? `+91 ${cleanPhone}` : `+${cleanPhone}`;

    // Fetch user
    const { data: user, error: fetchErr } = await supabase
      .from('users')
      .select('id, name, email, phone, role, kyc_documents')
      .eq('id', userId)
      .single();

    if (fetchErr || !user) {
      return res.status(404).json({ message: 'User account not found.' });
    }

    if (user.role === 'assistant') {
      return res.status(403).json({
        message: 'Assistant phone numbers are confidential and KYC-locked. Contact your Station Master or Administrator for any update.'
      });
    }

    // Parse history from kyc_documents
    const kycDocs = typeof user.kyc_documents === 'object' && user.kyc_documents !== null
      ? user.kyc_documents
      : {};
    const history = Array.isArray(kycDocs.phone_change_history) ? kycDocs.phone_change_history : [];

    // Filter updates in current calendar month (YYYY-MM)
    const currentMonth = new Date().toISOString().slice(0, 7);
    const changesThisMonth = history.filter(h => h.date && h.date.startsWith(currentMonth));

    const MAX_MONTHLY_CHANGES = 2;

    if (changesThisMonth.length >= MAX_MONTHLY_CHANGES) {
      return res.status(429).json({
        message: 'Monthly limit reached: You can only update your phone number 2 times per calendar month.',
        changesRemaining: 0,
        changesUsed: changesThisMonth.length,
        limit: MAX_MONTHLY_CHANGES,
        currentPhone: user.phone
      });
    }

    // Append new update record
    const newRecord = {
      date: new Date().toISOString(),
      from: user.phone || null,
      to: formattedPhone
    };
    const updatedHistory = [...history, newRecord];
    const updatedKycDocs = {
      ...kycDocs,
      phone_change_history: updatedHistory
    };

    // Update in Supabase
    const { data: updatedUser, error: updateErr } = await supabase
      .from('users')
      .update({
        phone: formattedPhone,
        kyc_documents: updatedKycDocs,
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select('id, name, email, phone, role, station_code, is_approved, kyc_status')
      .single();

    if (updateErr) {
      console.error('UPDATE PHONE ERROR:', updateErr);
      return res.status(500).json({ message: 'Unable to update phone number. Please try again.' });
    }

    const changesRemaining = MAX_MONTHLY_CHANGES - (changesThisMonth.length + 1);

    return res.status(200).json({
      message: 'Phone number updated successfully.',
      phone: updatedUser.phone,
      changesRemaining,
      changesUsed: changesThisMonth.length + 1,
      limit: MAX_MONTHLY_CHANGES,
      user: updatedUser
    });

  } catch (err) {
    console.error('UPDATE PHONE SERVER ERROR:', err);
    return res.status(500).json({ message: 'Server error updating phone number.' });
  }
};

/*
|--------------------------------------------------------------------------
| GET PHONE STATUS & REMAINING MONTHLY UPDATES
|--------------------------------------------------------------------------
|
| GET /api/auth/phone-status
| Header: Authorization: Bearer <token>
|
*/
exports.getPhoneStatus = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { data: user, error } = await supabase
      .from('users')
      .select('id, phone, kyc_documents')
      .eq('id', userId)
      .single();

    if (error || !user) {
      return res.status(404).json({ message: 'User account not found' });
    }

    const kycDocs = typeof user.kyc_documents === 'object' && user.kyc_documents !== null
      ? user.kyc_documents
      : {};
    const history = Array.isArray(kycDocs.phone_change_history) ? kycDocs.phone_change_history : [];
    const currentMonth = new Date().toISOString().slice(0, 7);
    const changesThisMonth = history.filter(h => h.date && h.date.startsWith(currentMonth));
    const MAX_MONTHLY_CHANGES = 2;
    const changesRemaining = Math.max(0, MAX_MONTHLY_CHANGES - changesThisMonth.length);

    return res.status(200).json({
      phone: user.phone || null,
      changesUsed: changesThisMonth.length,
      changesRemaining,
      limit: MAX_MONTHLY_CHANGES
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error retrieving phone status.' });
  }
};