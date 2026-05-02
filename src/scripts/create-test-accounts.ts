#!/usr/bin/env node

/**
 * Script to create test accounts (1 job-seeker + 1 employer)
 * Usage: npm run create-test-accounts
 * Or: node dist/scripts/create-test-accounts.js
 */

import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Test data
const jobSeekerData = {
  firstname: 'John',
  lastname: 'Doe',
  email: 'jobseeker@test.com',
  password: 'TestPassword123',
  confirmPassword: 'TestPassword123',
};

const employerData = {
  companyName: 'Tech Solutions Inc',
  numEmployees: '11-50',
  industry: 'Technology',
  address: '123 Business Ave, San Francisco, CA 94105',
  website: 'https://techsolutions.example.com',
  email: 'employer@test.com',
  password: 'TestPassword123',
  confirmPassword: 'TestPassword123',
};

async function createAccounts(): Promise<void> {
  console.log('🚀 Starting test account creation...\n');

  try {
    // Create Job Seeker
    console.log('📝 Creating Job Seeker account...');
    try {
      const jobSeekerResponse = await apiClient.post('/auth/register', jobSeekerData);
      console.log('✅ Job Seeker account created successfully!');
      console.log(`   Email: ${jobSeekerData.email}`);
      console.log(`   Password: ${jobSeekerData.password}\n`);
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`❌ Connection refused. Make sure the backend server is running at ${API_URL}\n`);
      } else {
        const errorMsg = error.response?.data?.message || error.response?.data || error.message;
        console.log(`❌ Failed to create Job Seeker account: ${errorMsg}\n`);
      }
    }

    // Create Employer
    console.log('📝 Creating Employer account...');
    try {
      const employerResponse = await apiClient.post('/auth/company/signup', employerData);
      console.log('✅ Employer account created successfully!');
      console.log(`   Email: ${employerData.email}`);
      console.log(`   Password: ${employerData.password}`);
      console.log(`   Company: ${employerData.companyName}\n`);
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED') {
        console.log(`❌ Connection refused. Make sure the backend server is running at ${API_URL}\n`);
      } else {
        const errorMsg = error.response?.data?.message || error.response?.data || error.message;
        console.log(`❌ Failed to create Employer account: ${errorMsg}\n`);
      }
    }

    console.log('✨ Test account creation complete!');
    console.log('\n💡 You can now use these credentials to test the application.\n');

    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error creating accounts:', error.message);
    process.exit(1);
  }
}

// Run the script
createAccounts();
