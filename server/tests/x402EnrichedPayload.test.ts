/**
 * X402 ENRICHED PAYLOAD REGRESSION TESTS
 * 
 * These tests verify that 402 responses include the required enrichment fields:
 * - recommendedServices: Array of cross-sell service recommendations
 * - catalogUrl: URL to the full service catalog
 * - totalServicesAvailable: Count of all available services
 * - discoverable: true (per payment requirement for x402scan compatibility)
 * - facilitatorUrl: URL to the x402 facilitator
 * 
 * CRITICAL: These fields are required for AI agent discovery and cross-sell.
 * 
 * This test suite includes:
 * 1. Unit tests for serviceCatalogService
 * 2. Middleware integration tests using a minimal Express app
 */

import { describe, test, expect, beforeAll } from '@jest/globals';
import express, { Request, Response } from 'express';
import request from 'supertest';
import { serviceCatalogService } from '../services/serviceCatalogService';
import { x402TrackingMiddleware } from '../middleware/x402TrackingMiddleware';

const EXPECTED_CATALOG_URL = 'https://coinrailz.com/x402/catalog';

// Create a minimal test app that uses the tracking middleware
function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // Apply tracking middleware
  app.use('/x402', x402TrackingMiddleware);
  
  // Test endpoint that returns 402 (V2 format)
  app.get('/x402/test-service', (req: Request, res: Response) => {
    res.status(402).json({
      x402Version: 2,
      error: 'X-PAYMENT header is required',
      accepts: [{
        scheme: 'exact',
        network: 'eip155:8453',
        maxAmountRequired: '100000',
        discoverable: true,
      }],
      facilitatorUrl: 'https://x402.org/facilitator'
    });
  });
  
  return app;
}

describe('x402 Enriched 402 Payload Tests', () => {
  beforeAll(async () => {
    console.log('🧪 Starting x402 enriched payload regression tests...');
  });

  describe('ServiceCatalogService Unit Tests', () => {
    test('should have catalog with services', () => {
      const catalog = serviceCatalogService.getFullCatalog();
      
      expect(catalog).toHaveProperty('services');
      expect(Array.isArray(catalog.services)).toBe(true);
      expect(catalog.services.length).toBeGreaterThan(0);
      
      console.log(`✅ Catalog has ${catalog.services.length} services`);
    });

    test('should return catalog summary with required fields', () => {
      const summary = serviceCatalogService.getCatalogSummary();
      
      expect(summary).toHaveProperty('totalServices');
      expect(summary).toHaveProperty('catalogUrl');
      expect(typeof summary.totalServices).toBe('number');
      expect(summary.totalServices).toBeGreaterThan(0);
      expect(summary.catalogUrl).toBe(EXPECTED_CATALOG_URL);
      
      console.log(`✅ Catalog summary: ${summary.totalServices} services at ${summary.catalogUrl}`);
    });

    test('should return recommendations for a service', () => {
      const recommendations = serviceCatalogService.getRecommendedServices('ping');
      
      expect(Array.isArray(recommendations)).toBe(true);
      
      if (recommendations.length > 0) {
        const rec = recommendations[0];
        expect(rec).toHaveProperty('id');
        expect(rec).toHaveProperty('name');
        expect(rec).toHaveProperty('priceUSD');
        expect(rec).toHaveProperty('endpoint');
      }
      
      console.log(`✅ Got ${recommendations.length} recommendations for 'ping' service`);
    });

    test('should have minimum required service count', () => {
      const summary = serviceCatalogService.getCatalogSummary();
      expect(summary.totalServices).toBeGreaterThanOrEqual(30);
      console.log(`✅ Total services (${summary.totalServices}) meets minimum threshold (30)`);
    });
  });

  describe('Middleware Integration Tests', () => {
    const app = createTestApp();
    
    test('should include recommendedServices in 402 response via middleware', async () => {
      const response = await request(app)
        .get('/x402/test-service')
        .expect(402);
      
      expect(response.body).toHaveProperty('recommendedServices');
      expect(Array.isArray(response.body.recommendedServices)).toBe(true);
      // Require at least 1 recommendation to catch broken catalog lookups
      expect(response.body.recommendedServices.length).toBeGreaterThanOrEqual(1);
      
      console.log(`✅ Middleware enriched with ${response.body.recommendedServices.length} recommendations`);
    });

    test('should include catalogUrl in 402 response via middleware', async () => {
      const response = await request(app)
        .get('/x402/test-service')
        .expect(402);
      
      expect(response.body).toHaveProperty('catalogUrl');
      expect(response.body.catalogUrl).toBe(EXPECTED_CATALOG_URL);
      
      console.log(`✅ Middleware enriched with catalogUrl: ${response.body.catalogUrl}`);
    });

    test('should include totalServicesAvailable in 402 response via middleware', async () => {
      const response = await request(app)
        .get('/x402/test-service')
        .expect(402);
      
      expect(response.body).toHaveProperty('totalServicesAvailable');
      expect(typeof response.body.totalServicesAvailable).toBe('number');
      expect(response.body.totalServicesAvailable).toBeGreaterThan(0);
      
      console.log(`✅ Middleware enriched with totalServicesAvailable: ${response.body.totalServicesAvailable}`);
    });

    test('should preserve facilitatorUrl in 402 response', async () => {
      const response = await request(app)
        .get('/x402/test-service')
        .expect(402);
      
      expect(response.body).toHaveProperty('facilitatorUrl');
      expect(response.body.facilitatorUrl).toContain('x402.io');
      
      console.log(`✅ facilitatorUrl preserved: ${response.body.facilitatorUrl}`);
    });

    test('should preserve discoverable:true in accepts array', async () => {
      const response = await request(app)
        .get('/x402/test-service')
        .expect(402);
      
      expect(response.body).toHaveProperty('accepts');
      expect(Array.isArray(response.body.accepts)).toBe(true);
      expect(response.body.accepts.length).toBeGreaterThan(0);
      expect(response.body.accepts[0]).toHaveProperty('discoverable', true);
      
      console.log('✅ discoverable:true preserved in accepts array');
    });

    test('should include all required enrichment fields together', async () => {
      const response = await request(app)
        .get('/x402/test-service')
        .expect(402);
      
      // All required fields must be present
      const requiredFields = [
        'recommendedServices',
        'catalogUrl', 
        'totalServicesAvailable',
        'facilitatorUrl',
        'accepts'
      ];
      
      requiredFields.forEach(field => {
        expect(response.body).toHaveProperty(field);
      });
      
      // Validate types
      expect(Array.isArray(response.body.recommendedServices)).toBe(true);
      expect(typeof response.body.catalogUrl).toBe('string');
      expect(typeof response.body.totalServicesAvailable).toBe('number');
      expect(typeof response.body.facilitatorUrl).toBe('string');
      expect(Array.isArray(response.body.accepts)).toBe(true);
      
      console.log('✅ All required enrichment fields present with correct types');
    });

    test('recommendations should have valid structure', async () => {
      const response = await request(app)
        .get('/x402/test-service')
        .expect(402);
      
      if (response.body.recommendedServices.length > 0) {
        const rec = response.body.recommendedServices[0];
        expect(rec).toHaveProperty('id');
        expect(rec).toHaveProperty('name');
        expect(rec).toHaveProperty('priceUSD');
        expect(rec).toHaveProperty('endpoint');
        expect(typeof rec.id).toBe('string');
        expect(typeof rec.name).toBe('string');
        expect(typeof rec.priceUSD).toBe('string');
        expect(typeof rec.endpoint).toBe('string');
      }
      
      console.log('✅ Recommendations have valid structure');
    });
  });
});
