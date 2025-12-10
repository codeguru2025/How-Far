#!/usr/bin/env node
/**
 * Environment Validation Script
 * Run before builds to ensure all required environment variables are set
 * 
 * Usage:
 *   node scripts/validate-env.js
 *   node scripts/validate-env.js --strict  (fails on warnings too)
 */

const fs = require('fs');
const path = require('path');

// Colors for terminal output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

// Environment variable definitions
const ENV_VARS = {
  // Required - app won't work without these
  required: [
    {
      name: 'EXPO_PUBLIC_SUPABASE_URL',
      description: 'Supabase project URL',
      pattern: /^https:\/\/[a-z0-9]+\.supabase\.co$/,
      example: 'https://abcdefghijklmnop.supabase.co',
    },
    {
      name: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
      description: 'Supabase anonymous/public key',
      pattern: /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/,
      example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    },
  ],
  
  // Recommended - some features won't work without these
  recommended: [
    {
      name: 'EXPO_PUBLIC_GOOGLE_MAPS_API_KEY',
      description: 'Google Maps API key for maps and directions',
      pattern: /^AIza[A-Za-z0-9_-]{35}$/,
      example: 'AIzaSyC...',
    },
    {
      name: 'EXPO_PUBLIC_PAYNOW_ID',
      description: 'PayNow integration ID for payments',
      pattern: /^[0-9]+$/,
      example: '12345',
    },
    {
      name: 'EXPO_PUBLIC_PAYNOW_KEY',
      description: 'PayNow integration key',
      pattern: /^[a-f0-9-]{36}$/i,
      example: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
    },
  ],
  
  // Optional - nice to have
  optional: [
    {
      name: 'EXPO_PUBLIC_MAPBOX_TOKEN',
      description: 'Mapbox access token (alternative map provider)',
      pattern: /^pk\.[A-Za-z0-9_-]+$/,
      example: 'pk.eyJ1IjoiZXhhbXBsZSIsImEiOiJjbG...',
    },
  ],
};

function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log(`${colors.yellow}⚠️  No .env file found. Creating from .env.example...${colors.reset}`);
    
    const examplePath = path.join(__dirname, '..', '.env.example');
    if (fs.existsSync(examplePath)) {
      fs.copyFileSync(examplePath, envPath);
      console.log(`${colors.green}✓  Created .env file. Please fill in your values.${colors.reset}\n`);
    } else {
      console.log(`${colors.red}✗  No .env.example found either.${colors.reset}\n`);
      return {};
    }
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const env = {};
  
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        env[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
  });
  
  return env;
}

function validateVar(varDef, env) {
  const value = env[varDef.name] || process.env[varDef.name];
  
  if (!value) {
    return { status: 'missing', message: 'Not set' };
  }
  
  if (value.includes('YOUR_') || value.includes('your-') || value === '') {
    return { status: 'placeholder', message: 'Still contains placeholder value' };
  }
  
  if (varDef.pattern && !varDef.pattern.test(value)) {
    return { status: 'invalid', message: 'Invalid format' };
  }
  
  return { status: 'valid', message: 'OK' };
}

function printResult(name, result, description) {
  const icons = {
    valid: `${colors.green}✓${colors.reset}`,
    missing: `${colors.red}✗${colors.reset}`,
    placeholder: `${colors.yellow}⚠${colors.reset}`,
    invalid: `${colors.red}✗${colors.reset}`,
  };
  
  const statusColors = {
    valid: colors.green,
    missing: colors.red,
    placeholder: colors.yellow,
    invalid: colors.red,
  };
  
  console.log(`  ${icons[result.status]} ${name}`);
  console.log(`    ${colors.blue}${description}${colors.reset}`);
  if (result.status !== 'valid') {
    console.log(`    ${statusColors[result.status]}${result.message}${colors.reset}`);
  }
}

function main() {
  const isStrict = process.argv.includes('--strict');
  
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║           🔧 Environment Validation Check                  ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');
  
  const env = loadEnvFile();
  let errors = 0;
  let warnings = 0;
  
  // Check required variables
  console.log(`${colors.blue}Required Variables:${colors.reset}`);
  ENV_VARS.required.forEach(varDef => {
    const result = validateVar(varDef, env);
    printResult(varDef.name, result, varDef.description);
    if (result.status !== 'valid') errors++;
  });
  console.log();
  
  // Check recommended variables
  console.log(`${colors.blue}Recommended Variables:${colors.reset}`);
  ENV_VARS.recommended.forEach(varDef => {
    const result = validateVar(varDef, env);
    printResult(varDef.name, result, varDef.description);
    if (result.status !== 'valid') warnings++;
  });
  console.log();
  
  // Check optional variables
  console.log(`${colors.blue}Optional Variables:${colors.reset}`);
  ENV_VARS.optional.forEach(varDef => {
    const result = validateVar(varDef, env);
    printResult(varDef.name, result, varDef.description);
  });
  console.log();
  
  // Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  if (errors > 0) {
    console.log(`${colors.red}✗ ${errors} required variable(s) not configured${colors.reset}`);
    console.log(`${colors.red}  The app will not work correctly without these.${colors.reset}\n`);
    process.exit(1);
  } else if (warnings > 0 && isStrict) {
    console.log(`${colors.yellow}⚠ ${warnings} recommended variable(s) not configured${colors.reset}`);
    console.log(`${colors.yellow}  Some features may not work without these.${colors.reset}\n`);
    process.exit(1);
  } else if (warnings > 0) {
    console.log(`${colors.yellow}⚠ ${warnings} recommended variable(s) not configured${colors.reset}`);
    console.log(`${colors.green}✓ All required variables are set${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.green}✓ All environment variables are properly configured!${colors.reset}\n`);
    process.exit(0);
  }
}

main();

