import WebsiteAudit from './WebsiteAudit.js';
import axios from 'axios';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

// Mock axios to avoid making real HTTP requests
jest.mock('axios');

// Mock lighthouse and chromeLauncher
jest.mock('lighthouse', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue({
    lhr: {
      categories: {
        performance: { score: 0.99 },
        seo: { score: 1 },
        accessibility: { score: 0.95 },
        'best-practices': { score: 0.92 },
      },
    },
  }),
}));

jest.mock('chrome-launcher', () => ({
  launch: jest.fn().mockResolvedValue({
    port: 9222,
    kill: jest.fn(),
  }),
}));

describe('WebsiteAudit', () => {
  let websiteAudit;

  beforeEach(() => {
    websiteAudit = new WebsiteAudit();
  });

  describe('fetchHTML', () => {
    it('should fetch HTML content successfully', async () => {
      const mockHtml = '<html><title>Test</title></html>';
      axios.get.mockResolvedValue({ data: mockHtml });

      const html = await websiteAudit.fetchHTML('https://example.com');
      expect(html).toBe(mockHtml);
    });

    it('should return null if fetching HTML fails', async () => {
      axios.get.mockRejectedValue(new Error('Network Error'));

      const html = await websiteAudit.fetchHTML('https://example.com');
      expect(html).toBeNull();
    });
  });

  describe('runLighthouseAudit', () => {
    it('should run a Lighthouse audit successfully', async () => {
      const result = await websiteAudit.runLighthouseAudit('https://example.com');
      expect(result).toEqual({
        categories: {
          performance: { score: 0.99 },
          seo: { score: 1 },
          accessibility: { score: 0.95 },
          'best-practices': { score: 0.92 },
        },
      });
    });

    it('should return null if Lighthouse audit fails', async () => {
      jest.spyOn(console, 'error').mockImplementation(() => {});
      jest
        .spyOn(require('lighthouse'), 'default')
        .mockRejectedValue(new Error('Lighthouse Error'));

      const result = await websiteAudit.runLighthouseAudit('https://example.com');
      expect(result).toBeNull();
    });
  });

  describe('analyzeOnPageSEO', () => {
    it('should analyze on-page SEO successfully', async () => {
      const mockHtml = `
        <html>
          <title>Test Title</title>
          <meta name="description" content="Test Description">
          <h1>Heading 1</h1>
          <h2>Heading 2</h2>
          <img alt="Test Alt">
          <link rel="canonical" href="https://example.com">
        </html>
      `;

      // Mock axios for robots.txt and sitemap.xml
      axios.get.mockResolvedValue({ status: 200 });

      const seoData = await websiteAudit.analyzeOnPageSEO(mockHtml, 'https://example.com');
      expect(seoData).toEqual({
        title: 'Test Title',
        metaDescription: 'Test Description',
        h1Count: 1,
        h2Count: 1,
        imageAltTags: ['Test Alt'],
        canonicalLink: 'https://example.com',
        robotsTxt: true,
        sitemap: true,
        structuredData: false,
        brokenLinks: 0,
        keywordDensity: '0.00',
        readability: expect.any(String),
      });
    });
  });

  describe('checkRobotsTxt', () => {
    it('should return true if robots.txt exists', async () => {
      axios.get.mockResolvedValue({ status: 200 });

      const exists = await websiteAudit.checkRobotsTxt('https://example.com');
      expect(exists).toBe(true);
    });

    it('should return false if robots.txt does not exist', async () => {
      axios.get.mockRejectedValue(new Error('Not Found'));

      const exists = await websiteAudit.checkRobotsTxt('https://example.com');
      expect(exists).toBe(false);
    });
  });

  describe('checkSitemap', () => {
    it('should return true if sitemap.xml exists', async () => {
      axios.get.mockResolvedValue({ status: 200 });

      const exists = await websiteAudit.checkSitemap('https://example.com');
      expect(exists).toBe(true);
    });

    it('should return false if sitemap.xml does not exist', async () => {
      axios.get.mockRejectedValue(new Error('Not Found'));

      const exists = await websiteAudit.checkSitemap('https://example.com');
      expect(exists).toBe(false);
    });
  });

  describe('checkStructuredData', () => {
    it('should return true if structured data is found', () => {
      const mockHtml = `
        <html>
          <script type="application/ld+json">{"@context":"https://schema.org"}</script>
        </html>
      `;

      const hasStructuredData = websiteAudit.checkStructuredData(mockHtml);
      expect(hasStructuredData).toBe(true);
    });

    it('should return false if no structured data is found', () => {
      const mockHtml = '<html></html>';

      const hasStructuredData = websiteAudit.checkStructuredData(mockHtml);
      expect(hasStructuredData).toBe(false);
    });
  });

  describe('findBrokenLinks', () => {
    it('should return the number of broken links', async () => {
      const mockHtml = `
        <html>
          <a href="https://example.com/valid">Valid Link</a>
          <a href="https://example.com/broken">Broken Link</a>
        </html>
      `;

      // Mock axios responses
      axios.get.mockImplementation((url) => {
        if (url === 'https://example.com/valid') {
          return Promise.resolve({ status: 200 });
        } else {
          return Promise.reject(new Error('Not Found'));
        }
      });

      const brokenLinks = await websiteAudit.findBrokenLinks(mockHtml, 'https://example.com');
      expect(brokenLinks).toBe(1);
    });
  });

  describe('calculateKeywordDensity', () => {
    it('should calculate keyword density correctly', () => {
      const mockHtml = `
        <html>
          <body>This is a test keyword keyword.</body>
        </html>
      `;

      const density = websiteAudit.calculateKeywordDensity(mockHtml);
      expect(density).toBe('28.57'); // 2 keywords / 7 words * 100
    });
  });

  describe('calculateReadability', () => {
    it('should calculate readability score correctly', () => {
      const mockHtml = `
        <html>
          <body>This is a simple sentence. It has two sentences.</body>
        </html>
      `;

      const score = websiteAudit.calculateReadability(mockHtml);
      expect(score).toBe(expect.any(String)); // Score depends on the formula
    });
  });

  describe('generateSEOScore', () => {
    it('should generate an SEO score correctly', () => {
      const lighthouseResults = {
        categories: {
          seo: { score: 1 },
        },
      };

      const seoData = {
        title: 'Test Title',
        metaDescription: 'Test Description',
        h1Count: 1,
        canonicalLink: 'https://example.com',
        imageAltTags: ['Test Alt'],
      };

      const score = websiteAudit.generateSEOScore(lighthouseResults, seoData);
      expect(score).toBe(100); // Max score
    });
  });

  describe('auditSite', () => {
    it('should return audit results successfully', async () => {
      const mockHtml = `
        <html>
          <title>Test Title</title>
          <meta name="description" content="Test Description">
          <h1>Heading 1</h1>
          <h2>Heading 2</h2>
          <img alt="Test Alt">
          <link rel="canonical" href="https://example.com">
        </html>
      `;

      // Mock all dependencies
      axios.get.mockResolvedValue({ data: mockHtml, status: 200 });

      const results = await websiteAudit.auditSite('https://example.com');
      expect(results).toEqual({
        url: 'https://example.com',
        lighthouseResults: {
          performance: { score: 0.99 },
          seo: { score: 1 },
          accessibility: { score: 0.95 },
          'best-practices': { score: 0.92 },
        },
        seoData: expect.any(Object),
        seoScore: expect.any(Number),
      });
    });

    it('should return null if fetching HTML fails', async () => {
      axios.get.mockRejectedValue(new Error('Network Error'));

      const results = await websiteAudit.auditSite('https://example.com');
      expect(results).toBeNull();
    });

    it('should return null if Lighthouse audit fails', async () => {
      axios.get.mockResolvedValue({ data: '<html></html>' });
      jest
        .spyOn(require('lighthouse'), 'default')
        .mockRejectedValue(new Error('Lighthouse Error'));

      const results = await websiteAudit.auditSite('https://example.com');
      expect(results).toBeNull();
    });
  });
});