#!/usr/bin/env node
/**
 * Build Script for Ndeip-Zthin
 * Validates environment and triggers the appropriate build
 * 
 * Usage:
 *   node scripts/build.js development android
 *   node scripts/build.js preview ios
 *   node scripts/build.js production all
 */

const { execSync, spawn } = require('child_process');
const path = require('path');

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function runCommand(command, options = {}) {
  log(`\n$ ${command}`, 'cyan');
  try {
    execSync(command, { stdio: 'inherit', ...options });
    return true;
  } catch (error) {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const profile = args[0] || 'development';
  const platform = args[1] || 'all';
  
  const validProfiles = ['development', 'preview', 'production'];
  const validPlatforms = ['android', 'ios', 'all'];
  
  if (!validProfiles.includes(profile)) {
    log(`Invalid profile: ${profile}`, 'red');
    log(`Valid profiles: ${validProfiles.join(', ')}`, 'yellow');
    process.exit(1);
  }
  
  if (!validPlatforms.includes(platform)) {
    log(`Invalid platform: ${platform}`, 'red');
    log(`Valid platforms: ${validPlatforms.join(', ')}`, 'yellow');
    process.exit(1);
  }
  
  log('\n╔════════════════════════════════════════════════════════════╗', 'blue');
  log('║              🚀 Ndeip-Zthin Build System                   ║', 'blue');
  log('╚════════════════════════════════════════════════════════════╝', 'blue');
  
  log(`\nProfile: ${profile}`, 'cyan');
  log(`Platform: ${platform}`, 'cyan');
  
  // Step 1: Validate environment
  log('\n📋 Step 1: Validating environment...', 'yellow');
  const envValid = runCommand('node scripts/validate-env.js');
  if (!envValid) {
    log('\n❌ Environment validation failed. Fix the issues above before building.', 'red');
    process.exit(1);
  }
  
  // Step 2: Type check
  log('\n📋 Step 2: Running TypeScript check...', 'yellow');
  const tsValid = runCommand('npx tsc --noEmit');
  if (!tsValid) {
    log('\n⚠️  TypeScript errors found. Continue anyway? (building may fail)', 'yellow');
  }
  
  // Step 3: Run build
  log('\n📋 Step 3: Starting EAS Build...', 'yellow');
  
  const buildCommand = platform === 'all'
    ? `npx eas build --profile ${profile} --platform all --non-interactive`
    : `npx eas build --profile ${profile} --platform ${platform} --non-interactive`;
  
  log(`\nExecuting: ${buildCommand}`, 'cyan');
  const buildSuccess = runCommand(buildCommand);
  
  if (buildSuccess) {
    log('\n═══════════════════════════════════════════════════════════════', 'green');
    log('✅ Build completed successfully!', 'green');
    log('═══════════════════════════════════════════════════════════════', 'green');
    log('\nNext steps:', 'blue');
    log('  • Check build status: npx eas build:list', 'cyan');
    log('  • Download builds: npx eas build:view', 'cyan');
    if (profile === 'production') {
      log('  • Submit to stores: npm run submit:android / npm run submit:ios', 'cyan');
    }
  } else {
    log('\n❌ Build failed. Check the errors above.', 'red');
    process.exit(1);
  }
}

main().catch(error => {
  log(`\n❌ Build error: ${error.message}`, 'red');
  process.exit(1);
});



