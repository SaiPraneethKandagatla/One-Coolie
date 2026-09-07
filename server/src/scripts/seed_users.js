/**
 * server/src/scripts/seed_users.js
 *
 * Seeds/Updates default Admin, Passenger, and Assistant users in the database
 * with known, secure credentials for development and testing.
 *
 * Standard Password for all seeded users: Password@123
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const bcrypt = require('bcryptjs');
const supabase = require('../config/db');

const SEED_PASSWORD = 'Password@123';

const USERS_TO_SEED = [
  {
    custom_id: 'ADM001',
    name: 'Platform Administrator',
    email: 'admin@onecoolie.com',
    role: 'admin',
    phone: '+919876543210',
    station_code: null,
    is_approved: true,
    is_online: true,
    kyc_status: 'approved',
  },
  {
    custom_id: 'PSG001',
    name: 'Rahul Sharma (Passenger)',
    email: 'passenger@onecoolie.com',
    role: 'passenger',
    phone: '+919876543211',
    station_code: 'KZJ',
    is_approved: true,
    is_online: false,
    kyc_status: 'approved',
  },
  {
    custom_id: 'AST001',
    name: 'Ramesh Sahayak (Assistant)',
    email: 'assistant@onecoolie.com',
    role: 'assistant',
    phone: '+919876543212',
    station_code: 'KZJ',
    is_approved: true,
    is_online: true,
    kyc_status: 'approved',
  },
  {
    // Also ensure existing assistant user has known password
    custom_id: 'AST002',
    name: 'Sai Coolie',
    email: 'vikasmusham07@gmail.com',
    role: 'assistant',
    phone: '+919876543213',
    station_code: 'KZJ',
    is_approved: true,
    is_online: true,
    kyc_status: 'approved',
  }
];

async function seedUsers() {
  console.log('--- SEEDING ONECOOLIE USERS (ADMIN, PASSENGER, ASSISTANT) ---');
  console.log(`Target Password: ${SEED_PASSWORD}\n`);

  const hashedPassword = await bcrypt.hash(SEED_PASSWORD, 10);

  for (const user of USERS_TO_SEED) {
    // Check if user exists by email
    const { data: existing, error: findErr } = await supabase
      .from('users')
      .select('id, email, role')
      .eq('email', user.email.toLowerCase())
      .maybeSingle();

    if (findErr) {
      console.error(`Error checking user ${user.email}:`, findErr.message);
      continue;
    }

    if (existing) {
      // Update existing user with known password and approved status
      const { data: updated, error: updateErr } = await supabase
        .from('users')
        .update({
          name: user.name,
          password: hashedPassword,
          role: user.role,
          phone: user.phone,
          station_code: user.station_code,
          is_approved: user.is_approved,
          is_online: user.is_online,
          kyc_status: user.kyc_status,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select('id, name, email, role, station_code, is_approved')
        .single();

      if (updateErr) {
        console.error(`❌ Failed to update ${user.email}:`, updateErr.message);
      } else {
        console.log(`✓ UPDATED user: [${updated.role.toUpperCase()}] ${updated.email} (ID: ${updated.id})`);
      }
    } else {
      // Insert new user
      const { data: inserted, error: insertErr } = await supabase
        .from('users')
        .insert([{
          custom_id: user.custom_id,
          name: user.name,
          email: user.email.toLowerCase(),
          password: hashedPassword,
          role: user.role,
          phone: user.phone,
          station_code: user.station_code,
          is_approved: user.is_approved,
          is_online: user.is_online,
          kyc_status: user.kyc_status,
          kyc_documents: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }])
        .select('id, name, email, role, station_code, is_approved')
        .single();

      if (insertErr) {
        console.error(`❌ Failed to create ${user.email}:`, insertErr.message);
      } else {
        console.log(`✓ CREATED user: [${inserted.role.toUpperCase()}] ${inserted.email} (ID: ${inserted.id})`);
      }
    }
  }

  console.log('\n--- SEEDING COMPLETED SUCCESSFULLY ---');
}

seedUsers()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('SEEDING FATAL ERROR:', err);
    process.exit(1);
  });
