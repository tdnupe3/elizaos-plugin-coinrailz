/**
 * 🎯 Professional PDF Generation Service
 * Generates high-quality audit reports and certificates using Puppeteer + pdf-lib
 * For $1K professional smart contract auditing service
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs/promises';
import path from 'path';

interface AuditReportData {
  auditId: string;
  contractName: string;
  blockchain: string;
  contractType: string;
  customerEmail?: string;
  guestEmail?: string;
  grade: string;
  score: number;
  auditSummary: string;
  vulnerabilities: Array<{
    title: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
    description: string;
    recommendation: string;
    codeLocation?: string;
  }>;
  recommendations: string;
  gasOptimizations: string;
  auditDate: Date;
  certificateId: string;
}

interface CertificateData {
  certificateId: string;
  contractName: string;
  blockchain: string;
  grade: string;
  score: number;
  auditDate: Date;
  validUntil: Date;
}

export class PDFGenerationService {
  private static instance: PDFGenerationService;
  private readonly outputDir = path.join(process.cwd(), 'generated-pdfs');

  constructor() {
    this.ensureOutputDirectory();
  }

  static getInstance(): PDFGenerationService {
    if (!PDFGenerationService.instance) {
      PDFGenerationService.instance = new PDFGenerationService();
    }
    return PDFGenerationService.instance;
  }

  private async ensureOutputDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.outputDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create PDF output directory:', error);
    }
  }

  /**
   * Generate complete audit report PDF using Puppeteer
   */
  async generateAuditReport(data: AuditReportData): Promise<string> {
    let browser: Browser | null = null;

    try {
      console.log(`🔍 Generating audit report PDF for ${data.auditId}...`);

      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      });

      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 1600 });

      // Generate HTML content for the audit report
      const htmlContent = this.generateAuditReportHTML(data);
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

      // Generate PDF with professional styling
      const pdfPath = path.join(this.outputDir, `audit-report-${data.auditId}.pdf`);
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
        displayHeaderFooter: true,
        headerTemplate: `
          <div style="font-size: 10px; color: #666; width: 100%; text-align: center; margin-top: 10px;">
            Coin Railz Professional Smart Contract Audit Report
          </div>
        `,
        footerTemplate: `
          <div style="font-size: 10px; color: #666; width: 100%; text-align: center; margin-bottom: 10px;">
            <span class="pageNumber"></span> / <span class="totalPages"></span> | Generated on ${new Date().toLocaleDateString()}
          </div>
        `,
      });

      console.log(`✅ Audit report PDF generated: ${pdfPath}`);
      return pdfPath;

    } catch (error) {
      console.error('❌ Failed to generate audit report PDF:', error);
      throw new Error(`PDF generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Generate professional security certificate using pdf-lib
   */
  async generateSecurityCertificate(data: CertificateData): Promise<string> {
    try {
      console.log(`🏆 Generating security certificate for ${data.certificateId}...`);

      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points
      const { width, height } = page.getSize();

      // Load fonts
      const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

      // Certificate background (gradient effect using rectangles)
      page.drawRectangle({
        x: 0,
        y: 0,
        width,
        height,
        color: rgb(0.95, 0.97, 1), // Light blue background
      });

      // Header border
      page.drawRectangle({
        x: 0,
        y: height - 100,
        width,
        height: 100,
        color: rgb(0.1, 0.3, 0.7), // Dark blue header
      });

      // Title
      page.drawText('SMART CONTRACT SECURITY CERTIFICATE', {
        x: 50,
        y: height - 60,
        size: 24,
        font: titleFont,
        color: rgb(1, 1, 1), // White text
      });

      // Coin Railz branding
      page.drawText('Coin Railz Professional Audit Platform', {
        x: 50,
        y: height - 85,
        size: 12,
        font: bodyFont,
        color: rgb(0.9, 0.9, 0.9),
      });

      // Certificate content
      const gradeColor = this.getGradeColor(data.grade);
      
      // Grade badge
      page.drawRectangle({
        x: width - 150,
        y: height - 200,
        width: 100,
        height: 60,
        color: gradeColor,
      });

      page.drawText(data.grade, {
        x: width - 125,
        y: height - 180,
        size: 36,
        font: titleFont,
        color: rgb(1, 1, 1),
      });

      // Contract details
      const startY = height - 250;
      const lineHeight = 25;
      let currentY = startY;

      const details = [
        ['Certificate ID:', data.certificateId],
        ['Contract Name:', data.contractName],
        ['Blockchain:', data.blockchain.toUpperCase()],
        ['Security Score:', `${data.score}/100`],
        ['Audit Date:', data.auditDate.toLocaleDateString()],
        ['Valid Until:', data.validUntil.toLocaleDateString()],
      ];

      details.forEach(([label, value]) => {
        page.drawText(label, {
          x: 50,
          y: currentY,
          size: 12,
          font: titleFont,
          color: rgb(0.2, 0.2, 0.2),
        });

        page.drawText(value, {
          x: 200,
          y: currentY,
          size: 12,
          font: bodyFont,
          color: rgb(0, 0, 0),
        });

        currentY -= lineHeight;
      });

      // Certification statement
      page.drawText('This certificate verifies that the above smart contract has been', {
        x: 50,
        y: currentY - 30,
        size: 11,
        font: bodyFont,
        color: rgb(0.3, 0.3, 0.3),
      });

      page.drawText('professionally audited by Coin Railz security experts using', {
        x: 50,
        y: currentY - 50,
        size: 11,
        font: bodyFont,
        color: rgb(0.3, 0.3, 0.3),
      });

      page.drawText('industry-standard static analysis tools and manual review.', {
        x: 50,
        y: currentY - 70,
        size: 11,
        font: bodyFont,
        color: rgb(0.3, 0.3, 0.3),
      });

      // Verification QR code placeholder
      page.drawRectangle({
        x: width - 150,
        y: 50,
        width: 100,
        height: 100,
        color: rgb(0.9, 0.9, 0.9),
        borderColor: rgb(0.7, 0.7, 0.7),
        borderWidth: 1,
      });

      page.drawText('QR Code', {
        x: width - 130,
        y: 110,
        size: 10,
        font: bodyFont,
        color: rgb(0.5, 0.5, 0.5),
      });

      page.drawText('Scan to verify', {
        x: width - 140,
        y: 95,
        size: 8,
        font: bodyFont,
        color: rgb(0.5, 0.5, 0.5),
      });

      // Save certificate
      const certificatePath = path.join(this.outputDir, `certificate-${data.certificateId}.pdf`);
      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(certificatePath, pdfBytes);

      console.log(`✅ Security certificate generated: ${certificatePath}`);
      return certificatePath;

    } catch (error) {
      console.error('❌ Failed to generate security certificate:', error);
      throw new Error(`Certificate generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate HTML content for audit report
   */
  private generateAuditReportHTML(data: AuditReportData): string {
    const customerInfo = data.customerEmail || data.guestEmail || 'Guest User';
    
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Smart Contract Audit Report - ${data.auditId}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          line-height: 1.6;
          color: #333;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
        }
        
        .container {
          max-width: 1000px;
          margin: 0 auto;
          background: white;
          min-height: 100vh;
          box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        
        .header {
          background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
          color: white;
          padding: 40px;
          text-align: center;
        }
        
        .header h1 {
          font-size: 2.5rem;
          margin-bottom: 10px;
          font-weight: 700;
        }
        
        .header .subtitle {
          font-size: 1.2rem;
          opacity: 0.9;
        }
        
        .audit-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          padding: 30px 40px;
          background: #f8f9fa;
          border-bottom: 1px solid #e9ecef;
        }
        
        .info-card {
          background: white;
          padding: 20px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .info-card h3 {
          color: #1e3c72;
          margin-bottom: 15px;
          font-size: 1.2rem;
        }
        
        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid #f0f0f0;
        }
        
        .info-label {
          font-weight: 600;
          color: #666;
        }
        
        .grade-badge {
          display: inline-block;
          padding: 10px 20px;
          border-radius: 50px;
          font-weight: bold;
          font-size: 1.5rem;
          color: white;
          text-align: center;
          min-width: 80px;
        }
        
        .grade-A { background: linear-gradient(135deg, #28a745, #20c997); }
        .grade-B { background: linear-gradient(135deg, #ffc107, #fd7e14); }
        .grade-F { background: linear-gradient(135deg, #dc3545, #e83e8c); }
        
        .content {
          padding: 40px;
        }
        
        .section {
          margin-bottom: 40px;
        }
        
        .section h2 {
          color: #1e3c72;
          font-size: 1.8rem;
          margin-bottom: 20px;
          padding-bottom: 10px;
          border-bottom: 3px solid #667eea;
        }
        
        .vulnerability {
          background: white;
          border: 1px solid #e9ecef;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          box-shadow: 0 2px 5px rgba(0,0,0,0.05);
        }
        
        .vulnerability h4 {
          margin-bottom: 10px;
          font-size: 1.2rem;
        }
        
        .severity {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: bold;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        
        .severity-critical { background: #dc3545; color: white; }
        .severity-high { background: #fd7e14; color: white; }
        .severity-medium { background: #ffc107; color: #212529; }
        .severity-low { background: #28a745; color: white; }
        .severity-info { background: #17a2b8; color: white; }
        
        .recommendation-box {
          background: #e7f3ff;
          border-left: 4px solid #007bff;
          padding: 20px;
          margin: 20px 0;
          border-radius: 0 8px 8px 0;
        }
        
        .footer {
          background: #f8f9fa;
          padding: 30px 40px;
          text-align: center;
          border-top: 1px solid #e9ecef;
          color: #666;
        }
        
        .footer .logo {
          font-size: 1.5rem;
          font-weight: bold;
          color: #1e3c72;
          margin-bottom: 10px;
        }
        
        @media print {
          body { background: white; }
          .container { box-shadow: none; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Smart Contract Security Audit</h1>
          <div class="subtitle">Professional Security Analysis Report</div>
        </div>
        
        <div class="audit-info">
          <div class="info-card">
            <h3>📄 Contract Information</h3>
            <div class="info-row">
              <span class="info-label">Contract Name:</span>
              <span>${data.contractName}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Blockchain:</span>
              <span>${data.blockchain.toUpperCase()}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Contract Type:</span>
              <span>${data.contractType.toUpperCase()}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Audit ID:</span>
              <span>${data.auditId}</span>
            </div>
          </div>
          
          <div class="info-card">
            <h3>🎯 Audit Results</h3>
            <div class="info-row">
              <span class="info-label">Security Grade:</span>
              <span class="grade-badge grade-${data.grade}">${data.grade}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Security Score:</span>
              <span style="font-size: 1.2rem; font-weight: bold;">${data.score}/100</span>
            </div>
            <div class="info-row">
              <span class="info-label">Vulnerabilities:</span>
              <span>${data.vulnerabilities.length} found</span>
            </div>
            <div class="info-row">
              <span class="info-label">Audit Date:</span>
              <span>${data.auditDate.toLocaleDateString()}</span>
            </div>
          </div>
        </div>
        
        <div class="content">
          <div class="section">
            <h2>📊 Executive Summary</h2>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; font-size: 1.1rem; line-height: 1.8;">
              ${data.auditSummary}
            </div>
          </div>
          
          ${data.vulnerabilities.length > 0 ? `
          <div class="section">
            <h2>🔍 Security Findings</h2>
            ${data.vulnerabilities.map(vuln => `
              <div class="vulnerability">
                <div class="severity severity-${vuln.severity.toLowerCase()}">${vuln.severity}</div>
                <h4>${vuln.title}</h4>
                <p style="margin-bottom: 15px; color: #666;">${vuln.description}</p>
                ${vuln.codeLocation ? `<div style="background: #f1f3f4; padding: 10px; border-radius: 4px; font-family: monospace; margin-bottom: 15px;">Location: ${vuln.codeLocation}</div>` : ''}
                <div class="recommendation-box">
                  <strong>💡 Recommendation:</strong> ${vuln.recommendation}
                </div>
              </div>
            `).join('')}
          </div>
          ` : ''}
          
          <div class="section">
            <h2>📋 Recommendations</h2>
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px;">
              ${data.recommendations.split('\n').map(rec => rec.trim()).filter(rec => rec).map(rec => `<p style="margin-bottom: 10px;">• ${rec}</p>`).join('')}
            </div>
          </div>
          
          <div class="section">
            <h2>⚡ Gas Optimization Suggestions</h2>
            <div style="background: #e8f5e8; border: 1px solid #c3e6c3; padding: 20px; border-radius: 8px;">
              ${data.gasOptimizations.split('\n').map(opt => opt.trim()).filter(opt => opt).map(opt => `<p style="margin-bottom: 10px;">• ${opt}</p>`).join('')}
            </div>
          </div>
        </div>
        
        <div class="footer">
          <div class="logo">Coin Railz</div>
          <p>Professional Smart Contract Audit Platform</p>
          <p style="margin-top: 10px; font-size: 0.9rem;">
            This report was generated using industry-standard static analysis tools and manual security review.<br>
            For questions about this audit, contact: support@coinrailz.com
          </p>
          <p style="margin-top: 15px; font-size: 0.8rem; color: #999;">
            Generated on ${new Date().toLocaleDateString()} | Certificate ID: ${data.certificateId}
          </p>
        </div>
      </div>
    </body>
    </html>
    `;
  }

  /**
   * Get color for grade badge
   */
  private getGradeColor(grade: string) {
    switch (grade) {
      case 'A':
        return rgb(0.16, 0.65, 0.27); // Green
      case 'B':
        return rgb(1, 0.76, 0.03); // Orange
      case 'F':
        return rgb(0.86, 0.21, 0.27); // Red
      default:
        return rgb(0.5, 0.5, 0.5); // Gray
    }
  }

  /**
   * Get file path for generated PDF
   */
  getFilePath(filename: string): string {
    return path.join(this.outputDir, filename);
  }

  /**
   * Check if PDF file exists
   */
  async fileExists(filename: string): Promise<boolean> {
    try {
      await fs.access(this.getFilePath(filename));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clean up old PDF files (optional - for storage management)
   */
  async cleanupOldFiles(olderThanDays: number = 30): Promise<void> {
    try {
      const files = await fs.readdir(this.outputDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      for (const file of files) {
        const filePath = path.join(this.outputDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath);
          console.log(`🗑️ Cleaned up old PDF: ${file}`);
        }
      }
    } catch (error) {
      console.error('Failed to cleanup old PDF files:', error);
    }
  }
}

// Export singleton instance
export const pdfGenerationService = PDFGenerationService.getInstance();