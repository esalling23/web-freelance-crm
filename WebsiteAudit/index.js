import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import * as cheerio from 'cheerio';
import axios from 'axios';
import { isProbablyReaderable, Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

class WebsiteAudit {
  constructor() {
    this.lighthouseOptions = {
      logLevel: 'info',
      output: 'json',
      onlyCategories: ['performance', 'seo', 'accessibility', 'best-practices'],
    };
  }

  /**
   * Fetches the HTML content of a website.
   * @param {string} url - The website URL.
   * @returns {string} - The HTML content.
   */
  async fetchHTML(url) {
    try {
      const response = await axios.get(url);
      return response.data;
    } catch (error) {
      console.error(`Error fetching HTML for ${url}:`, error.message);
      return null;
    }
  }

  /**
   * Launches Chrome and runs a Lighthouse audit.
   * @param {string} url - The website URL.
   * @returns {object} - Lighthouse audit results.
   */
  async runLighthouseAudit(url) {
    let chrome;
    try {
      // Launch Chrome
      chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
      const options = {
        ...this.lighthouseOptions,
        port: chrome.port,
      };

      // Run Lighthouse audit
      const result = await lighthouse(url, options, null);
      return result.lhr;
    } catch (error) {
      console.error(`Error running Lighthouse audit for ${url}:`, error.message);
      return null;
    } finally {
      // Close Chrome
      if (chrome) await chrome.kill();
    }
  }

  /**
   * Analyzes on-page SEO using Cheerio and additional checks.
   * @param {string} html - The website's HTML content.
   * @param {string} baseUrl - The base URL of the website.
   * @returns {object} - SEO analysis results.
   */
  async analyzeOnPageSEO(html, baseUrl) {
    const $ = cheerio.load(html);
    const seoData = {
      title: $('title').text().trim(),
      metaDescription: $('meta[name="description"]').attr('content') || '',
      h1Count: $('h1').length,
      h2Count: $('h2').length,
      imageAltTags: $('img').map((i, el) => $(el).attr('alt')).get(),
      canonicalLink: $('link[rel="canonical"]').attr('href') || '',
      robotsTxt: await this.checkRobotsTxt(baseUrl),
      sitemap: await this.checkSitemap(baseUrl),
      structuredData: this.checkStructuredData(html),
      brokenLinks: await this.findBrokenLinks(html, baseUrl),
      keywordDensity: this.calculateKeywordDensity(html),
      readability: this.calculateReadability(html),
    };
    return seoData;
  }

  /**
   * Checks if the robots.txt file exists and is accessible.
   * @param {string} baseUrl - The base URL of the website.
   * @returns {boolean} - True if robots.txt is valid, false otherwise.
   */
  async checkRobotsTxt(baseUrl) {
    try {
      const response = await axios.get(`${baseUrl}/robots.txt`);
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Checks if the sitemap.xml file exists and is accessible.
   * @param {string} baseUrl - The base URL of the website.
   * @returns {boolean} - True if sitemap.xml is valid, false otherwise.
   */
  async checkSitemap(baseUrl) {
    try {
      const response = await axios.get(`${baseUrl}/sitemap.xml`);
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  /**
   * Checks for structured data (schema.org markup).
   * @param {string} html - The website's HTML content.
   * @returns {boolean} - True if structured data is found, false otherwise.
   */
  checkStructuredData(html) {
    const $ = cheerio.load(html);
    const jsonLd = $('script[type="application/ld+json"]').html();
    const microdata = $('[itemscope]').length > 0;
    return !!jsonLd || microdata;
  }

  /**
   * Finds broken links on the website.
   * @param {string} html - The website's HTML content.
   * @param {string} baseUrl - The base URL of the website.
   * @returns {number} - Number of broken links.
   */
  async findBrokenLinks(html, baseUrl) {
    const $ = cheerio.load(html);
    const links = $('a')
      .map((i, el) => $(el).attr('href'))
      .get()
      .filter((link) => link && !link.startsWith('#'));

    let brokenLinks = 0;
    for (const link of links) {
      const absoluteUrl = new URL(link, baseUrl).href;
      try {
        const response = await axios.get(absoluteUrl);
        if (response.status !== 200) brokenLinks++;
      } catch (error) {
        brokenLinks++;
      }
    }
    return brokenLinks;
  }

  /**
   * Calculates keyword density in the content.
   * @param {string} html - The website's HTML content.
   * @returns {number} - Keyword density as a percentage.
   */
  calculateKeywordDensity(html) {
    const $ = cheerio.load(html);
    const text = $('body').text();
    const words = text.split(/\s+/).filter((word) => word.length > 0);
    const targetKeyword = 'example'; // Replace with dynamic keyword
    const keywordCount = words.filter((word) => word.toLowerCase() === targetKeyword).length;
    return ((keywordCount / words.length) * 100).toFixed(2);
  }

  /**
   * Calculates the readability score using Flesch-Kincaid.
   * @param {string} html - The website's HTML content.
   * @returns {number} - Readability score.
   */
  calculateReadability(html) {
    const dom = new JSDOM(html);
    const canRead = isProbablyReaderable(dom.window.document)
    if (!canRead) return 0;

    const article = new Readability(dom.window.document);
    if (!article) return 0;

    const parsed = article.parse()
    const text = parsed.textContent;

    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).length;
    const syllables = text.split('').filter((char) => /[aeiouy]/i.test(char)).length;

    const readabilityScore = (
      206.835 -
      1.015 * (words / sentences) -
      84.6 * (syllables / words)
    ).toFixed(2);

    return readabilityScore;
  }

  /**
   * Generates an overall SEO score based on Lighthouse and on-page SEO analysis.
   * @param {object} lighthouseResults - Lighthouse audit results.
   * @param {object} seoData - On-page SEO analysis results.
   * @returns {number} - SEO score (0-100).
   */
  generateSEOScore(lighthouseResults, seoData) {
    const lighthouseSEOScore = lighthouseResults.categories.seo.score * 100;
    const onPageSEOScore = this.calculateOnPageSEOScore(seoData);
    const overallScore = (lighthouseSEOScore + onPageSEOScore) / 2;
    return Math.round(overallScore);
  }

  /**
   * Calculates a score for on-page SEO factors.
   * @param {object} seoData - On-page SEO analysis results.
   * @returns {number} - On-page SEO score (0-100).
   */
  calculateOnPageSEOScore(seoData) {
    let score = 0;
    if (seoData.title) score += 20;
    if (seoData.metaDescription) score += 20;
    if (seoData.h1Count === 1) score += 20;
    if (seoData.canonicalLink) score += 20;
    if (seoData.imageAltTags.every((alt) => alt)) score += 20;
    return score;
  }


  /**
   * Emit progress updates during the audit.
   * @param {Function} emitProgress - A callback function to emit progress updates.
   */
  async auditSiteWithProgress(url, emitProgress) {
    emitProgress('Fetching HTML...');
    const html = await this.fetchHTML(url);
    if (!html) {
      emitProgress('Failed to fetch HTML.');
      return null;
    }

    emitProgress('Running Lighthouse audit...');
    const lightushouseResults = await this.runLighthouseAudit(url);
    if (!lighthouseResults) {
      emitProgress('Failed to run Lighthouse audit.');
      return null;
    }

    emitProgress('Analyzing on-page SEO...');
    const seoData = await this.analyzeOnPageSEO(html, url);

    emitProgress('Calculating SEO score...');
    const seoScore = this.generateSEOScore(lighthouseResults, seoData);

    emitProgress('Audit complete.');
    return {
      url,
      lighthoeResults: lighthouseResults.categories,
      seoData,
      seoScore,
    };
  }

  /**
   * Audits a website and returns the results.
   * @param {string} url - The website URL.
   * @returns {object} - Audit results.
   */
  async auditSite(url) {
    const html = await this.fetchHTML(url);
    if (!html) {
      console.error('Failed to fetch HTML.');
      return null;
    }

    const lighthouseResults = await this.runLighthouseAudit(url);
    if (!lighthouseResults) {
      console.error('Failed to run Lighthouse audit.');
      return null;
    }

    // console.log({lighthouseResults})

    const seoData = await this.analyzeOnPageSEO(html, url);
    const seoScore = this.generateSEOScore(lighthouseResults, seoData);

    return {
      // url,
      // lighthouseResults: lighthouseResults.categories,
      // seoData,
      seoScore,
    };
  }
}

// Example usage
// (async () => {
//   const myAuditer = new WebsiteAudit();
//   const results = await myAuditer.auditSite('https://eronsalling.me');
//   console.log(JSON.stringify(results, null, 2));
// })();

export default WebsiteAudit