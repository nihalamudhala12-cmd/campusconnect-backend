// AI Import Audit Script
console.log('=== CampusConnect AI Import Audit ===');
console.log('');

// Check that no files reference the removed LLM provider
const fs = require('fs');
const path = require('path');

const filesToCheck = [
  './src/modules/ai/aiService.js',
  './src/modules/ai/routes.js',
  './src/config/index.js',
];

let issues = [];

filesToCheck.forEach((filePath) => {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      if (line.includes('aiLLMProvider') || line.includes('LLMProvider') || 
          line.includes('apiKey') || line.includes('AI_API_KEY') || 
          line.includes('OPENAI_API_KEY') || line.includes('AI_PROVIDER') ||
          line.includes('AI_API_PROVIDER') || line.includes('AI_MODEL') ||
          line.includes('AI_API_BASE_URL') || line.includes('AI_TIMEOUT_MS') ||
          line.includes('AI_MAX_TOKENS') || line.includes('AI_TEMPERATURE')) {
        issues.push({
          file: filePath,
          line: index + 1,
          content: line.trim()
        });
      }
    });
  }
});

if (issues.length === 0) {
  console.log('PASS: No LLM provider references found in checked files');
  console.log('PASS: No API key references found in checked files');
  console.log('PASS: No provider/model configuration references found');
} else {
  console.log('ISSUES FOUND:');
  issues.forEach((issue) => {
    console.log('  ' + issue.file + ':' + issue.line);
    console.log('    ' + issue.content);
  });
}

console.log('');
console.log('Audit complete.');