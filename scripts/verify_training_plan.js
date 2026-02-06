import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
// Note: In a real environment, you might need to point to the correct .env file
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Assuming we can't easily load .env here without installing dotenv (which is likely not in package.json devDependencies?)
// Actually we can try to read it or just ask user to set vars.
// For this script to run in the user's environment, we'll assume variables are available or hardcoded for the test.

// Mock values for testing if env vars are missing
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

console.log('Testing Training Plan API...');

async function testTrainingPlanFlow() {
  if (SUPABASE_URL === 'YOUR_SUPABASE_URL') {
    console.warn('⚠️ Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to run this test.');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // 1. Test File Upload (Mock)
  console.log('\n1. Testing File Upload (Anon Role)...');
  const fileName = `test_upload_${Date.now()}.txt`;
  const fileContent = new Blob(['Test content'], { type: 'text/plain' });
  
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('training_plans')
    .upload(`anon/${fileName}`, fileContent);

  if (uploadError) {
    console.error('❌ Upload Failed:', uploadError.message);
    console.log('   (This is expected if the migration to allow Anon upload is not applied)');
  } else {
    console.log('✅ Upload Success:', uploadData);
    
    // Check Public URL
    const { data: urlData } = supabase.storage
        .from('training_plans')
        .getPublicUrl(`anon/${fileName}`);
    console.log('   Public URL:', urlData.publicUrl);
  }

  // 2. Test Plan Insertion (Anon Role)
  console.log('\n2. Testing Plan Save (Anon Role)...');
  const planPayload = {
    coach_id: 'anon_test_user', // This might fail FK check if 'anon_test_user' doesn't exist in coaches table
    // But if we allow anon, maybe we should use a valid coach ID?
    // For test, we might need a valid ID.
    date: new Date().toISOString().split('T')[0],
    title: 'Automated Test Plan',
    content: 'This is a test plan created by the verification script.',
    target_groups: ['Test Group'],
    media_urls: []
  };

  // We need a valid coach_id if FK is enforced. 
  // If we can't query coaches (due to RLS), we might be stuck.
  // Let's try to fetch one coach first.
  const { data: coaches } = await supabase.from('coaches').select('id').limit(1);
  if (coaches && coaches.length > 0) {
    planPayload.coach_id = coaches[0].id;
    console.log('   Using existing coach ID:', planPayload.coach_id);
  } else {
    console.log('   ⚠️ Could not fetch a valid coach ID. FK constraint might fail.');
  }

  const { data: insertData, error: insertError } = await supabase
    .from('training_plans')
    .insert(planPayload)
    .select();

  if (insertError) {
    console.error('❌ Save Failed:', insertError.message, insertError.details);
     console.log('   (This is expected if the migration to allow Anon insert is not applied)');
  } else {
    console.log('✅ Save Success:', insertData);
  }
}

// Run if executed directly
testTrainingPlanFlow().catch(console.error);
