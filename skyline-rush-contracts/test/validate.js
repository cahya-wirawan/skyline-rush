const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const Ajv = require('ajv');

async function main() {
  console.log('Validating skyline-rush-contracts schemas and OpenAPI specification...');
  
  // 1. Validate OpenAPI file parses as valid YAML
  const openapiPath = path.join(__dirname, '../openapi.yaml');
  const openapiRaw = fs.readFileSync(openapiPath, 'utf8');
  const openapiDoc = yaml.load(openapiRaw);
  
  if (!openapiDoc.openapi || !openapiDoc.openapi.startsWith('3.')) {
    throw new Error(`Expected OpenAPI 3.x, found: ${openapiDoc.openapi}`);
  }
  
  const pathKeys = Object.keys(openapiDoc.paths);
  console.log(`✓ Parsed OpenAPI YAML successfully. Found ${pathKeys.length} paths.`);

  // Check required endpoints from 06_API_SPEC
  const requiredEndpoints = [
    '/v1/auth/guest',
    '/v1/auth/apple',
    '/v1/auth/refresh',
    '/v1/profile',
    '/v1/runs',
    '/v1/runs/{run_id}/redeploy',
    '/v1/economy/balance',
    '/v1/economy/ledger',
    '/v1/contracts/active',
    '/v1/contracts/{contract_id}/claim',
    '/v1/supply-drops/tables/{table_id}',
    '/v1/supply-drops/open',
    '/v1/roster',
    '/v1/roster/equip',
    '/v1/roster/unlock',
    '/v1/leaderboard',
    '/v1/friends/add',
    '/v1/purchases/receipt',
    '/v1/privacy/export',
    '/v1/privacy/delete',
    '/v1/liveops/config',
    '/v1/webhooks/apple'
  ];

  for (const ep of requiredEndpoints) {
    if (!openapiDoc.paths[ep]) {
      throw new Error(`Missing expected endpoint: ${ep}`);
    }
  }
  console.log(`✓ All ${requiredEndpoints.length} specified endpoints present in OpenAPI spec.`);

  // 2. Validate JSON Schemas with Ajv
  const ajv = new Ajv({ allErrors: true, strict: false });
  const addFormats = require('ajv-formats');
  addFormats(ajv);

  // Supply Drop Table Schema
  const supplyDropSchemaPath = path.join(__dirname, '../schemas/supply-drop-table.schema.json');
  const supplyDropSchema = JSON.parse(fs.readFileSync(supplyDropSchemaPath, 'utf8'));
  const validateSupplyDrop = ajv.compile(supplyDropSchema);

  // Test valid supply drop table
  const validTable = {
    table_id: 'standard-v7',
    version: 7,
    published_at: '2026-08-31T00:00:00Z',
    entries: [
      { reward: 'chips_small', probability: 0.55, min_amount: 500, max_amount: 1000 },
      { reward: 'cores_small', probability: 0.25, min_amount: 5, max_amount: 15 },
      { reward: 'chips_medium', probability: 0.20, min_amount: 1500, max_amount: 2500 }
    ]
  };
  if (!validateSupplyDrop(validTable)) {
    throw new Error(`Valid supply drop table failed validation: ${JSON.stringify(validateSupplyDrop.errors)}`);
  }

  // Test invalid supply drop table (missing version)
  const invalidTable = { table_id: 'bad-table', entries: [] };
  if (validateSupplyDrop(invalidTable)) {
    throw new Error('Invalid supply drop table was incorrectly accepted');
  }
  console.log('✓ Supply drop schema validated with positive and negative cases.');

  // Content Pack Schema
  const contentPackSchemaPath = path.join(__dirname, '../schemas/content-pack.schema.json');
  const contentPackSchema = JSON.parse(fs.readFileSync(contentPackSchemaPath, 'utf8'));
  const validateContentPack = ajv.compile(contentPackSchema);

  const validContentPack = {
    content_pack_id: 'a0000000-0000-0000-0000-000000000001',
    district_id: 'neo-marina',
    version: '1.2.0',
    cdn_url: 'https://cdn.skylinerush.game/districts/neo-marina-1.2.0.bundle',
    checksum: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    status: 'live'
  };
  if (!validateContentPack(validContentPack)) {
    throw new Error(`Valid content pack failed validation: ${JSON.stringify(validateContentPack.errors)}`);
  }

  const invalidContentPack = { district_id: 'neo-marina' };
  if (validateContentPack(invalidContentPack)) {
    throw new Error('Invalid content pack was incorrectly accepted');
  }
  console.log('✓ Content pack schema validated with positive and negative cases.');

  console.log('All contracts and schemas successfully verified!');
}

main().catch(err => {
  console.error('Validation failed:', err);
  process.exit(1);
});
