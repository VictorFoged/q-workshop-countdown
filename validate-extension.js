#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating AWS Countdown Extension structure...\n');

const requiredFiles = [
  'manifest.json',
  'content-script.js', 
  'styles.css',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png'
];

const optionalFiles = [
  'README.md',
  'INSTALLATION.md',
  'icons/icon.svg',
  'icons/README.md'
];

let allValid = true;

// Check required files
console.log('📋 Required Files:');
requiredFiles.forEach(file => {
  const exists = fs.existsSync(file);
  const status = exists ? '✅' : '❌';
  console.log(`  ${status} ${file}`);
  if (!exists) {
    allValid = false;
  }
});

console.log('\n📄 Optional Files:');
optionalFiles.forEach(file => {
  const exists = fs.existsSync(file);
  const status = exists ? '✅' : '⚪';
  console.log(`  ${status} ${file}`);
});

// Validate manifest.json
console.log('\n🔧 Manifest Validation:');
try {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));
  
  const requiredFields = ['manifest_version', 'name', 'version', 'content_scripts', 'icons'];
  requiredFields.forEach(field => {
    const exists = manifest.hasOwnProperty(field);
    const status = exists ? '✅' : '❌';
    console.log(`  ${status} ${field}`);
    if (!exists) allValid = false;
  });
  
  // Check manifest version
  if (manifest.manifest_version === 3) {
    console.log('  ✅ Manifest V3 (recommended)');
  } else {
    console.log('  ⚠️  Manifest V2 (consider upgrading)');
  }
  
} catch (error) {
  console.log('  ❌ Invalid JSON in manifest.json');
  allValid = false;
}

console.log('\n📊 Validation Summary:');
if (allValid) {
  console.log('✅ Extension is ready for installation!');
  console.log('\n📖 Next steps:');
  console.log('   1. Ensure PNG icons are generated from SVG');
  console.log('   2. Follow INSTALLATION.md for Chrome installation');
  console.log('   3. Test on a page with "/task/1" in the URL');
} else {
  console.log('❌ Extension has missing required files');
  console.log('\n🔧 Required actions:');
  console.log('   1. Create missing files listed above');
  console.log('   2. Generate PNG icons from icons/icon.svg');
  console.log('   3. Run validation again');
}

process.exit(allValid ? 0 : 1);